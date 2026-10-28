// Acceso a datos con caché por invocación. Los volúmenes son pequeños (decenas de
// usuarios, cientos de solicitudes), así que los catálogos se leen completos.
import { TABLES, getConfig } from './config.mjs';
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
    // Aprobadores de solicitudes definidos por el Admin (aplican a todos los usuarios)
    aprobadores: () => once('aprobadores', async () => (await getConfig()).aprobadores || []),
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
 * Aprobadores de un usuario: la lista global que define el Admin; si está vacía,
 * los administradores. Nunca el propio solicitante.
 */
export function resolveApprovers(user, usuarios, aprobadores = []) {
  const byEmail = indexBy(usuarios, 'correo');
  const active = (c) => byEmail[c] && byEmail[c].activo !== false && c !== user.correo;
  let list = aprobadores.filter(active);
  if (!list.length) list = usuarios.filter((u) => u.rol === 'Admin' && active(u.correo)).map((u) => u.correo);
  return list.map((c) => ({ correo: c, nombre: fullName(byEmail[c]) }));
}

// Correos de quienes reciben aviso cuando se aprueba una ausencia de alguien de su torre.
export function torreNotifyEmails(user, torresById, usuarios) {
  const byEmail = indexBy(usuarios, 'correo');
  return (torresById[user.torre_id]?.notificar || []).filter((c) => byEmail[c] && byEmail[c].activo !== false && c !== user.correo);
}

// Backups de una solicitud (soporta el campo único de versiones anteriores).
export const backupsOf = (s) => s.backup_correos || (s.backup_correo ? [s.backup_correo] : []);

// Reportes: Admin y aprobadores ven a todos los colaboradores.
export function scopeEmails(viewer) {
  if (viewer.rol === 'Admin' || viewer.rol === 'Aprobador') return null;
  return new Set([viewer.correo]);
}
