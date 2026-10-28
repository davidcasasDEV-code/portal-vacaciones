import crypto from 'node:crypto';
import { TABLES } from '../lib/config.mjs';
import { putItem, patchItem, getItem, nextCounter } from '../lib/db.mjs';
import { badRequest, forbidden, notFound, conflict, email, str } from '../lib/http.mjs';
import { todayISO, monthRange } from '../lib/dates.mjs';
import { analyzeRequest } from '../lib/rules.mjs';
import { ACTIVE_STATUSES } from '../lib/balance.mjs';
import { notifyCreated, notifyDecision, notifyCancelled } from '../lib/email.mjs';
import { fullName, shortName, indexBy, missingProfileFields, scopeEmails, directoryEntry } from '../lib/repo.mjs';

const histEntry = (accion, por, comentario) => ({ fecha: new Date().toISOString(), accion, por, comentario: comentario || undefined });

function assertProfileReady(user) {
  const faltan = missingProfileFields(user);
  if (faltan.length) throw badRequest(`Completa tu perfil antes de solicitar: ${faltan.map((f) => f.label).join(', ')}`);
}

function readInput(body) {
  return {
    tipo: str(body.tipo, 40),
    desde: str(body.desde, 10),
    hasta: str(body.hasta, 10) || str(body.desde, 10),
    backup_correo: email(body.backup_correo) || null,
    descripcion: str(body.descripcion, 500),
  };
}

export async function preview({ user, body, repo }) {
  const input = readInput(body);
  return analyzeRequest({ user, ...input }, repo, todayISO());
}

export async function create({ user, body, repo }) {
  assertProfileReady(user);
  const input = readInput(body);
  const hoy = todayISO();
  const a = await analyzeRequest({ user, ...input }, repo, hoy);
  if (a.errores.length) throw badRequest(a.errores[0], { errores: a.errores });

  const [beneficios, usuarios] = await Promise.all([repo.beneficios(), repo.usuarios()]);
  const beneficio = beneficios.find((b) => b.clave === input.tipo);
  const backup = input.backup_correo ? usuarios.find((u) => u.correo === input.backup_correo) : null;
  const seq = await nextCounter(TABLES.config, 'folio_seq');
  const now = new Date().toISOString();

  const item = {
    id: crypto.randomUUID(),
    folio: `VAC-${hoy.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
    correo_solicitante: user.correo,
    solicitante: fullName(user),
    torre_id: user.torre_id || null,
    tipo: beneficio.clave,
    tipo_nombre: beneficio.nombre,
    desde: input.desde,
    hasta: input.hasta,
    fechas: a.fechas,
    dias_descuento: a.dias_descuento,
    estatus: 'Pendiente',
    aprobadores: a.aprobadores.map((x) => x.correo),
    backup_correo: backup?.correo || null,
    backup_nombre: backup ? fullName(backup) : null,
    descripcion: input.descripcion || null,
    creado: now,
    actualizado: now,
    historial: [histEntry('Creada', fullName(user), input.descripcion)],
  };
  await putItem(TABLES.solicitudes, item);
  await notifyCreated({ ...item, nombre_corto: shortName(user) }, { aprobadores: a.aprobadores, backupEmail: item.backup_correo });
  return { solicitud: item, aprobadores: a.aprobadores };
}

export async function mine({ user, repo }) {
  const items = await repo.solicitudesDe(user.correo);
  return { solicitudes: items.sort((a, b) => b.desde.localeCompare(a.desde)), hoy: todayISO() };
}

export async function cancel({ user, params, body, repo }) {
  const s = await getItem(TABLES.solicitudes, { id: params.id });
  if (!s) throw notFound('Solicitud no encontrada');
  const isOwner = s.correo_solicitante === user.correo;
  if (!isOwner && user.rol !== 'Admin') throw forbidden();
  if (!ACTIVE_STATUSES.includes(s.estatus)) throw conflict(`La solicitud ya está ${s.estatus.toLowerCase()}`);
  const hoy = todayISO();
  if (isOwner && user.rol !== 'Admin' && s.estatus === 'Aprobado' && s.desde <= hoy) {
    throw conflict('Solo puedes cancelar solicitudes aprobadas que aún no inician. Pide a un administrador que la ajuste.');
  }
  const comentario = str(body.comentario, 300);
  const updated = await patchItem(TABLES.solicitudes, { id: s.id }, {
    estatus: 'Cancelado',
    actualizado: new Date().toISOString(),
    historial: [...(s.historial || []), histEntry('Cancelada', fullName(user), comentario)],
  });
  await notifyCancelled({ ...updated }, { canceladoPor: fullName(user), aprobadores: s.aprobadores || [], backupEmail: s.backup_correo });
  repo.invalidate('solicitudes');
  return { solicitud: updated };
}

// ---------- Aprobaciones ----------
const canDecide = (user, s) => user.rol === 'Admin' || (s.aprobadores || []).includes(user.correo);

export async function approvals({ user, query, repo }) {
  const [todas, usuarios, torres] = await Promise.all([repo.solicitudes(), repo.usuarios(), repo.torres()]);
  const torresById = indexBy(torres, 'id');
  const usersByEmail = indexBy(usuarios, 'correo');
  const scope = scopeEmails(user, usuarios, torres);
  const visibles = todas.filter((s) => s.correo_solicitante !== user.correo && (canDecide(user, s) || (scope && scope.has(s.correo_solicitante))));
  const activas = todas.filter((s) => ACTIVE_STATUSES.includes(s.estatus));

  const enrich = (s) => {
    const fechas = new Set(s.fechas || []);
    const torreId = usersByEmail[s.correo_solicitante]?.torre_id;
    return {
      ...s,
      torre: torresById[torreId]?.nombre || null,
      puede_decidir: s.estatus === 'Pendiente' && canDecide(user, s),
      // Quién más de la misma torre estará fuera esas fechas
      traslapes: activas
        .filter((o) => o.id !== s.id && o.correo_solicitante !== s.correo_solicitante && torreId && usersByEmail[o.correo_solicitante]?.torre_id === torreId)
        .filter((o) => (o.fechas || []).some((f) => fechas.has(f)))
        .map((o) => ({ nombre: o.solicitante, desde: o.desde, hasta: o.hasta, estatus: o.estatus })),
    };
  };

  const estatus = str(query.estatus, 20);
  const list = visibles.filter((s) => !estatus || s.estatus === estatus).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  return {
    solicitudes: list.map(enrich),
    pendientes: visibles.filter((s) => s.estatus === 'Pendiente' && canDecide(user, s)).length,
    hoy: todayISO(),
  };
}

export async function decide({ user, params, body, repo }) {
  const s = await getItem(TABLES.solicitudes, { id: params.id });
  if (!s) throw notFound('Solicitud no encontrada');
  if (s.correo_solicitante === user.correo) throw forbidden('No puedes aprobar tus propias solicitudes');
  if (!canDecide(user, s)) throw forbidden('No eres aprobador de esta solicitud');
  if (s.estatus !== 'Pendiente') throw conflict(`La solicitud ya fue ${s.estatus.toLowerCase()}`);
  const accion = body.accion;
  const comentario = str(body.comentario, 500);
  if (!['aprobar', 'rechazar'].includes(accion)) throw badRequest('Acción inválida');
  if (accion === 'rechazar' && !comentario) throw badRequest('Escribe el motivo del rechazo');

  const estatus = accion === 'aprobar' ? 'Aprobado' : 'Rechazado';
  const updated = await patchItem(
    TABLES.solicitudes,
    { id: s.id },
    {
      estatus,
      aprobado_por: user.correo,
      aprobado_por_nombre: fullName(user),
      decidido: new Date().toISOString(),
      comentario_aprobador: comentario || null,
      actualizado: new Date().toISOString(),
      historial: [...(s.historial || []), histEntry(estatus, fullName(user), comentario)],
    },
    { condition: { expr: 'estatus = :pendiente', values: { ':pendiente': 'Pendiente' } } },
  ).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') throw conflict('Otra persona ya resolvió esta solicitud');
    throw err;
  });
  const solicitante = (await repo.usuarios()).find((u) => u.correo === s.correo_solicitante);
  await notifyDecision({ ...updated, nombre_corto: shortName(solicitante) || s.solicitante }, { decididoPor: fullName(user), backupEmail: s.backup_correo });
  return { solicitud: updated };
}

// ---------- Mapa de equipo ----------
export async function teamCalendar({ query, repo }) {
  const mes = /^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : todayISO().slice(0, 7);
  const { desde, hasta } = monthRange(mes);
  const [usuarios, torres, todas, festivos] = await Promise.all([repo.usuarios(), repo.torres(), repo.solicitudes(), repo.festivos()]);
  const torresById = indexBy(torres, 'id');
  const torre = query.torre || '';
  const miembros = usuarios
    .filter((u) => u.activo !== false && (!torre || u.torre_id === torre))
    .map((u) => directoryEntry(u, torresById))
    .sort((a, b) => (a.torre || 'zz').localeCompare(b.torre || 'zz', 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  const correos = new Set(miembros.map((m) => m.correo));
  const ausencias = todas
    .filter((s) => ACTIVE_STATUSES.includes(s.estatus) && correos.has(s.correo_solicitante))
    .filter((s) => (s.fechas || []).some((f) => f >= desde && f <= hasta))
    .map((s) => ({
      id: s.id,
      correo: s.correo_solicitante,
      tipo: s.tipo,
      estatus: s.estatus,
      desde: s.desde,
      hasta: s.hasta,
      fechas: s.fechas.filter((f) => f >= desde && f <= hasta),
      backup: s.backup_nombre || null,
      backup_correo: s.backup_correo || null,
    }));
  return { mes, desde, hasta, miembros, ausencias, festivos: festivos.filter((f) => f.fecha >= desde && f.fecha <= hasta), hoy: todayISO() };
}
