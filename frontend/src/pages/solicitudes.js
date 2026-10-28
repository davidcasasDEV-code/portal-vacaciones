import { html, mount, $, on, toast, confirmDialog } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, post } from '../api.js';
import { loadCatalogos } from '../main.js';
import { fmtRange, fmtDateTime, statusBadge, tipoChip } from '../ui/format.js';
import { dataTable } from '../ui/table.js';
import { openRequestModal } from '../ui/request-modal.js';
import { openRequestDetail } from '../ui/request-detail.js';

export default async function solicitudes(el) {
  const cat = await loadCatalogos();
  let data = await get('/solicitudes');

  const cancelable = (s) => s.estatus === 'Pendiente' || (s.estatus === 'Aprobado' && s.desde > data.hoy);

  async function cancel(s) {
    const r = await confirmDialog({
      title: `Cancelar ${s.folio}`,
      message: `¿Cancelar tu solicitud de ${cat.beneficiosMap[s.tipo]?.nombre.toLowerCase()} (${fmtRange(s.desde, s.hasta)})? Los días regresan a tu saldo y avisaremos a tu aprobador.`,
      confirmText: 'Sí, cancelar',
      danger: true,
      input: { label: 'Motivo (opcional)' },
    });
    if (!r) return;
    try {
      await post(`/solicitudes/${encodeURIComponent(s.id)}/cancelar`, { comentario: r.value });
      toast(`Solicitud ${s.folio} cancelada`, 'ok');
      data = await get('/solicitudes');
      draw();
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  function draw() {
    const list = data.solicitudes;
    const count = (st) => list.filter((s) => s.estatus === st).length;
    const anio = data.hoy.slice(0, 4);
    const diasAnio = list.filter((s) => s.estatus === 'Aprobado').reduce((a, s) => a + (s.fechas || []).filter((f) => f.startsWith(anio)).length, 0);
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Mis solicitudes</h1><p>Historial completo, estatus y seguimiento de tus ausencias.</p></div>
        <button class="btn" data-new>${icon('plus')}Nueva solicitud</button>
      </div>
      <div class="stack">
        <div class="grid cols-4">
          <div class="card kpi"><div class="kpi-label"><span class="dot" style="background:var(--warn)"></span>Pendientes</div><div class="kpi-value">${count('Pendiente')}</div><div class="kpi-foot">Esperando aprobación</div></div>
          <div class="card kpi"><div class="kpi-label"><span class="dot" style="background:var(--ok)"></span>Aprobadas</div><div class="kpi-value">${count('Aprobado')}</div><div class="kpi-foot">${diasAnio} días hábiles en ${anio}</div></div>
          <div class="card kpi"><div class="kpi-label"><span class="dot" style="background:var(--bad)"></span>Rechazadas</div><div class="kpi-value">${count('Rechazado')}</div><div class="kpi-foot">Historial total</div></div>
          <div class="card kpi"><div class="kpi-label"><span class="dot" style="background:var(--neutral)"></span>Canceladas</div><div class="kpi-value">${count('Cancelado')}</div><div class="kpi-foot">Historial total</div></div>
        </div>
        <div id="tbl"></div>
      </div>`,
    );
    dataTable($('#tbl', el), {
      rows: list,
      exportName: 'mis-solicitudes',
      empty: 'Aún no tienes solicitudes',
      filters: [
        { key: 'estatus', label: 'Estatus', options: ['Pendiente', 'Aprobado', 'Rechazado', 'Cancelado'].map((v) => ({ value: v, label: v })) },
        { key: 'tipo', label: 'Tipo', options: cat.beneficios.map((b) => ({ value: b.clave, label: b.nombre })) },
        { key: 'anio', label: 'Año', options: [...new Set(list.map((s) => s.desde.slice(0, 4)))].map((y) => ({ value: y, label: y })), match: (r, v) => r.desde.startsWith(v) },
      ],
      onRow: (s) => openDetail(s),
      columns: [
        { key: 'folio', label: 'Folio', render: (s) => html`<b class="mono small">${s.folio}</b>` },
        { key: 'tipo', label: 'Tipo', render: (s) => tipoChip(s.tipo, cat.beneficiosMap), value: (s) => cat.beneficiosMap[s.tipo]?.nombre },
        { key: 'desde', label: 'Fechas', render: (s) => html`<span class="nowrap">${fmtRange(s.desde, s.hasta)}</span>` },
        { key: 'dias', label: 'Días', num: true, value: (s) => s.fechas?.length || 0 },
        { key: 'backup_nombre', label: 'Backup', value: (s) => s.backup_nombre || '—' },
        { key: 'estatus', label: 'Estatus', render: (s) => statusBadge(s.estatus) },
        { key: 'creado', label: 'Solicitada', render: (s) => html`<span class="small muted nowrap">${fmtDateTime(s.creado)}</span>` },
        {
          key: 'acciones',
          label: '',
          sortable: false,
          csv: () => '',
          render: (s) => html`<div class="row" style="gap:4px;justify-content:flex-end">
            <button class="icon-btn" data-ver="${s.id}" aria-label="Ver detalle de ${s.folio}" title="Ver detalle">${icon('eye')}</button>
            ${cancelable(s) ? html`<button class="icon-btn" data-cancel="${s.id}" aria-label="Cancelar ${s.folio}" title="Cancelar">${icon('ban')}</button>` : ''}
          </div>`,
        },
      ],
    });
  }

  function openDetail(s) {
    const m = openRequestDetail(s, cat, {
      actions: html`${cancelable(s) ? html`<button class="btn danger" data-cancel-modal>${icon('ban')}Cancelar solicitud</button>` : ''}<button class="btn secondary" data-close>Cerrar</button>`,
    });
    m.el.querySelector('[data-cancel-modal]')?.addEventListener('click', () => {
      m.close();
      cancel(s);
    });
  }

  const find = (id) => data.solicitudes.find((s) => s.id === id);
  on(el, 'click', '[data-ver]', (e, b) => openDetail(find(b.dataset.ver)));
  on(el, 'click', '[data-cancel]', (e, b) => cancel(find(b.dataset.cancel)));
  on(el, 'click', '[data-new]', async () => {
    if (await openRequestModal()) {
      data = await get('/solicitudes');
      draw();
    }
  });
  draw();
}

