import { html, mount, $, on } from './dom.js';
import { icon } from './icons.js';
import { downloadCSV } from './format.js';

/**
 * Tabla con búsqueda, filtros, orden, paginación y exportación a CSV.
 * columns: [{ key, label, render?(row), value?(row), sortable?, num?, csv?(row) }]
 * filters: [{ key, label, options: [{value,label}], match?(row, value) }]
 */
export function dataTable(el, { columns, rows, filters = [], pageSize = 15, search = true, exportName, empty = 'Sin registros', toolbar = '', onRow, rowKey }) {
  const state = { q: '', sort: null, dir: 1, page: 0, f: {} };
  const val = (c, r) => (c.value ? c.value(r) : r[c.key]);

  mount(
    el,
    html`
    <div class="card flush">
      <div class="table-tools">
        ${search ? html`<div class="search input-icon"><input class="input" type="search" placeholder="Buscar…" aria-label="Buscar en la tabla" data-q style="width:100%"/></div>` : ''}
        ${filters.map(
          (f) => html`<select class="input" data-filter="${f.key}" aria-label="${f.label}">
            <option value="">${f.label}: todos</option>
            ${f.options.map((o) => html`<option value="${o.value}">${o.label}</option>`)}
          </select>`,
        )}
        ${toolbar}
        ${exportName ? html`<button class="btn secondary sm" data-export>${icon('download')}Exportar</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data"><thead><tr>
        ${columns.map((c) => html`<th class="${c.sortable !== false ? 'sortable' : ''} ${c.num ? 'num' : ''}" data-sort="${c.key}" scope="col">${c.label}<span data-arrow></span></th>`)}
      </tr></thead><tbody></tbody></table></div>
      <div class="table-foot"><span data-count></span><div class="row" data-pager></div></div>
    </div>`,
  );

  const filtered = () => {
    const q = state.q.toLowerCase();
    let list = rows.filter((r) => {
      for (const f of filters) {
        const v = state.f[f.key];
        if (v && !(f.match ? f.match(r, v) : String(r[f.key]) === v)) return false;
      }
      if (!q) return true;
      return columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(q));
    });
    if (state.sort) {
      const c = columns.find((x) => x.key === state.sort);
      list = [...list].sort((a, b) => {
        const x = val(c, a);
        const y = val(c, b);
        if (typeof x === 'number' || typeof y === 'number') return ((x ?? -Infinity) - (y ?? -Infinity)) * state.dir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true }) * state.dir;
      });
    }
    return list;
  };

  const draw = () => {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const slice = list.slice(state.page * pageSize, state.page * pageSize + pageSize);
    mount(
      $('tbody', el),
      slice.length
        ? slice.map(
            (r, i) => html`<tr data-i="${state.page * pageSize + i}" ${onRow ? html`style="cursor:pointer"` : ''}>${columns.map((c) => html`<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : val(c, r) ?? '—'}</td>`)}</tr>`,
          )
        : html`<tr><td colspan="${columns.length}"><div class="empty">${icon('inbox')}<div>${empty}</div></div></td></tr>`,
    );
    $('[data-count]', el).textContent = `${list.length} registro(s)`;
    mount(
      $('[data-pager]', el),
      pages > 1
        ? html`<button class="btn secondary sm" data-page="-1" ${state.page === 0 ? 'disabled' : ''} aria-label="Página anterior">${icon('chevron-left')}</button>
            <span>Página ${state.page + 1} de ${pages}</span>
            <button class="btn secondary sm" data-page="1" ${state.page >= pages - 1 ? 'disabled' : ''} aria-label="Página siguiente">${icon('chevron-right')}</button>`
        : '',
    );
    el.querySelectorAll('th[data-sort]').forEach((th) => {
      const active = th.dataset.sort === state.sort;
      th.setAttribute('aria-sort', active ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
      th.querySelector('[data-arrow]').textContent = active ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
    });
    el._visible = list;
  };

  el.querySelector('[data-q]')?.addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 0;
    draw();
  });
  on(el, 'change', '[data-filter]', (e, s) => {
    state.f[s.dataset.filter] = s.value;
    state.page = 0;
    draw();
  });
  on(el, 'click', 'th.sortable', (e, th) => {
    const k = th.dataset.sort;
    state.dir = state.sort === k ? -state.dir : 1;
    state.sort = k;
    draw();
  });
  on(el, 'click', '[data-page]', (e, b) => {
    state.page += Number(b.dataset.page);
    draw();
  });
  on(el, 'click', '[data-export]', () => {
    const list = filtered();
    downloadCSV(`${exportName}.csv`, [columns.map((c) => c.label), ...list.map((r) => columns.map((c) => (c.csv ? c.csv(r) : val(c, r))))]);
  });
  if (onRow) {
    on(el, 'click', 'tbody tr[data-i]', (e, tr) => {
      if (e.target.closest('button,a,input,select')) return;
      onRow(filtered()[Number(tr.dataset.i)], e);
    });
  }
  draw();
  return {
    update(newRows) {
      rows = newRows;
      draw();
    },
    get rows() {
      return rows;
    },
    rowKey,
  };
}
