// Migra los datos del portal anterior (tablas NAVE_*) a las tablas Go_Productivity_*.
// Solo LEE las tablas NAVE_*; nunca las modifica.
//   node infra/migrate-legacy.mjs            → simulación (no escribe), muestra el reporte
//   node infra/migrate-legacy.mjs --aplicar  → escribe en las tablas nuevas
import fs from 'node:fs';
import path from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { T, ROOT, log } from './settings.mjs';
import { BENEFICIOS, FESTIVOS, setConfig } from './seed-config.mjs';
import { workingDays, todayISO } from '../backend/src/lib/dates.mjs';
import { computeBalance } from '../backend/src/lib/balance.mjs';

const APPLY = process.argv.includes('--aplicar');
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

async function scan(TableName) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await doc.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    out.push(...r.Items);
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

const dmyToISO = (v) => {
  const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

const ROLE_MAP = { Dev: 'Admin', Admin: 'Aprobador', Usuario: 'Usuario' };
const TIPO_MAP = {
  vacation: 'vacaciones',
  'personal-day': 'dia_personal',
  'medio-dia': 'medio_dia',
  birthday: 'cumpleanos',
  enfermedad: 'enfermedad',
  permiso: 'permiso',
  nacimiento_adopcion_padre: 'paternidad',
  licencia_maternidad_madre: 'maternidad',
  licencia_adopcion_madre: 'adopcion_madre',
  fallecimiento_familiar: 'fallecimiento',
};
const ADICIONAL_MAP = { vacaciones: 'vacaciones', dias_personales: 'dia_personal', 'cumpleaños': 'cumpleanos' };
const statusOf = (s) => (String(s || '').startsWith('Pendiente') ? 'Pendiente' : ['Aprobado', 'Rechazado', 'Cancelado'].includes(s) ? s : 'Cancelado');
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Las torres heredadas del campo "rol"; "Manager" era un puesto, no una torre.
const NOT_A_TORRE = new Set(['Manager']);

// Cálculo de vacaciones del portal anterior, solo para comparar saldos.
function legacyVacationTotal(ingresoISO, hoy) {
  if (!ingresoISO) return 0;
  const [y1, m1, d1] = ingresoISO.split('-').map(Number);
  const [y2, m2, d2] = hoy.split('-').map(Number);
  let anios = y2 - y1;
  let meses = m2 - m1;
  if (meses < 0 || (meses === 0 && d2 - d1 < 0)) {
    anios -= 1;
    meses += 12;
  }
  if (anios === 0) return meses >= 6 ? 6 : 0;
  let total = 0;
  for (let y = 1; y <= anios; y++) total += anios <= 5 ? 12 + (y - 1) * 2 : 20 + Math.floor((y - 5) / 5) * 2;
  return total;
}

const hoy = todayISO();
const holidays = new Set(FESTIVOS.map((f) => f[0]));
const beneficiosByKey = Object.fromEntries(BENEFICIOS.map((b) => [b.clave, b]));

const [oldUsers, oldVac, oldExtra] = await Promise.all([scan('NAVE_Reporte_Usuarios_Web'), scan('NAVE_Vacaciones'), scan('NAVE_Saldo_Adicional_Beneficios').catch(() => [])]);
log(`Origen: ${oldUsers.length} usuarios, ${oldVac.length} solicitudes, ${oldExtra.length} saldos adicionales`);

// ---------- Torres ----------
const torreNames = [...new Set(oldUsers.map((u) => u.rol).filter((r) => r && !NOT_A_TORRE.has(r)))];
const torres = torreNames.map((nombre, i) => ({ id: slug(nombre), nombre, descripcion: 'Migrada del portal anterior', color: ['#1B4F8C', '#2BA59B', '#7C5CD6', '#E8A33D'][i % 4], aprobadores: [], creado: new Date().toISOString() }));

// ---------- Usuarios ----------
const usuarios = oldUsers.map((u) => {
  const correo = u.correo.toLowerCase().trim();
  return {
    correo,
    nombre: u.nombre?.trim() || null,
    apellido: u.apellido?.trim() || null,
    rol: ROLE_MAP[u.permisos] || 'Usuario',
    activo: Boolean(u.permisos),
    torre_id: u.rol && !NOT_A_TORRE.has(u.rol) ? slug(u.rol) : null,
    genero: ['Hombre', 'Mujer'].includes(u.sexo) ? u.sexo : null,
    fecha_ingreso: dmyToISO(u.fecha_ingreso),
    fecha_nacimiento: dmyToISO(u.fecha_nacimiento),
    // Hash SHA-256 heredado: se re-encripta con scrypt en el siguiente login.
    password_hash: u.password || undefined,
    debe_cambiar_password: false,
    token_version: 0,
    migrado_de: 'NAVE_Reporte_Usuarios_Web',
    creado: new Date().toISOString(),
  };
});
const userByEmail = Object.fromEntries(usuarios.map((u) => [u.correo, u]));
const fullName = (u) => [u?.nombre, u?.apellido].filter(Boolean).join(' ');

// ---------- Solicitudes ----------
const sorted = [...oldVac].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const solicitudes = sorted.map((v, i) => {
  const tipo = TIPO_MAP[v.tipo_solicitud] || 'permiso';
  const b = beneficiosByKey[tipo];
  const fechas = workingDays(v.desde, v.hasta, holidays);
  const id = String(v.id);
  const creado = /^\d{14}$/.test(id) ? `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T${id.slice(8, 10)}:${id.slice(10, 12)}:${id.slice(12, 14)}.000Z` : new Date().toISOString();
  const estatus = statusOf(v.estatus);
  const correo = String(v.correo_solicitante || '').toLowerCase().trim();
  const aprobador = String(v.aprobador || '').toLowerCase().trim();
  const historial = [{ fecha: creado, accion: 'Creada', por: v.solicitante }];
  if (estatus !== 'Pendiente') historial.push({ fecha: creado, accion: estatus, por: estatus === 'Cancelado' ? v.solicitante : fullName(userByEmail[aprobador]) || aprobador, comentario: 'Migrado del portal anterior' });
  return {
    id: `nave-${id}`,
    folio: `VAC-${(v.desde || creado).slice(0, 4)}-${String(i + 1).padStart(4, '0')}`,
    correo_solicitante: correo,
    solicitante: fullName(userByEmail[correo]) || v.solicitante,
    torre_id: userByEmail[correo]?.torre_id || null,
    tipo,
    tipo_nombre: b.nombre,
    desde: v.desde,
    hasta: v.hasta,
    fechas,
    dias_descuento: Math.round(fechas.length * (b.factor ?? 1) * 100) / 100,
    dias_legacy: Number(v.dias_solicitados) || null,
    estatus,
    aprobadores: aprobador ? [aprobador] : [],
    aprobado_por: ['Aprobado', 'Rechazado'].includes(estatus) ? aprobador : undefined,
    aprobado_por_nombre: ['Aprobado', 'Rechazado'].includes(estatus) ? fullName(userByEmail[aprobador]) || aprobador : undefined,
    backup_correo: null,
    descripcion: v.descripcion && v.descripcion !== 'N/A' ? v.descripcion : null,
    creado,
    actualizado: creado,
    historial,
    migrado_de: 'NAVE_Vacaciones',
  };
});

// Aprobadores por torre: quienes aprobaron a sus miembros en los últimos 12 meses
// y siguen activos en el portal.
const haceUnAnio = `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`;
for (const t of torres) {
  const count = {};
  for (const s of solicitudes) {
    if (s.torre_id !== t.id || s.desde < haceUnAnio) continue;
    for (const a of s.aprobadores) if (userByEmail[a]?.activo && userByEmail[a].rol !== 'Usuario') count[a] = (count[a] || 0) + 1;
  }
  t.aprobadores = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

// ---------- Saldo adicional ----------
const adicionales = oldExtra.map((x) => ({
  id: `nave-${x.id}`,
  correo: String(x.correo).toLowerCase(),
  tipo: ADICIONAL_MAP[x.tipo] || x.tipo,
  cantidad: Number(x.cantidad),
  anio: String(x.valido),
  motivo: x.motivo,
  creado: new Date().toISOString(),
  creado_por: 'migracion',
}));

// ---------- Reporte ----------
const beneficiosSeed = BENEFICIOS.map((b) => ({ ...b, activo: true }));
const comparacion = usuarios
  .filter((u) => u.activo && u.fecha_ingreso)
  .map((u) => {
    const mias = solicitudes.filter((s) => s.correo_solicitante === u.correo);
    const { saldos, vacaciones } = computeBalance(u, beneficiosSeed, mias, adicionales.filter((a) => a.correo === u.correo), hoy);
    const v = saldos.find((s) => s.clave === 'vacaciones');
    return {
      colaborador: fullName(u) || u.correo,
      ingreso: u.fecha_ingreso,
      antiguedad: `${vacaciones.antiguedad.anios}a ${vacaciones.antiguedad.meses}m`,
      otorgado_antes: legacyVacationTotal(u.fecha_ingreso, hoy),
      otorgado_lft: v.otorgado,
      disponible_lft: v.disponible,
    };
  });

console.log('\nTorres de servicio:');
console.table(torres.map((t) => ({ id: t.id, nombre: t.nombre, miembros: usuarios.filter((u) => u.torre_id === t.id).length, aprobadores: t.aprobadores.join(', ') })));
console.log('\nUsuarios por rol:', usuarios.reduce((acc, u) => ((acc[`${u.rol}${u.activo ? '' : ' (inactivo)'}`] = (acc[`${u.rol}${u.activo ? '' : ' (inactivo)'}`] || 0) + 1), acc), {}));
console.log('Perfiles incompletos:', usuarios.filter((u) => u.activo && (!u.nombre || !u.apellido || !u.genero || !u.fecha_ingreso || !u.fecha_nacimiento)).length);
console.log('Solicitudes por estatus:', solicitudes.reduce((acc, s) => ((acc[s.estatus] = (acc[s.estatus] || 0) + 1), acc), {}));
const difDias = solicitudes.filter((s) => s.dias_legacy != null && s.dias_legacy !== s.fechas.length && s.tipo !== 'medio_dia');
console.log(`Solicitudes cuyo conteo de días hábiles difiere del registrado antes: ${difDias.length}`);
console.log('\nComparación de vacaciones (otorgado acumulado) antes vs LFT:');
console.table(comparacion.filter((c) => c.otorgado_antes !== c.otorgado_lft));
console.log(`(${comparacion.filter((c) => c.otorgado_antes === c.otorgado_lft).length} colaboradores sin cambio)`);

fs.writeFileSync(path.join(ROOT, 'infra', '.migration-report.json'), JSON.stringify({ hoy, torres, comparacion, difDias: difDias.map((s) => ({ folio: s.folio, desde: s.desde, hasta: s.hasta, antes: s.dias_legacy, ahora: s.fechas.length })) }, null, 2));

if (!APPLY) {
  log('Simulación terminada. Ejecuta con --aplicar para escribir en las tablas Go_Productivity_*.');
  process.exit(0);
}

async function batchPut(TableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    let RequestItems = { [TableName]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) };
    while (RequestItems && Object.keys(RequestItems).length) {
      const r = await doc.send(new BatchWriteCommand({ RequestItems }));
      RequestItems = r.UnprocessedItems;
    }
  }
  log(`${TableName}: ${items.length} registros`);
}

await batchPut(T.torres, torres);
await batchPut(T.usuarios, usuarios);
await batchPut(T.solicitudes, solicitudes);
await batchPut(T.adicional, adicionales);
await setConfig('folio_seq', solicitudes.length);
await doc.send(new PutCommand({ TableName: T.config, Item: { clave: 'migracion_nave', valor: new Date().toISOString() } }));
log('Migración aplicada.');
