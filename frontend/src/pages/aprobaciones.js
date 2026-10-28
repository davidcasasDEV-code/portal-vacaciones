import { html, mount, $, on, toast, confirmDialog, initials, emptyState, setBusy } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, post } from '../api.js';
import { loadCatalogos } from '../main.js';
import { refreshBadges } from '../layout.js';
import { fmtRange, fmtDateTime, fmtDate, statusBadge, tipoChip, plural } from '../ui/format.js';
import { dataTable } from '../ui/table.js';
import { openRequestDetail } from '../ui/request-detail.js';

export default async function aprobaciones(el, { query }) {
  const cat = await loadCatalogos();
  const state = { tab: 'pendientes', data: null };
  const load = async () => (state.data = await get('/aprobaciones'));

  async function decide(s, accion, btn) {
    let comentario = '';
    if (accion === 'rechazar') {
      const r = await confirmDialog({
        title: `Rechazar ${s.folio}`,
        message: `Se notificará a ${s.solicitante} por correo y los días regresarán a su saldo.`,
        confirmText: 'Rechazar solicitud',
        danger: true,
        input: { label: 'Motivo del rechazo *', required: true, requiredMessage: 'Escribe el motivo del rechazo' },
      });
      if (!r) return;
      comentario = r.value;
    } else {
      const r = await confirmDialog({
        title: `Aprobar ${s.folio}`,
        message: `${s.solicitante} · ${cat.beneficiosMap[s.tipo]?.nombre} · ${fmtRange(s.desde, s.hasta)} (${plural(s.fechas.length, 'día hábil', 'días hábiles')}).`,
        confirmText: 'Aprobar',
        input: { label: 'Comentario (opcional)' },
      });
      if (!r) return;
      comentario = r.value;
    }
    setBusy(btn, true, accion === 'aprobar' ? 'Aprobando…' : 'Rechazando…');
    try {
      await post(`/aprobaciones/${encodeURIComponent(s.id)}`, { accion, comentario });
      toast(`Solicitud ${s.folio} ${accion === 'aprobar' ? 'aprobada' : 'rechazada'}. Notificamos a ${s.solicitante}.`, 'ok');
      await load();
      draw();
      refreshBadges();
    } catch (e) {
      toast(e.message, 'bad');
      setBusy(btn, false);
    }
  }

  const card = (s) => html`
    <article class="card stack-sm" aria-label="Solicitud ${s.folio}">
      <div class="row between">
        <div class="row" style="gap:10px">
          <span class="avatar">${initials(s.solicitante)}</span>
          <div><b>${s.solicitante}</b><div class="xs muted">${s.torre || 'Sin torre'} · ${s.folio} · ${fmtDateTime(s.creado)}</div></div>
        </div>
        ${tipoChip(s.tipo, cat.beneficiosMap)}
      </div>
      <div class="summary">
        <div><div class="l">Fechas</div><div style="font-weight:800">${fmtRange(s.desde, s.hasta)}</div></div>
        <div><div class="l">Días hábiles</div><div class="v" style="font-size:1.2rem">${s.fechas.length}</div></div>
        <div><div class="l">Backup</div><div style="font-weight:700">${s.backup_nombre || '—'}</div></div>
      </div>
      ${s.descripcion ? html`<p class="small">“${s.descripcion}”</p>` : ''}
      ${s.traslapes.length
        ? html`<div class="alert warn">${icon('users')}<div><b>${plural(s.traslapes.length, 'persona', 'personas')} de la misma torre estarán fuera:</b>
            <div class="xs">${s.traslapes.map((t) => `${t.nombre} (${fmtDate(t.desde, { year: false })}–${fmtDate(t.hasta, { year: false })}, ${t.estatus.toLowerCase()})`).join(' · ')}</div></div></div>`
        : html`<div class="xs muted">${icon('check-circle')} Nadie más de su torre estará fuera esos días.</div>`}
      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost sm" data-ver="${s.id}">${icon('eye')}Detalle</button>
        <button class="btn secondary sm" data-rechazar="${s.id}" style="color:var(--bad)">${icon('x-circle')}Rechazar</button>
        <button class="btn ok sm" data-aprobar="${s.id}">${icon('check')}Aprobar</button>
      </div>
    </article>`;

  function draw() {
    const all = state.data.solicitudes;
    const pend = all.filter((s) => s.puede_decidir);
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Aprobaciones</h1><p>Solicitudes de las personas que tienes asignadas. Cada decisión se notifica por correo al colaborador.</p></div>
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="pendientes" aria-selected="${state.tab === 'pendientes'}">Por aprobar (${pend.length})</button>
          <button role="tab" data-tab="historial" aria-selected="${state.tab === 'historial'}">Historial (${all.length})</button>
        </div>
      </div>
      ${state.tab === 'pendientes'
        ? pend.length
          ? html`<div class="grid cols-2">${pend.map(card)}</div>`
          : html`<div class="card">${emptyState('¡Todo al día! No tienes solicitudes por aprobar.', 'check-circle')}</div>`
        : html`<div id="hist"></div>`}`,
    );
    if (state.tab === 'historial') {
      dataTable($('#hist', el), {
        rows: all,
        exportName: 'aprobaciones',
        onRow: (s) => detail(s),
        filters: [
          { key: 'estatus', label: 'Estatus', options: ['Pendiente', 'Aprobado', 'Rechazado', 'Cancelado'].map((v) => ({ value: v, label: v })) },
          { key: 'torre', label: 'Torre', options: cat.torres.map((t) => ({ value: t.nombre, label: t.nombre })) },
          { key: 'tipo', label: 'Tipo', options: cat.beneficios.map((b) => ({ value: b.clave, label: b.nombre })) },
        ],
        columns: [
          { key: 'folio', label: 'Folio', render: (s) => html`<b class="mono small">${s.folio}</b>` },
          { key: 'solicitante', label: 'Colaborador' },
          { key: 'torre', label: 'Torre', value: (s) => s.torre || '—' },
          { key: 'tipo', label: 'Tipo', render: (s) => tipoChip(s.tipo, cat.beneficiosMap), value: (s) => cat.beneficiosMap[s.tipo]?.nombre },
          { key: 'desde', label: 'Fechas', render: (s) => html`<span class="nowrap">${fmtRange(s.desde, s.hasta)}</span>` },
          { key: 'dias', label: 'Días', num: true, value: (s) => s.fechas?.length || 0 },
          { key: 'estatus', label: 'Estatus', render: (s) => statusBadge(s.estatus) },
          { key: 'aprobado_por_nombre', label: 'Aprobó', value: (s) => s.aprobado_por_nombre || '—' },
        ],
      });
    }
  }

  function detail(s) {
    const m = openRequestDetail(s, cat, {
      actions: s.puede_decidir
        ? html`<button class="btn secondary" data-close>Cerrar</button><button class="btn danger" data-m="rechazar">Rechazar</button><button class="btn ok" data-m="aprobar">Aprobar</button>`
        : undefined,
    });
    m.el.querySelectorAll('[data-m]').forEach((b) =>
      b.addEventListener('click', () => {
        m.close();
        decide(s, b.dataset.m, el.querySelector(`[data-${b.dataset.m}="${s.id}"]`));
      }),
    );
  }

  const find = (id) => state.data.solicitudes.find((s) => s.id === id);
  on(el, 'click', '[data-tab]', (e, b) => {
    state.tab = b.dataset.tab;
    draw();
  });
  on(el, 'click', '[data-aprobar]', (e, b) => decide(find(b.dataset.aprobar), 'aprobar', b));
  on(el, 'click', '[data-rechazar]', (e, b) => decide(find(b.dataset.rechazar), 'rechazar', b));
  on(el, 'click', '[data-ver]', (e, b) => detail(find(b.dataset.ver)));

  await load();
  draw();
  if (query.id && find(query.id)) detail(find(query.id));
}
