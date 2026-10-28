import crypto from 'node:crypto';
import { TABLES, PUBLIC_CONFIG_KEYS, getConfig, clearConfigCache } from '../lib/config.mjs';
import { getItem, putItem, patchItem, deleteItem } from '../lib/db.mjs';
import { badRequest, conflict, notFound, forbidden, str, email, isEmail, isISODate } from '../lib/http.mjs';
import { ROLES, hashPassword, generateTempPassword } from '../lib/auth.mjs';
import { todayISO } from '../lib/dates.mjs';
import { computeBalance, ACTIVE_STATUSES } from '../lib/balance.mjs';
import { publicUser, indexBy, scopeEmails, fullName } from '../lib/repo.mjs';
import { sendTempPassword, sendWelcome } from '../lib/email.mjs';

// ---------------- Usuarios ----------------
export async function listUsers({ repo }) {
  const [usuarios, torres] = await Promise.all([repo.usuarios(), repo.torres()]);
  const torresById = indexBy(torres, 'id');
  return {
    usuarios: usuarios
      .map((u) => publicUser(u, torresById))
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es')),
  };
}

function readUser(body, { isNew }) {
  const u = {
    nombre: str(body.nombre, 80),
    apellido: str(body.apellido, 120),
    rol: str(body.rol, 20) || 'Usuario',
    torre_id: str(body.torre_id, 60) || null,
    genero: str(body.genero, 20) || null,
    fecha_ingreso: str(body.fecha_ingreso, 10) || null,
    fecha_nacimiento: str(body.fecha_nacimiento, 10) || null,
    puesto: str(body.puesto, 120) || null,
    telefono: str(body.telefono, 30) || null,
    activo: body.activo !== false,
  };
  if (isNew) u.correo = email(body.correo);
  if (isNew && !isEmail(u.correo)) throw badRequest('Correo inválido');
  if (!ROLES.includes(u.rol)) throw badRequest('Rol inválido');
  if (u.genero && !['Hombre', 'Mujer'].includes(u.genero)) throw badRequest('Género inválido');
  for (const k of ['fecha_ingreso', 'fecha_nacimiento']) if (u[k] && !isISODate(u[k])) throw badRequest(`Fecha inválida: ${k}`);
  return u;
}

async function assertRefs(u, repo) {
  if (u.torre_id && !(await repo.torres()).some((t) => t.id === u.torre_id)) throw badRequest('Torre de servicio inválida');
}

export async function createUser({ body, repo, user: admin }) {
  const u = readUser(body, { isNew: true });
  await assertRefs(u, repo);
  if (await getItem(TABLES.usuarios, { correo: u.correo })) throw conflict('Ya existe un usuario con ese correo');
  const now = new Date().toISOString();
  const item = { ...u, creado: now, actualizado: now, creado_por: admin.correo, token_version: 0 };
  let temporal = null;
  if (body.modo_password === 'temporal') {
    temporal = generateTempPassword();
    item.password_hash = await hashPassword(temporal);
    item.debe_cambiar_password = true;
  }
  await putItem(TABLES.usuarios, item, { ConditionExpression: 'attribute_not_exists(correo)' });
  if (body.enviar_correo !== false) {
    if (temporal) await sendTempPassword(item.correo, item.nombre, temporal);
    else await sendWelcome(item.correo, item.nombre);
  }
  return { usuario: publicUser(item, indexBy(await repo.torres(), 'id')), password_temporal: temporal };
}

export async function updateUser({ params, body, repo, user: admin }) {
  const correo = decodeURIComponent(params.correo);
  const current = await getItem(TABLES.usuarios, { correo });
  if (!current) throw notFound('Usuario no encontrado');
  const u = readUser(body, { isNew: false });
  u.correo = correo;
  await assertRefs(u, repo);
  if (correo === admin.correo && u.rol !== 'Admin') throw forbidden('No puedes quitarte el rol de Admin a ti mismo');
  if (correo === admin.correo && !u.activo) throw forbidden('No puedes desactivar tu propia cuenta');
  const { correo: _c, ...fields } = u;
  const updated = await patchItem(TABLES.usuarios, { correo }, {
    ...fields,
    actualizado: new Date().toISOString(),
    // Cambiar rol o desactivar invalida sesiones abiertas
    token_version: fields.rol !== current.rol || (!fields.activo && current.activo !== false) ? (current.token_version || 0) + 1 : undefined,
  });
  return { usuario: publicUser(updated, indexBy(await repo.torres(), 'id')) };
}

export async function deleteUser({ params, user: admin, repo }) {
  const correo = decodeURIComponent(params.correo);
  if (correo === admin.correo) throw forbidden('No puedes eliminar tu propia cuenta');
  const current = await getItem(TABLES.usuarios, { correo });
  if (!current) throw notFound('Usuario no encontrado');
  // Quitarlo de los aprobadores y de los avisos por torre
  const aprobadores = await repo.aprobadores();
  if (aprobadores.includes(correo)) await saveApprovers(aprobadores.filter((c) => c !== correo));
  for (const t of await repo.torres()) {
    if ((t.notificar || []).includes(correo)) await patchItem(TABLES.torres, { id: t.id }, { notificar: t.notificar.filter((c) => c !== correo) });
  }
  await deleteItem(TABLES.usuarios, { correo });
  // El historial de solicitudes se conserva para reportes.
  return { ok: true };
}

export async function resetPassword({ params, body }) {
  const correo = decodeURIComponent(params.correo);
  const u = await getItem(TABLES.usuarios, { correo });
  if (!u) throw notFound('Usuario no encontrado');
  const modo = body.modo;
  if (modo === 'forzar') {
    await patchItem(TABLES.usuarios, { correo }, { debe_cambiar_password: true });
    return { ok: true, mensaje: 'El usuario deberá cambiar su contraseña en su siguiente acceso' };
  }
  if (modo === 'temporal') {
    const temp = generateTempPassword();
    await patchItem(TABLES.usuarios, { correo }, {
      password_hash: await hashPassword(temp),
      debe_cambiar_password: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      token_version: (u.token_version || 0) + 1,
    });
    if (body.enviar_correo !== false) await sendTempPassword(correo, u.nombre, temp);
    return { ok: true, password_temporal: temp, mensaje: 'Contraseña temporal generada; se cerraron sus sesiones abiertas' };
  }
  if (modo === 'desbloquear') {
    await patchItem(TABLES.usuarios, { correo }, { intentos_fallidos: 0, bloqueado_hasta: null });
    return { ok: true, mensaje: 'Cuenta desbloqueada' };
  }
  throw badRequest('Modo inválido');
}

// ---------------- Torres de servicio ----------------
export async function listTorres({ repo }) {
  const [torres, usuarios] = await Promise.all([repo.torres(), repo.usuarios()]);
  const byEmail = indexBy(usuarios, 'correo');
  return {
    torres: torres
      .map((t) => ({
        ...t,
        miembros: usuarios.filter((u) => u.torre_id === t.id && u.activo !== false).length,
        notificar_detalle: (t.notificar || []).map((c) => ({ correo: c, nombre: fullName(byEmail[c]) || c })),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

async function readTorre(body, repo) {
  const t = {
    nombre: str(body.nombre, 80),
    descripcion: str(body.descripcion, 300) || null,
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#1B4F8C',
    // Personas que reciben aviso cuando se aprueba una ausencia de la torre
    notificar: Array.isArray(body.notificar) ? [...new Set(body.notificar.map(email).filter(Boolean))] : [],
  };
  if (!t.nombre) throw badRequest('El nombre de la torre es obligatorio');
  const usuarios = indexBy(await repo.usuarios(), 'correo');
  const invalid = t.notificar.filter((c) => !usuarios[c]);
  if (invalid.length) throw badRequest(`Usuarios inexistentes: ${invalid.join(', ')}`);
  return t;
}

export async function createTorre({ body, repo }) {
  const t = await readTorre(body, repo);
  if ((await repo.torres()).some((x) => x.nombre.toLowerCase() === t.nombre.toLowerCase())) throw conflict('Ya existe una torre con ese nombre');
  const item = { id: crypto.randomUUID(), ...t, creado: new Date().toISOString() };
  await putItem(TABLES.torres, item);
  return { torre: item };
}

export async function updateTorre({ params, body, repo }) {
  if (!(await getItem(TABLES.torres, { id: params.id }))) throw notFound('Torre no encontrada');
  const t = await readTorre(body, repo);
  const updated = await patchItem(TABLES.torres, { id: params.id }, { ...t, aprobadores: null, actualizado: new Date().toISOString() });
  return { torre: updated };
}

export async function deleteTorre({ params, repo }) {
  if (!(await getItem(TABLES.torres, { id: params.id }))) throw notFound('Torre no encontrada');
  const miembros = (await repo.usuarios()).filter((u) => u.torre_id === params.id);
  for (const u of miembros) await patchItem(TABLES.usuarios, { correo: u.correo }, { torre_id: null });
  await deleteItem(TABLES.torres, { id: params.id });
  return { ok: true, desasignados: miembros.length };
}

// ---------------- Aprobadores (aplican a todos los usuarios) ----------------
async function saveApprovers(list) {
  await putItem(TABLES.config, { clave: 'aprobadores', valor: list });
  clearConfigCache();
}

export async function getApprovers({ repo }) {
  const [aprobadores, usuarios] = await Promise.all([repo.aprobadores(), repo.usuarios()]);
  const byEmail = indexBy(usuarios, 'correo');
  return { aprobadores: aprobadores.filter((c) => byEmail[c]).map((c) => ({ correo: c, nombre: fullName(byEmail[c]), rol: byEmail[c].rol })) };
}

export async function updateApprovers({ body, repo }) {
  const usuarios = await repo.usuarios();
  const byEmail = indexBy(usuarios, 'correo');
  const list = [...new Set((Array.isArray(body.aprobadores) ? body.aprobadores : []).map(email).filter(Boolean))];
  const invalid = list.filter((c) => !byEmail[c] || byEmail[c].activo === false);
  if (invalid.length) throw badRequest(`Usuarios inválidos o inactivos: ${invalid.join(', ')}`);
  await saveApprovers(list);
  // El rol Aprobador da acceso a la bandeja y reportes; se ajusta según la lista.
  for (const u of usuarios) {
    if (list.includes(u.correo) && u.rol === 'Usuario') await patchItem(TABLES.usuarios, { correo: u.correo }, { rol: 'Aprobador' });
    if (!list.includes(u.correo) && u.rol === 'Aprobador') await patchItem(TABLES.usuarios, { correo: u.correo }, { rol: 'Usuario' });
  }
  repo.invalidate('usuarios');
  repo.invalidate('aprobadores');
  return getApprovers({ repo: { ...repo, aprobadores: async () => list } });
}

// ---------------- Días festivos ----------------
export async function listFestivos({ repo }) {
  return { festivos: await repo.festivos() };
}

export async function upsertFestivo({ body, params }) {
  const fecha = params.fecha || str(body.fecha, 10);
  if (!isISODate(fecha)) throw badRequest('Fecha inválida');
  const nombre = str(body.nombre, 100);
  if (!nombre) throw badRequest('Escribe el nombre del día festivo');
  const tipo = ['Oficial', 'Empresa'].includes(body.tipo) ? body.tipo : 'Empresa';
  const item = { fecha, nombre, tipo, anio: fecha.slice(0, 4) };
  await putItem(TABLES.festivos, item);
  return { festivo: item };
}

export async function deleteFestivo({ params }) {
  await deleteItem(TABLES.festivos, { fecha: params.fecha });
  return { ok: true };
}

// ---------------- Beneficios ----------------
export async function listBeneficios({ repo }) {
  return { beneficios: (await repo.beneficios()).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)) };
}

export async function updateBeneficio({ params, body }) {
  const b = await getItem(TABLES.beneficios, { clave: params.clave });
  if (!b) throw notFound('Beneficio no encontrado');
  const num = (v, min = 0, max = 400) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw badRequest('Valor numérico inválido');
    return n;
  };
  const updated = await patchItem(TABLES.beneficios, { clave: b.clave }, {
    nombre: str(body.nombre, 80) || undefined,
    descripcion: body.descripcion !== undefined ? str(body.descripcion, 400) : undefined,
    dias: b.periodo === 'ilimitado' ? undefined : num(body.dias),
    minimo_meses: num(body.minimo_meses, 0, 120),
    anticipo_dias: b.periodo === 'lft' ? num(body.anticipo_dias) : undefined,
    acumulable: b.periodo === 'lft' && typeof body.acumulable === 'boolean' ? body.acumulable : undefined,
    permite_retroactivo: typeof body.permite_retroactivo === 'boolean' ? body.permite_retroactivo : undefined,
    activo: typeof body.activo === 'boolean' ? body.activo : undefined,
    genero: ['Todos', 'Hombre', 'Mujer'].includes(body.genero) ? body.genero : undefined,
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : undefined,
  });
  return { beneficio: updated };
}

// ---------------- Saldo adicional ----------------
export async function listAdicional({ repo }) {
  const [items, usuarios] = await Promise.all([repo.adicionales(), repo.usuarios()]);
  const byEmail = indexBy(usuarios, 'correo');
  return { adicionales: items.map((a) => ({ ...a, nombre: fullName(byEmail[a.correo]) || a.correo })).sort((a, b) => (b.creado || '').localeCompare(a.creado || '')) };
}

export async function createAdicional({ body, user, repo }) {
  const correo = email(body.correo);
  if (!(await repo.usuarios()).some((u) => u.correo === correo)) throw badRequest('Colaborador inválido');
  const tipo = str(body.tipo, 40);
  const beneficio = (await repo.beneficios()).find((b) => b.clave === tipo && !b.descuenta_de && b.periodo !== 'ilimitado');
  if (!beneficio) throw badRequest('Tipo de beneficio inválido');
  const cantidad = Number(body.cantidad);
  if (!Number.isFinite(cantidad) || cantidad === 0 || Math.abs(cantidad) > 200) throw badRequest('Cantidad inválida (puede ser negativa para ajustes)');
  const motivo = str(body.motivo, 300);
  if (!motivo) throw badRequest('Escribe el motivo');
  const item = {
    id: crypto.randomUUID(),
    correo,
    tipo,
    cantidad,
    anio: String(body.anio || todayISO().slice(0, 4)),
    motivo,
    creado: new Date().toISOString(),
    creado_por: user.correo,
  };
  await putItem(TABLES.adicional, item);
  return { adicional: item };
}

export async function deleteAdicional({ params }) {
  await deleteItem(TABLES.adicional, { id: params.id });
  return { ok: true };
}

// ---------------- Configuración ----------------
export async function getConfigPublic() {
  const cfg = await getConfig();
  return { config: Object.fromEntries(PUBLIC_CONFIG_KEYS.map((k) => [k, cfg[k] ?? ''])) };
}

export async function updateConfig({ body }) {
  for (const k of PUBLIC_CONFIG_KEYS) {
    if (body[k] === undefined) continue;
    const valor = str(String(body[k]), 300);
    if (k === 'ses_from' && !isEmail(valor)) throw badRequest('Correo remitente inválido (debe estar verificado en Amazon SES)');
    await putItem(TABLES.config, { clave: k, valor });
  }
  clearConfigCache();
  return getConfigPublic();
}

// ---------------- Reportes (Admin: todo · Aprobador: sus torres) ----------------
export async function report({ user, query, repo }) {
  const anio = /^\d{4}$/.test(query.anio || '') ? query.anio : todayISO().slice(0, 4);
  const [todas, usuarios, torres, beneficios] = await Promise.all([repo.solicitudes(), repo.usuarios(), repo.torres(), repo.beneficios()]);
  const scope = scopeEmails(user);
  const torresById = indexBy(torres, 'id');
  const usersByEmail = indexBy(usuarios, 'correo');
  const inScope = (c) => !scope || scope.has(c);
  const solicitudes = todas
    .filter((s) => inScope(s.correo_solicitante) && (s.desde.startsWith(anio) || s.hasta.startsWith(anio)))
    .map((s) => ({ ...s, torre: torresById[usersByEmail[s.correo_solicitante]?.torre_id]?.nombre || 'Sin torre' }))
    .sort((a, b) => b.desde.localeCompare(a.desde));

  const kpis = { total: solicitudes.length, pendientes: 0, aprobadas: 0, rechazadas: 0, canceladas: 0, dias_aprobados: 0 };
  const porMes = Array.from({ length: 12 }, () => ({}));
  const porTipo = {};
  const porTorre = {};
  const porPersona = {};
  for (const s of solicitudes) {
    kpis[{ Pendiente: 'pendientes', Aprobado: 'aprobadas', Rechazado: 'rechazadas', Cancelado: 'canceladas' }[s.estatus]] += 1;
    if (!ACTIVE_STATUSES.includes(s.estatus)) continue;
    for (const f of s.fechas || []) {
      if (!f.startsWith(anio)) continue;
      if (s.estatus === 'Aprobado') kpis.dias_aprobados += 1;
      const m = Number(f.slice(5, 7)) - 1;
      porMes[m][s.tipo] = (porMes[m][s.tipo] || 0) + 1;
      porTipo[s.tipo] = (porTipo[s.tipo] || 0) + 1;
      porTorre[s.torre] = (porTorre[s.torre] || 0) + 1;
      porPersona[s.solicitante] = (porPersona[s.solicitante] || 0) + 1;
    }
  }
  const decididas = kpis.aprobadas + kpis.rechazadas;
  kpis.tasa_aprobacion = decididas ? Math.round((kpis.aprobadas / decididas) * 100) : null;

  return {
    anio,
    kpis,
    por_mes: porMes,
    por_tipo: porTipo,
    por_torre: porTorre,
    top_personas: Object.entries(porPersona).sort((a, b) => b[1] - a[1]).slice(0, 10),
    solicitudes,
    beneficios,
  };
}

export async function balancesReport({ user, repo }) {
  const hoy = todayISO();
  const [usuarios, torres, beneficios, todas, adicionales] = await Promise.all([repo.usuarios(), repo.torres(), repo.beneficios(), repo.solicitudes(), repo.adicionales()]);
  const scope = scopeEmails(user);
  const torresById = indexBy(torres, 'id');
  const filas = usuarios
    .filter((u) => u.activo !== false && (!scope || scope.has(u.correo)))
    .map((u) => {
      const { saldos, vacaciones } = computeBalance(
        u,
        beneficios,
        todas.filter((s) => s.correo_solicitante === u.correo),
        adicionales.filter((a) => a.correo === u.correo),
        hoy,
      );
      return {
        correo: u.correo,
        nombre: fullName(u),
        torre: torresById[u.torre_id]?.nombre || 'Sin torre',
        fecha_ingreso: u.fecha_ingreso || null,
        antiguedad: vacaciones?.antiguedad || null,
        perfil_completo: Boolean(u.fecha_ingreso && u.genero),
        saldos: Object.fromEntries(saldos.map((s) => [s.clave, s])),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { hoy, filas, beneficios: beneficios.filter((b) => !b.descuenta_de).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)) };
}
