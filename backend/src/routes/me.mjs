import { TABLES } from '../lib/config.mjs';
import { patchItem } from '../lib/db.mjs';
import { badRequest, str, isISODate } from '../lib/http.mjs';
import { todayISO, nextOccurrence, diffDays, addDays, weekday, monthRange, seniority } from '../lib/dates.mjs';
import { computeBalance, applicableBenefits, lftTable, ACTIVE_STATUSES } from '../lib/balance.mjs';
import { publicUser, indexBy, resolveApprovers, directoryEntry, fullName } from '../lib/repo.mjs';

const GENEROS = ['Hombre', 'Mujer'];

export async function getMe({ user, repo }) {
  const [torres, usuarios] = await Promise.all([repo.torres(), repo.usuarios()]);
  const torresById = indexBy(torres, 'id');
  return {
    user: publicUser(user, torresById),
    aprobadores: resolveApprovers(user, usuarios, torresById),
    es_aprobador: user.rol === 'Admin' || torres.some((t) => (t.aprobadores || []).includes(user.correo)) || usuarios.some((u) => u.aprobador_correo === user.correo),
  };
}

export async function updateMe({ user, body, repo }) {
  const fields = {
    nombre: str(body.nombre, 80),
    apellido: str(body.apellido, 120),
    genero: str(body.genero, 20),
    fecha_nacimiento: str(body.fecha_nacimiento, 10),
    puesto: str(body.puesto, 120),
    telefono: str(body.telefono, 30),
  };
  if (!fields.nombre || !fields.apellido) throw badRequest('Nombre y apellidos son obligatorios');
  if (!GENEROS.includes(fields.genero)) throw badRequest('Selecciona tu género');
  if (!isISODate(fields.fecha_nacimiento) || fields.fecha_nacimiento > todayISO()) throw badRequest('Fecha de nacimiento inválida');
  // La fecha de ingreso define el saldo de vacaciones: el colaborador solo puede
  // capturarla si está vacía; después únicamente un administrador la modifica.
  if (!user.fecha_ingreso) {
    const ingreso = str(body.fecha_ingreso, 10);
    if (!isISODate(ingreso) || ingreso > todayISO()) throw badRequest('Fecha de ingreso inválida');
    fields.fecha_ingreso = ingreso;
  }
  const updated = await patchItem(TABLES.usuarios, { correo: user.correo }, { ...fields, actualizado: new Date().toISOString() });
  return { user: publicUser(updated, indexBy(await repo.torres(), 'id')) };
}

export async function getCatalogos({ repo, user }) {
  const [beneficios, festivos, torres] = await Promise.all([repo.beneficios(), repo.festivos(), repo.torres()]);
  return {
    beneficios: beneficios.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)),
    mis_beneficios: applicableBenefits(beneficios, user).map((b) => b.clave),
    festivos,
    torres: torres.map((t) => ({ id: t.id, nombre: t.nombre, color: t.color })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    lft: lftTable(Number(beneficios.find((b) => b.periodo === 'lft')?.dias) || 12),
    hoy: todayISO(),
  };
}

export async function getSaldo({ user, repo }) {
  const hoy = todayISO();
  const [beneficios, mias, adicionales] = await Promise.all([repo.beneficios(), repo.solicitudesDe(user.correo), repo.adicionales()]);
  const misAdicionales = adicionales.filter((a) => a.correo === user.correo);
  const balance = computeBalance(user, beneficios, mias, misAdicionales, hoy);

  // Uso por mes del año en curso (para la gráfica)
  const year = hoy.slice(0, 4);
  const byKey = indexBy(beneficios, 'clave');
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, tipos: {} }));
  for (const s of mias) {
    if (!ACTIVE_STATUSES.includes(s.estatus)) continue;
    for (const f of s.fechas || []) {
      if (f.slice(0, 4) !== year) continue;
      const m = porMes[Number(f.slice(5, 7)) - 1];
      m.tipos[s.tipo] = (m.tipos[s.tipo] || 0) + Number(byKey[s.tipo]?.factor ?? 1);
    }
  }
  return { ...balance, adicionales: misAdicionales, por_mes: porMes, hoy, lft: lftTable(Number(byKey.vacaciones?.dias) || 12) };
}

export async function getDashboard({ user, repo }) {
  const hoy = todayISO();
  const [usuarios, torres, festivos, todas, beneficios, adicionales] = await Promise.all([
    repo.usuarios(),
    repo.torres(),
    repo.festivos(),
    repo.solicitudes(),
    repo.beneficios(),
    repo.adicionales(),
  ]);
  const torresById = indexBy(torres, 'id');
  const usersByEmail = indexBy(usuarios, 'correo');
  const activos = usuarios.filter((u) => u.activo !== false);
  const activas = todas.filter((s) => ACTIVE_STATUSES.includes(s.estatus));
  const mias = todas.filter((s) => s.correo_solicitante === user.correo);

  const balance = computeBalance(user, beneficios, mias, adicionales.filter((a) => a.correo === user.correo), hoy);

  const lunes = addDays(hoy, -((weekday(hoy) + 6) % 7));
  const viernes = addDays(lunes, 4);
  const ausencia = (s) => ({
    id: s.id,
    folio: s.folio,
    nombre: s.solicitante,
    correo: s.correo_solicitante,
    torre: torresById[usersByEmail[s.correo_solicitante]?.torre_id]?.nombre || null,
    tipo: s.tipo,
    desde: s.desde,
    hasta: s.hasta,
    estatus: s.estatus,
    backup: s.backup_nombre || null,
  });

  const cumpleanos = activos
    .filter((u) => u.fecha_nacimiento)
    .map((u) => {
      const fecha = nextOccurrence(u.fecha_nacimiento, hoy);
      return { ...directoryEntry(u, torresById), fecha, dias: diffDays(hoy, fecha) };
    })
    .filter((x) => x.dias <= 60)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8);

  const aniversarios = activos
    .filter((u) => u.fecha_ingreso && u.fecha_ingreso < hoy)
    .map((u) => {
      const fecha = nextOccurrence(u.fecha_ingreso, hoy);
      return { ...directoryEntry(u, torresById), fecha, dias: diffDays(hoy, fecha), anios: seniority(u.fecha_ingreso, fecha).anios };
    })
    .filter((x) => x.dias <= 30 && x.anios > 0)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 6);

  const isApprover = (s) => user.rol === 'Admin' || (s.aprobadores || []).includes(user.correo);
  const porAprobar = todas.filter((s) => s.estatus === 'Pendiente' && s.correo_solicitante !== user.correo && isApprover(s));

  // Mini calendario del mes actual
  const { desde: mDesde, hasta: mHasta } = monthRange(hoy.slice(0, 7));
  const equipoPorDia = {};
  for (const s of activas) {
    for (const f of s.fechas || []) {
      if (f >= mDesde && f <= mHasta) equipoPorDia[f] = (equipoPorDia[f] || 0) + 1;
    }
  }
  const misDias = {};
  for (const s of mias.filter((x) => ACTIVE_STATUSES.includes(x.estatus))) {
    for (const f of s.fechas || []) if (f >= mDesde && f <= mHasta) misDias[f] = { tipo: s.tipo, estatus: s.estatus };
  }

  return {
    hoy,
    user: publicUser(user, torresById),
    saldos: balance.saldos,
    vacaciones: balance.vacaciones,
    mis_proximas: mias
      .filter((s) => ACTIVE_STATUSES.includes(s.estatus) && s.hasta >= hoy)
      .sort((a, b) => a.desde.localeCompare(b.desde))
      .slice(0, 5)
      .map(ausencia),
    recientes: mias
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''))
      .slice(0, 5)
      .map((s) => ({ ...ausencia(s), dias: s.fechas?.length || 0, creado: s.creado })),
    coberturas: activas
      .filter((s) => s.backup_correo === user.correo && s.hasta >= hoy)
      .sort((a, b) => a.desde.localeCompare(b.desde))
      .map(ausencia),
    fuera_hoy: activas.filter((s) => (s.fechas || []).includes(hoy)).map(ausencia),
    fuera_semana: activas.filter((s) => (s.fechas || []).some((f) => f >= lunes && f <= viernes)).map(ausencia),
    festivos_proximos: festivos.filter((f) => f.fecha >= hoy).slice(0, 6),
    cumpleanos,
    aniversarios,
    por_aprobar: porAprobar.length,
    mes: { desde: mDesde, hasta: mHasta, equipo_por_dia: equipoPorDia, mis_dias: misDias },
    total_colaboradores: activos.length,
    mi_aprobador: resolveApprovers(user, usuarios, torresById).map((a) => a.nombre).join(', '),
    nombre: fullName(user),
  };
}
