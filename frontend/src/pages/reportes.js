import { html, mount, $, on } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../api.js';
import { session } from '../state.js';
import { loadCatalogos } from '../main.js';
import { fmtRange, fmtDate, statusBadge, tipoChip, num, MESES_C } from '../ui/format.js';
import { dataTable } from '../ui/table.js';
import { stackedBar, doughnut, PALETTE } from '../ui/charts.js';
import { openRequestDetail } from '../ui/request-detail.js';

export default async function reportes(el, { query }) {
  const cat = await loadCatalogos();
  const year = Number(cat.hoy.slice(0, 4));
  const state = { tab: query.tab || 'solicitudes', anio: String(year), rep: null, saldos: null };

  async function load() {
    if (state.tab === 'solicitudes') state.rep = await get(`/reportes/solicitudes?anio=${state.anio}`);
    else state.saldos ||= await get('/reportes/saldos');
  }

  function head() {
    return html`
      <div class="page-head">
        <div><h1>Reportes</h1><p>${session.isAdmin ? 'Vista de toda la organización.' : 'Colaboradores de las torres que apruebas.'}</p></div>
        <div class="row">
          <div class="tabs" role="tablist">
            <button role="tab" data-tab="solicitudes" aria-selected="${state.tab === 'solicitudes'}">Solicitudes</button>
            <button role="tab" data-tab="saldos" aria-selected="${state.tab === 'saldos'}">Saldos del equipo</button>
          </div>
          ${state.tab === 'solicitudes'
            ? html`<select class="input" data-anio aria-label="Año" style="width:auto;min-height:40px">${[year + 1, year, year - 1, year - 2].map((y) => html`<option ${String(y) === state.anio ? 'selected' : ''}>${y}</option>`)}</select>`
            : ''}
        </div>
      </div>`;
  }

  function drawSolicitudes() {
    const r = state.rep;
    const k = r.kpis;
    mount(
      el,
      html`${head()}
      <div class="stack">
        <div class="grid cols-4">
          <div class="card kpi"><div class="kpi-label">${icon('list')}Solicitudes ${r.anio}</div><div class="kpi-value">${k.total}</div><div class="kpi-foot">${k.canceladas} canceladas</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('calendar')}Días aprobados</div><div class="kpi-value">${k.dias_aprobados}</div><div class="kpi-foot">Días hábiles en ${r.anio}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('clock')}Pendientes</div><div class="kpi-value" style="color:var(--warn)">${k.pendientes}</div><div class="kpi-foot"><a href="#/aprobaciones">Ir a aprobaciones →</a></div></div>
          <div class="card kpi"><div class="kpi-label">${icon('check-circle')}Tasa de aprobación</div><div class="kpi-value">${k.tasa_aprobacion ?? '—'}${k.tasa_aprobacion != null ? html`<small>%</small>` : ''}</div><div class="kpi-foot">${k.aprobadas} aprobadas · ${k.rechazadas} rechazadas</div></div>
        </div>
        <div class="grid cols-2">
          <section class="card"><div class="card-head"><h2>${icon('chart')}Días de ausencia por mes</h2></div><div class="chart-box"><canvas id="c-mes"></canvas></div></section>
          <section class="card"><div class="card-head"><h2>${icon('grid')}Por tipo de ausencia</h2></div><div class="chart-box"><canvas id="c-tipo"></canvas></div></section>
          <section class="card"><div class="card-head"><h2>${icon('building')}Por torre de servicio</h2></div><div class="chart-box sm"><canvas id="c-torre"></canvas></div></section>
          <section class="card"><div class="card-head"><h2>${icon('users')}Top colaboradores (días)</h2></div><div class="chart-box sm"><canvas id="c-top"></canvas></div></section>
        </div>
        <div id="tbl"></div>
      </div>`,
    );
    const bm = cat.beneficiosMap;
    const tipos = Object.keys(r.por_tipo);
    stackedBar($('#c-mes', el), MESES_C, tipos.map((t) => ({ label: bm[t]?.nombre || t, data: r.por_mes.map((m) => m[t] || 0), backgroundColor: bm[t]?.color })));
    doughnut($('#c-tipo', el), tipos.map((t) => bm[t]?.nombre || t), tipos.map((t) => r.por_tipo[t]), tipos.map((t) => bm[t]?.color));
    const torres = Object.entries(r.por_torre);
    stackedBar($('#c-torre', el), torres.map(([t]) => t), [{ label: 'Días', data: torres.map(([, v]) => v), backgroundColor: torres.map((_, i) => PALETTE[i % PALETTE.length]) }], { horizontal: true });
    stackedBar($('#c-top', el), r.top_personas.map(([n]) => n.split(' ').slice(0, 2).join(' ')), [{ label: 'Días', data: r.top_personas.map(([, v]) => v), backgroundColor: '#5DADEC' }], { horizontal: true });

    dataTable($('#tbl', el), {
      rows: r.solicitudes,
      exportName: `solicitudes-${r.anio}`,
      onRow: (s) => openRequestDetail(s, cat),
      filters: [
        { key: 'estatus', label: 'Estatus', options: ['Pendiente', 'Aprobado', 'Rechazado', 'Cancelado'].map((v) => ({ value: v, label: v })) },
        { key: 'torre', label: 'Torre', options: [...new Set(r.solicitudes.map((s) => s.torre))].map((t) => ({ value: t, label: t })) },
        { key: 'tipo', label: 'Tipo', options: cat.beneficios.map((b) => ({ value: b.clave, label: b.nombre })) },
        { key: 'mes', label: 'Mes', options: MESES_C.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m })), match: (s, v) => s.desde.slice(5, 7) === v || s.hasta.slice(5, 7) === v },
      ],
      columns: [
        { key: 'folio', label: 'Folio', render: (s) => html`<b class="mono small">${s.folio}</b>` },
        { key: 'solicitante', label: 'Colaborador' },
        { key: 'torre', label: 'Torre' },
        { key: 'tipo', label: 'Tipo', render: (s) => tipoChip(s.tipo, bm), value: (s) => bm[s.tipo]?.nombre },
        { key: 'desde', label: 'Fechas', render: (s) => html`<span class="nowrap">${fmtRange(s.desde, s.hasta)}</span>`, csv: (s) => `${s.desde} a ${s.hasta}` },
        { key: 'dias', label: 'Días', num: true, value: (s) => s.fechas?.length || 0 },
        { key: 'backup_nombre', label: 'Backup', value: (s) => s.backup_nombre || '—' },
        { key: 'estatus', label: 'Estatus', render: (s) => statusBadge(s.estatus) },
        { key: 'aprobado_por_nombre', label: 'Aprobó', value: (s) => s.aprobado_por_nombre || '—' },
      ],
    });
  }

  function drawSaldos() {
    const d = state.saldos;
    const cols = d.beneficios.filter((b) => ['vacaciones', 'dia_personal', 'cumpleanos'].includes(b.clave));
    const vacs = d.filas.map((f) => f.saldos.vacaciones?.disponible ?? 0);
    const totalVac = vacs.reduce((a, b) => a + b, 0);
    const sinPerfil = d.filas.filter((f) => !f.perfil_completo).length;
    mount(
      el,
      html`${head()}
      <div class="stack">
        <div class="grid cols-4">
          <div class="card kpi"><div class="kpi-label">${icon('users')}Colaboradores</div><div class="kpi-value">${d.filas.length}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('umbrella')}Vacaciones por disfrutar</div><div class="kpi-value">${num(totalVac)}</div><div class="kpi-foot">Suma de saldos disponibles</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('chart')}Promedio por persona</div><div class="kpi-value">${num(d.filas.length ? totalVac / d.filas.length : 0)}</div><div class="kpi-foot">Días de vacaciones</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('alert')}Perfiles incompletos</div><div class="kpi-value" style="color:${sinPerfil ? 'var(--warn)' : 'var(--ok)'}">${sinPerfil}</div><div class="kpi-foot">Sin fecha de ingreso o género</div></div>
        </div>
        <section class="card"><div class="card-head"><h2>${icon('chart')}Saldo de vacaciones por colaborador</h2></div><div class="chart-box" style="height:${Math.max(240, d.filas.length * 22)}px"><canvas id="c-saldos"></canvas></div></section>
        <div id="tbl"></div>
      </div>`,
    );
    const sorted = [...d.filas].sort((a, b) => (b.saldos.vacaciones?.disponible ?? 0) - (a.saldos.vacaciones?.disponible ?? 0));
    stackedBar(
      $('#c-saldos', el),
      sorted.map((f) => f.nombre.split(' ').slice(0, 2).join(' ')),
      [
        { label: 'Usados', data: sorted.map((f) => f.saldos.vacaciones?.usado ?? 0), backgroundColor: '#A7A9AC' },
        { label: 'Agendados / pendientes', data: sorted.map((f) => (f.saldos.vacaciones?.agendado ?? 0) + (f.saldos.vacaciones?.pendiente ?? 0)), backgroundColor: '#5DADEC' },
        { label: 'Disponibles', data: sorted.map((f) => Math.max(0, f.saldos.vacaciones?.disponible ?? 0)), backgroundColor: '#1B4F8C' },
      ],
      { horizontal: true },
    );
    const cell = (s) => (s ? html`<div style="min-width:110px"><b>${num(s.disponible)}</b> <span class="xs muted">/ ${num(s.otorgado + s.adicional)}</span>
      <div class="progress" style="height:5px;margin-top:3px"><span style="width:${Math.max(0, Math.min(100, (s.disponible / Math.max(1, s.otorgado + s.adicional)) * 100))}%;background:${s.color}"></span></div></div>` : '—');
    dataTable($('#tbl', el), {
      rows: d.filas,
      exportName: `saldos-${d.hoy}`,
      filters: [{ key: 'torre', label: 'Torre', options: [...new Set(d.filas.map((f) => f.torre))].map((t) => ({ value: t, label: t })) }],
      columns: [
        { key: 'nombre', label: 'Colaborador', render: (f) => html`<b>${f.nombre}</b><div class="xs muted">${f.correo}</div>` , value: (f) => f.nombre },
        { key: 'torre', label: 'Torre' },
        { key: 'fecha_ingreso', label: 'Ingreso', render: (f) => (f.fecha_ingreso ? fmtDate(f.fecha_ingreso) : html`<span class="badge Pendiente plain">Sin capturar</span>`), value: (f) => f.fecha_ingreso || '' },
        { key: 'antig', label: 'Antigüedad', value: (f) => (f.antiguedad ? f.antiguedad.anios * 12 + f.antiguedad.meses : -1), render: (f) => (f.antiguedad ? `${f.antiguedad.anios}a ${f.antiguedad.meses}m` : '—'), csv: (f) => (f.antiguedad ? `${f.antiguedad.anios}a ${f.antiguedad.meses}m` : '') },
        ...cols.map((b) => ({ key: b.clave, label: b.nombre, value: (f) => f.saldos[b.clave]?.disponible ?? null, render: (f) => cell(f.saldos[b.clave]), num: false })),
        { key: 'vac_usado', label: 'Vac. usadas', num: true, value: (f) => f.saldos.vacaciones?.usado ?? 0 },
        { key: 'vac_agendado', label: 'Vac. por disfrutar', num: true, value: (f) => (f.saldos.vacaciones?.agendado ?? 0) + (f.saldos.vacaciones?.pendiente ?? 0) },
      ],
    });
  }

  const draw = () => (state.tab === 'solicitudes' ? drawSolicitudes() : drawSaldos());
  on(el, 'click', '[data-tab]', async (e, b) => {
    state.tab = b.dataset.tab;
    await load();
    draw();
  });
  on(el, 'change', '[data-anio]', async (e) => {
    state.anio = e.target.value;
    await load();
    draw();
  });
  await load();
  draw();
}
