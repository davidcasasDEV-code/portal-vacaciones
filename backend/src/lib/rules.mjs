// Reglas de negocio de una solicitud. La misma función alimenta la vista previa del
// formulario (en vivo) y la validación definitiva al guardar.
import { workingDays, eachDay, isWeekend } from './dates.mjs';
import { computeBalance, consumption, balanceKeyFor, applicableBenefits, ACTIVE_STATUSES } from './balance.mjs';
import { indexBy, fullName, resolveApprovers } from './repo.mjs';
import { isISODate } from './http.mjs';
import { fmtDate } from './email.mjs';

const intersects = (a, bSet) => a.some((d) => bSet.has(d));

export async function analyzeRequest({ user, tipo, desde, hasta, backup_correo, ignoreId }, repo, hoy) {
  const errores = [];
  const advertencias = [];
  const [beneficios, holidays, festivos, usuarios, torres, todas, adicionales] = await Promise.all([
    repo.beneficios(),
    repo.holidaySet(),
    repo.festivos(),
    repo.usuarios(),
    repo.torres(),
    repo.solicitudes(),
    repo.adicionales(),
  ]);
  const torresById = indexBy(torres, 'id');
  const usersByEmail = indexBy(usuarios, 'correo');
  const beneficio = applicableBenefits(beneficios, user).find((b) => b.clave === tipo);

  const out = {
    tipo,
    desde,
    hasta,
    fechas: [],
    festivos_en_rango: [],
    fines_de_semana: 0,
    dias_descuento: 0,
    saldo: null,
    saldo_despues: null,
    aprobadores: resolveApprovers(user, usuarios, torresById),
    backups: [],
    requiere_backup: Boolean(beneficio?.requiere_backup),
    companeros_fuera: [],
    errores,
    advertencias,
  };

  if (!beneficio) {
    errores.push('Selecciona un tipo de ausencia válido');
    return out;
  }
  if (!isISODate(desde) || !isISODate(hasta)) {
    errores.push('Selecciona fechas válidas');
    return out;
  }
  if (desde > hasta) {
    errores.push('La fecha de inicio no puede ser posterior a la fecha de fin');
    return out;
  }
  if (eachDay(desde, hasta).length > 120) {
    errores.push('El rango no puede ser mayor a 120 días naturales');
    return out;
  }

  const fechas = workingDays(desde, hasta, holidays);
  out.fechas = fechas;
  out.festivos_en_rango = festivos.filter((f) => f.fecha >= desde && f.fecha <= hasta && !isWeekend(f.fecha));
  out.fines_de_semana = eachDay(desde, hasta).filter(isWeekend).length;
  out.dias_descuento = consumption(beneficio, fechas);

  if (!beneficio.permite_retroactivo && desde < hoy) errores.push('No puedes solicitar fechas pasadas para este tipo de ausencia');
  for (const [d, label] of [[desde, 'inicio'], [hasta, 'fin']]) {
    if (holidays.has(d)) errores.push(`La fecha de ${label} (${fmtDate(d)}) es día festivo`);
    else if (isWeekend(d)) errores.push(`La fecha de ${label} (${fmtDate(d)}) es fin de semana`);
  }
  if (!fechas.length) errores.push('El rango no contiene días hábiles');
  if (beneficio.un_solo_dia && fechas.length > 1) errores.push(`${beneficio.nombre} solo puede solicitarse para un día`);
  if (out.festivos_en_rango.length) {
    advertencias.push(`No se descuentan ${out.festivos_en_rango.length} día(s) festivo(s) dentro del rango`);
  }

  const fechasSet = new Set(fechas);
  const activas = todas.filter((s) => ACTIVE_STATUSES.includes(s.estatus) && s.id !== ignoreId);

  // 1) Traslape con sus propias solicitudes
  const propias = activas.filter((s) => s.correo_solicitante === user.correo && intersects(s.fechas || [], fechasSet));
  for (const s of propias) {
    errores.push(`Ya tienes una solicitud ${s.estatus === 'Aprobado' ? 'aprobada' : 'pendiente'} (${s.folio}) del ${fmtDate(s.desde)} al ${fmtDate(s.hasta)}`);
  }

  // 2) El solicitante es backup de alguien en esas fechas: debe cubrir primero
  const cubre = activas.filter((s) => s.backup_correo === user.correo && intersects(s.fechas || [], fechasSet));
  for (const s of cubre) {
    errores.push(`Eres backup de ${s.solicitante} del ${fmtDate(s.desde)} al ${fmtDate(s.hasta)}; no puedes ausentarte esos días`);
  }

  // 3) Saldo
  const misSolicitudes = todas.filter((s) => s.correo_solicitante === user.correo && s.id !== ignoreId);
  const misAdicionales = adicionales.filter((a) => a.correo === user.correo);
  const { saldos } = computeBalance(user, beneficios, misSolicitudes, misAdicionales, hoy);
  const saldo = saldos.find((x) => x.clave === balanceKeyFor(beneficio));
  out.saldo = saldo || null;
  if (saldo && !saldo.ilimitado) {
    out.saldo_despues = Math.round((saldo.disponible - out.dias_descuento) * 100) / 100;
    if (beneficio.requiere_saldo !== false && out.dias_descuento > saldo.disponible) {
      errores.push(`Saldo insuficiente: tienes ${saldo.disponible} día(s) disponibles de ${saldo.nombre} y la solicitud descuenta ${out.dias_descuento}`);
    }
  }

  // 4) Candidatos a backup: misma torre (o todos si no tiene torre asignada)
  const ausentes = new Map();
  for (const s of activas) {
    if (intersects(s.fechas || [], fechasSet) && !ausentes.has(s.correo_solicitante)) ausentes.set(s.correo_solicitante, s);
  }
  out.backups = usuarios
    .filter((u) => u.activo !== false && u.correo !== user.correo && (!user.torre_id || u.torre_id === user.torre_id))
    .map((u) => {
      const aus = ausentes.get(u.correo);
      return {
        correo: u.correo,
        nombre: fullName(u),
        torre: torresById[u.torre_id]?.nombre || null,
        disponible: !aus,
        motivo: aus ? `Ausente del ${fmtDate(aus.desde)} al ${fmtDate(aus.hasta)}` : null,
      };
    })
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, 'es'));

  if (backup_correo) {
    const b = out.backups.find((x) => x.correo === backup_correo);
    if (!b) errores.push('El backup seleccionado no pertenece a tu torre de servicio');
    else if (!b.disponible) errores.push(`${b.nombre} no está disponible: ${b.motivo.toLowerCase()}`);
  } else if (beneficio.requiere_backup && fechas.length) {
    errores.push('Selecciona a la persona que te cubrirá (backup)');
  }

  // 5) Contexto: compañeros de la misma torre fuera esos días
  if (user.torre_id) {
    out.companeros_fuera = [...ausentes.values()]
      .filter((s) => s.correo_solicitante !== user.correo && usersByEmail[s.correo_solicitante]?.torre_id === user.torre_id)
      .map((s) => ({ nombre: s.solicitante, desde: s.desde, hasta: s.hasta, estatus: s.estatus }));
    if (out.companeros_fuera.length) {
      advertencias.push(`${out.companeros_fuera.length} persona(s) de tu torre estarán fuera en esas fechas`);
    }
  }

  return out;
}
