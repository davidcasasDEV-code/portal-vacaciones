import { html, mount, $, on, emptyState } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../api.js';
import { session } from '../state.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, fmtRange, monthDays, monthLabel, shiftMonth, dow, isWeekend, DIAS_C, inkFor, plural, downloadCSV } from '../ui/format.js';

export default async function equipo(el, { query }) {
  const cat = await loadCatalogos();
  const state = {
    mes: /^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : cat.hoy.slice(0, 7),
    torre: query.torre ?? (session.user.torre_id || ''),
    soloAusentes: false,
    data: null,
  };

  const load = async () => (state.data = await get(`/equipo/calendario?mes=${state.mes}${state.torre ? `&torre=${encodeURIComponent(state.torre)}` : ''}`));

  function draw() {
    const d = state.data;
    const days = monthDays(state.mes);
    const laborables = days.filter((f) => !isWeekend(f) && !cat.festivosMap[f]);
    const byPerson = {};
    for (const a of d.ausencias) for (const f of a.fechas) (byPerson[a.correo] ||= {})[f] = a;
    const miembros = state.soloAusentes ? d.miembros.filter((m) => byPerson[m.correo]) : d.miembros;
    const total = d.miembros.length || 1;
    const fueraDia = Object.fromEntries(days.map((f) => [f, d.miembros.filter((m) => byPerson[m.correo]?.[f]).length]));
    const maxFuera = Math.max(0, ...laborables.map((f) => fueraDia[f]));
    const diasPersona = laborables.reduce((s, f) => s + fueraDia[f], 0);
    const disponibilidad = laborables.length ? Math.round(100 - (diasPersona / (laborables.length * total)) * 100) : 100;
    const peor = laborables.filter((f) => fueraDia[f] === maxFuera && maxFuera > 0).slice(0, 3);
    const tipos = [...new Set(d.ausencias.map((a) => a.tipo))];

    // Agrupar por torre
    const groups = {};
    for (const m of miembros) (groups[m.torre || 'Sin torre'] ||= []).push(m);

    const heat = (n) => {
      if (!n) return '';
      const p = n / total;
      const c = p >= 0.4 ? 'var(--bad)' : p >= 0.25 ? 'var(--warn)' : 'var(--accent)';
      return `background:color-mix(in srgb, ${c} ${Math.min(90, 25 + p * 120)}%, transparent);`;
    };

    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Mapa del equipo</h1><p>Quién está fuera cada día, por torre de servicio. Las celdas rayadas aún están pendientes de aprobar.</p></div>
        <div class="row">
          <select class="input" data-torre aria-label="Torre de servicio" style="min-height:40px;width:auto">
            <option value="">Todas las torres</option>
            ${cat.torres.map((t) => html`<option value="${t.id}" ${t.id === state.torre ? 'selected' : ''}>${t.nombre}</option>`)}
          </select>
          <button class="btn secondary sm" data-export>${icon('download')}Exportar</button>
        </div>
      </div>
      <div class="stack">
        <div class="grid cols-4">
          <div class="card kpi"><div class="kpi-label">${icon('users')}Colaboradores</div><div class="kpi-value">${d.miembros.length}</div><div class="kpi-foot">${state.torre ? cat.torres.find((t) => t.id === state.torre)?.nombre : 'Todas las torres'}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('plane')}Con ausencias en el mes</div><div class="kpi-value">${Object.keys(byPerson).length}</div><div class="kpi-foot">${plural(diasPersona, 'día-persona', 'días-persona')}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('check-circle')}Disponibilidad</div><div class="kpi-value">${disponibilidad}%</div><div class="progress" style="margin-top:6px"><span style="width:${disponibilidad}%;background:var(--ok)"></span></div></div>
          <div class="card kpi"><div class="kpi-label">${icon('alert')}Día más crítico</div><div class="kpi-value">${maxFuera}<small> fuera</small></div><div class="kpi-foot">${peor.length ? peor.map((f) => fmtDate(f, { year: false })).join(', ') : 'Sin ausencias'}</div></div>
        </div>

        <section class="card flush">
          <div class="table-tools">
            <div class="row">
              <button class="icon-btn" data-month="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
              <h2 style="text-transform:capitalize;min-width:170px;text-align:center">${monthLabel(state.mes)}</h2>
              <button class="icon-btn" data-month="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
              <button class="btn secondary sm" data-today>Hoy</button>
            </div>
            <label class="check small" style="margin-left:auto"><input type="checkbox" data-solo ${state.soloAusentes ? 'checked' : ''}/> Solo quienes tienen ausencias</label>
          </div>
          <div class="map-wrap">
            ${miembros.length
              ? html`<table class="team-map">
              <thead><tr>
                <th class="name" scope="col">Colaborador</th>
                ${days.map((f) => html`<th scope="col" class="${isWeekend(f) ? 'we' : ''} ${cat.festivosMap[f] ? 'hol' : ''} ${f === d.hoy ? 'today' : ''}" title="${cat.festivosMap[f]?.nombre || fmtDate(f, { weekday: true })}">${DIAS_C[dow(f)].slice(0, 2)}<br />${Number(f.slice(8))}</th>`)}
              </tr></thead>
              <tbody>
                ${Object.entries(groups).map(
                  ([torre, ms]) => html`
                  ${!state.torre ? html`<tr class="group"><td class="name">${torre} · ${ms.length}</td><td colspan="${days.length}"></td></tr>` : ''}
                  ${ms.map(
                    (m) => html`<tr>
                      <th class="name" scope="row" title="${m.nombre}">${m.correo === session.user.correo ? html`<b>${m.nombre} (tú)</b>` : m.nombre}</th>
                      ${days.map((f) => {
                        const a = byPerson[m.correo]?.[f];
                        const cls = `${isWeekend(f) ? 'we' : ''} ${cat.festivosMap[f] ? 'hol' : ''}`;
                        if (!a) return html`<td class="${cls}"></td>`;
                        const b = cat.beneficiosMap[a.tipo];
                        const t = `${m.nombre} · ${b?.nombre} · ${fmtRange(a.desde, a.hasta)} · ${a.estatus}${a.backup ? ` · Backup: ${a.backup}` : ''}`;
                        return html`<td class="${cls}"><span class="cell ${a.estatus === 'Pendiente' ? 'pending' : ''}" style="background-color:${b?.color};color:${inkFor(b?.color)}" title="${t}" aria-label="${t}">${b?.abreviatura}</span></td>`;
                      })}
                    </tr>`,
                  )}`,
                )}
              </tbody>
              <tfoot><tr><th class="name" scope="row">Fuera por día</th>
                ${days.map((f) => html`<td class="${isWeekend(f) ? 'we' : ''}">${isWeekend(f) || cat.festivosMap[f] ? '' : html`<span class="heat" style="${heat(fueraDia[f])}" title="${fueraDia[f]} de ${total} fuera">${fueraDia[f] || ''}</span>`}</td>`)}
              </tr></tfoot>
            </table>`
              : emptyState('No hay colaboradores para mostrar', 'users')}
          </div>
          <div class="table-foot">
            <div class="legend">
              ${tipos.map((t) => html`<span><span class="dot" style="background:${cat.beneficiosMap[t]?.color}"></span>${cat.beneficiosMap[t]?.abreviatura} = ${cat.beneficiosMap[t]?.nombre}</span>`)}
              <span><span class="dot" style="background:var(--holiday-ink)"></span>Festivo</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>${icon('list')}Detalle de ausencias del mes</h2></div>
          <div class="list">
            ${d.ausencias.length
              ? [...d.ausencias]
                  .sort((a, b) => a.desde.localeCompare(b.desde))
                  .map((a) => {
                    const m = d.miembros.find((x) => x.correo === a.correo);
                    const b = cat.beneficiosMap[a.tipo];
                    return html`<div class="list-item">
                      <span class="dot" style="background:${b?.color};width:12px;height:12px"></span>
                      <div class="grow"><div class="title">${m?.nombre} · ${b?.nombre}</div><div class="xs muted">${fmtRange(a.desde, a.hasta)} · ${plural(a.fechas.length, 'día hábil', 'días hábiles')} este mes${a.backup ? ` · Backup: ${a.backup}` : ''}</div></div>
                      <span class="badge ${a.estatus}">${a.estatus}</span>
                    </div>`;
                  })
              : emptyState('Sin ausencias este mes', 'calendar')}
          </div>
        </section>
      </div>`,
    );
  }

  on(el, 'click', '[data-month]', async (e, b) => {
    state.mes = shiftMonth(state.mes, Number(b.dataset.month));
    await load();
    draw();
  });
  on(el, 'click', '[data-today]', async () => {
    state.mes = cat.hoy.slice(0, 7);
    await load();
    draw();
  });
  on(el, 'change', '[data-torre]', async (e) => {
    state.torre = e.target.value;
    await load();
    draw();
  });
  on(el, 'change', '[data-solo]', (e) => {
    state.soloAusentes = e.target.checked;
    draw();
  });
  on(el, 'click', '[data-export]', () => {
    const d = state.data;
    const days = monthDays(state.mes);
    const byPerson = {};
    for (const a of d.ausencias) for (const f of a.fechas) (byPerson[a.correo] ||= {})[f] = a;
    downloadCSV(`mapa-equipo-${state.mes}.csv`, [
      ['Colaborador', 'Torre', ...days],
      ...d.miembros.map((m) => [m.nombre, m.torre || '', ...days.map((f) => (byPerson[m.correo]?.[f] ? `${cat.beneficiosMap[byPerson[m.correo][f].tipo]?.abreviatura}${byPerson[m.correo][f].estatus === 'Pendiente' ? '*' : ''}` : cat.festivosMap[f] ? 'FEST' : ''))]),
    ]);
  });

  await load();
  draw();
}
