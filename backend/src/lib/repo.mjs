// Acceso a datos con caché por invocación. Los volúmenes son pequeños (decenas de
// usuarios, cientos de solicitudes), así que los catálogos se leen completos.
import { TABLES } from './config.mjs';
import { scanAll, queryAll } from './db.mjs';

export function createRepo() {
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    usuarios: () => once('usuarios', () => scanAll(TABLES.usuarios)),
    torres: () => once('torres', () => scanAll(TABLES.torres)),
    beneficios: () => once('beneficios', () => scanAll(TABLES.beneficios)),
    festivos: () => once('festivos', async () => (await scanAll(TABLES.festivos)).sort((a, b) => a.fecha.localeCompare(b.fecha))),
    holidaySet: () => once('holidaySet', async () => new Set((await scanAll(TABLES.festivos)).map((f) => f.fecha))),
    adicionales: () => once('adicionales', () => scanAll(TABLES.adicional)),
    solicitudes: () => once('solicitudes', () => scanAll(TABLES.solicitudes)),
    solicitudesDe: (correo) =>
      once(`sol:${correo}`, () =>
        queryAll(TABLES.solicitudes, {
          IndexName: 'solicitante-desde-index',
          KeyConditionExpression: 'correo_solicitante = :c',
          ExpressionAttributeValues: { ':c': correo },
        }),
      ),
    invalidate: (key) => memo.delete(key),
  };
}

export const REQUIRED_PROFILE_FIELDS = {
  nombre: 'Nombre(s)',
  apellido: 'Apellidos',
  genero: 'Género',
  fecha_nacimiento: 'Fecha de nacimiento',
  fecha_ingreso: 'Fecha de ingreso',
};

export function missingProfileFields(u) {
  return Object.entries(REQUIRED_PROFILE_FIELDS)
    .filter(([k]) => !u[k])
    .map(([k, label]) => ({ campo: k, label }));
}

export const fullName = (u) => [u?.nombre, u?.apellido].filter(Boolean).join(' ') || u?.correo || '';
export const shortName = (u) => {
  const n = (u?.nombre || '').split(' ')[0];
  const a = (u?.apellido || '').split(' ')[0];
  return [n, a].filter(Boolean).join(' ') || u?.correo || '';
};

// Datos del usuario seguros para enviar al navegador.
export function publicUser(u, torresById = {}) {
  if (!u) return null;
  const torre = u.torre_id ? torresById[u.torre_id] : null;
  return {
    correo: u.correo,
    nombre: u.nombre || '',
    apellido: u.apellido || '',
    nombre_completo: fullName(u),
    nombre_corto: shortName(u),
    rol: u.rol,
    torre_id: u.torre_id || null,
    torre: torre?.nombre || null,
    genero: u.genero || '',
    fecha_ingreso: u.fecha_ingreso || '',
    fecha_nacimiento: u.fecha_nacimiento || '',
    puesto: u.puesto || '',
    telefono: u.telefono || '',
    aprobador_correo: u.aprobador_correo || null,
    activo: u.activo !== false,
    tiene_password: Boolean(u.password_hash),
    debe_cambiar_password: Boolean(u.debe_cambiar_password),
    ultimo_acceso: u.ultimo_acceso || null,
    perfil_incompleto: missingProfileFields(u),
  };
}

// Directorio mínimo (para mapas, cumpleaños, backups): sin datos sensibles.
export function directoryEntry(u, torresById = {}) {
  return {
    correo: u.correo,
    nombre: fullName(u),
    nombre_corto: shortName(u),
    torre_id: u.torre_id || null,
    torre: u.torre_id ? torresById[u.torre_id]?.nombre || null : null,
    rol: u.rol,
  };
}

export const indexBy = (arr, key) => Object.fromEntries(arr.map((x) => [x[key], x]));

/**
 * Aprobadores de un usuario:
 *  1) excepción por usuario (aprobador_correo),
 *  2) aprobadores de su torre de servicio,
 *  3) si no hay ninguno, los administradores.
 * Nunca el propio solicitante.
 */
export function resolveApprovers(user, usuarios, torresById) {
  const byEmail = indexBy(usuarios, 'correo');
  const active = (c) => byEmail[c] && byEmail[c].activo !== false && c !== user.correo;
  let list = [];
  if (user.aprobador_correo && active(user.aprobador_correo)) list = [user.aprobador_correo];
  if (!list.length && user.torre_id) list = (torresById[user.torre_id]?.aprobadores || []).filter(active);
  if (!list.length) list = usuarios.filter((u) => u.rol === 'Admin' && active(u.correo)).map((u) => u.correo);
  return list.map((c) => ({ correo: c, nombre: fullName(byEmail[c]) }));
}

// Correos de colaboradores cuyo trabajo puede ver un usuario en reportes:
// Admin → todos; Aprobador → miembros de sus torres + quienes lo tienen como excepción.
export function scopeEmails(viewer, usuarios, torres) {
  if (viewer.rol === 'Admin') return null; // sin restricción
  const myTorres = new Set(torres.filter((t) => (t.aprobadores || []).includes(viewer.correo)).map((t) => t.id));
  return new Set(
    usuarios.filter((u) => u.aprobador_correo === viewer.correo || (u.torre_id && myTorres.has(u.torre_id))).map((u) => u.correo),
  );
}
