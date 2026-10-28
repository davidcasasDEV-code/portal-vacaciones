import { html, openModal } from './dom.js';
import { icon } from './icons.js';
import { fmtDate, fmtRange, fmtDateTime, statusBadge, tipoChip, plural, num } from './format.js';

// Ficha de una solicitud con su línea de tiempo. `actions` es HTML para el pie.
export function openRequestDetail(s, cat, { actions, extra } = {}) {
  const fila = (k, v) => (v ? html`<div><div class="xs muted" style="font-weight:700">${k}</div><div>${v}</div></div>` : '');
  return openModal({
    title: html`Solicitud ${s.folio}`,
    body: html`
      <div class="stack">
        <div class="row between">${tipoChip(s.tipo, cat.beneficiosMap)} ${statusBadge(s.estatus)}</div>
        <div class="form-grid">
          ${fila('Colaborador', s.solicitante)}
          ${fila('Torre', s.torre)}
          ${fila('Fechas', fmtRange(s.desde, s.hasta))}
          ${fila('Días hábiles', plural(s.fechas?.length || 0, 'día', 'días'))}
          ${fila('Descuenta del saldo', s.dias_descuento != null ? num(s.dias_descuento) : '')}
          ${fila('Backup(s)', s.backup_nombre || 'Sin backup')}
          ${fila('Aprobador(es)', (s.aprobadores || []).join(', '))}
          ${fila(s.estatus === 'Rechazado' ? 'Rechazó' : 'Aprobó', s.aprobado_por_nombre)}
          <div class="full">${fila('Comentarios del colaborador', s.descripcion)}</div>
          <div class="full">${fila('Comentario del aprobador', s.comentario_aprobador)}</div>
        </div>
        ${s.fechas?.length ? html`<div><div class="xs muted" style="font-weight:700;margin-bottom:6px">Días que cuenta</div><div class="date-chips">${s.fechas.map((f) => html`<span>${fmtDate(f, { year: false, weekday: true })}</span>`)}</div></div>` : ''}
        ${extra || ''}
        <div>
          <div class="xs muted" style="font-weight:700;margin-bottom:8px">${icon('clock')} Seguimiento</div>
          <div class="timeline">
            ${(s.historial || []).map(
              (h) => html`<div><b class="small">${h.accion}</b> <span class="xs muted">· ${h.por} · ${fmtDateTime(h.fecha)}</span>${h.comentario ? html`<div class="small" style="margin-top:2px">“${h.comentario}”</div>` : ''}</div>`,
            )}
          </div>
        </div>
      </div>`,
    footer: actions || html`<button class="btn secondary" data-close>Cerrar</button>`,
  });
}
