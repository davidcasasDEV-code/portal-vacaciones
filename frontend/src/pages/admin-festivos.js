import { html, mount, $, on, toast, confirmDialog, openModal, setBusy, formData } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, post, put, del } from '../api.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, isWeekend } from '../ui/format.js';
import { dataTable } from '../ui/table.js';

export default async function adminFestivos(el) {
  const cat = await loadCatalogos();
  let festivos = (await get('/admin/festivos')).festivos;
  const year = cat.hoy.slice(0, 4);

  const reload = async () => {
    festivos = (await get('/admin/festivos')).festivos;
    await loadCatalogos(true);
    draw();
  };

  function form(f) {
    const isNew = !f;
    f ||= { fecha: '', nombre: '', tipo: 'Oficial' };
    const m = openModal({
      title: isNew ? 'Nuevo día festivo' : `Editar · ${f.nombre}`,
      size: 'sm',
      body: html`<form id="ff" class="stack" novalidate>
        <div class="field"><label for="f-fecha">Fecha *</label><input class="input" type="date" id="f-fecha" name="fecha" value="${f.fecha}" ${isNew ? '' : 'readonly'} required /></div>
        <div class="field"><label for="f-nombre">Nombre *</label><input class="input" id="f-nombre" name="nombre" value="${f.nombre}" required placeholder="Ej. Día de la Independencia" /></div>
        <div class="field"><label for="f-tipo">Tipo</label><select class="input" id="f-tipo" name="tipo">
          <option value="Oficial" ${f.tipo === 'Oficial' ? 'selected' : ''}>Oficial (Ley Federal del Trabajo)</option>
          <option value="Empresa" ${f.tipo === 'Empresa' ? 'selected' : ''}>Otorgado por la empresa</option></select></div>
        <p class="xs muted">Los festivos no se pueden solicitar y no se descuentan cuando quedan dentro de un rango de vacaciones. Las solicitudes ya registradas conservan sus días.</p>
      </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" data-save>${icon('check')}Guardar</button>`,
    });
    m.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const body = formData($('#ff', m.el));
      setBusy(e.currentTarget, true, 'Guardando…');
      try {
        if (isNew) await post('/admin/festivos', body);
        else await put(`/admin/festivos/${f.fecha}`, body);
        m.close();
        toast('Día festivo guardado', 'ok');
        reload();
      } catch (err) {
        toast(err.message, 'bad');
        setBusy(e.currentTarget, false);
      }
    });
  }

  function draw() {
    const delAnio = festivos.filter((f) => f.fecha.startsWith(year));
    const proximo = festivos.find((f) => f.fecha >= cat.hoy);
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Días festivos</h1><p>Calendario de asueto que se respeta en solicitudes, saldos y mapas.</p></div>
        <button class="btn" data-new>${icon('plus')}Nuevo festivo</button>
      </div>
      <div class="stack">
        <div class="grid cols-3">
          <div class="card kpi"><div class="kpi-label">${icon('flag')}Festivos ${year}</div><div class="kpi-value">${delAnio.length}</div><div class="kpi-foot">${delAnio.filter((f) => !isWeekend(f.fecha)).length} en día hábil</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('calendar')}Próximo</div><div class="kpi-value" style="font-size:1.3rem">${proximo ? proximo.nombre : '—'}</div><div class="kpi-foot">${proximo ? fmtDate(proximo.fecha, { weekday: true }) : ''}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('info')}Años registrados</div><div class="kpi-value" style="font-size:1.3rem">${[...new Set(festivos.map((f) => f.fecha.slice(0, 4)))].join(', ')}</div><div class="kpi-foot">Recuerda cargar el año siguiente</div></div>
        </div>
        <div id="tbl"></div>
      </div>`,
    );
    dataTable($('#tbl', el), {
      rows: [...festivos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      exportName: 'dias-festivos',
      pageSize: 25,
      filters: [
        { key: 'anio', label: 'Año', options: [...new Set(festivos.map((f) => f.fecha.slice(0, 4)))].sort().reverse().map((y) => ({ value: y, label: y })), match: (r, v) => r.fecha.startsWith(v) },
        { key: 'tipo', label: 'Tipo', options: ['Oficial', 'Empresa'].map((v) => ({ value: v, label: v })) },
      ],
      columns: [
        { key: 'fecha', label: 'Fecha', render: (f) => html`<b>${fmtDate(f.fecha, { weekday: true })}</b>${f.fecha < cat.hoy ? html` <span class="xs muted">· pasado</span>` : ''}` },
        { key: 'nombre', label: 'Nombre' },
        { key: 'tipo', label: 'Tipo', render: (f) => html`<span class="tag">${f.tipo}</span>` },
        { key: 'dia', label: 'Día', value: (f) => (isWeekend(f.fecha) ? 'Fin de semana' : 'Hábil') },
        {
          key: 'acc',
          label: '',
          sortable: false,
          csv: () => '',
          render: (f) => html`<div class="row" style="gap:2px;justify-content:flex-end"><button class="icon-btn" data-edit="${f.fecha}" aria-label="Editar ${f.nombre}">${icon('edit')}</button><button class="icon-btn" data-del="${f.fecha}" aria-label="Eliminar ${f.nombre}" style="color:var(--bad)">${icon('trash')}</button></div>`,
        },
      ],
    });
  }

  const find = (d) => festivos.find((f) => f.fecha === d);
  on(el, 'click', '[data-new]', () => form());
  on(el, 'click', '[data-edit]', (e, b) => form(find(b.dataset.edit)));
  on(el, 'click', '[data-del]', async (e, b) => {
    const f = find(b.dataset.del);
    if (!(await confirmDialog({ title: 'Eliminar festivo', message: `¿Eliminar ${f.nombre} (${fmtDate(f.fecha)})?`, confirmText: 'Eliminar', danger: true }))) return;
    try {
      await del(`/admin/festivos/${f.fecha}`);
      toast('Festivo eliminado', 'ok');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
  draw();
}
