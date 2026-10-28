import { html, mount, $, on, initials, emptyState } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../api.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, fmtRange, num, plural, relDays, statusBadge, monthDays, monthLabel, dow, isWeekend, MESES_C, inkFor } from '../ui/format.js';
import { openRequestModal } from '../ui/request-modal.js';

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

function miniCal(d, cat) {
  const days = monthDays(d.mes.desde.slice(0, 7));
  const lead = (dow(days[0]) + 6) % 7;
  return html`
    <div class="mini-cal" role="grid" aria-label="Calendario de ${monthLabel(d.mes.desde.slice(0, 7))}">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => html`<div class="dow" aria-hidden="true">${x}</div>`)}
      ${Array.from({ length: lead }, () => html`<div></div>`)}
      ${days.map((f) => {
        const fest = cat.festivosMap[f];
        const mine = d.mes.mis_dias[f];
        const color = mine ? cat.beneficiosMap[mine.tipo]?.color : null;
        const team = d.mes.equipo_por_dia[f];
        const label = [fmtDate(f, { weekday: true }), fest?.nombre, mine ? `${cat.beneficiosMap[mine.tipo]?.nombre} (${mine.estatus})` : '', team ? `${team} fuera del equipo` : ''].filter(Boolean).join(' · ');
        return html`<div class="d ${isWeekend(f) ? 'weekend' : ''} ${fest ? 'holiday' : ''} ${f === d.hoy ? 'today' : ''} ${mine ? 'mine' : ''}"
          style="${color ? `background:${color};color:${inkFor(color)};${mine.estatus === 'Pendiente' ? 'opacity:.75' : ''}` : ''}" title="${label}" aria-label="${label}">
          ${Number(f.slice(8))}${team && !mine ? html`<span class="t"></span>` : ''}
        </div>`;
      })}
    </div>
    <div class="legend" style="margin-top:12px">
      <span><span class="dot" style="background:var(--holiday-ink)"></span>Festivo</span>
      <span><span class="dot" style="background:var(--accent)"></span>Alguien del equipo fuera</span>
      <span><span class="dot" style="background:${cat.beneficiosMap.vacaciones?.color}"></span>Tus días</span>
    </div>`;
}

const personItem = (p, right) => html`
  <div class="list-item">
    <span class="avatar sm">${initials(p.nombre)}</span>
    <div class="grow"><div class="title">${p.nombre}</div><div class="xs muted">${p.torre || ''}</div></div>
    ${right}
  </div>`;

export default async function inicio(el) {
  on(el, 'click', '[data-new]', async () => {
    if (await openRequestModal()) draw();
  });
  await draw();

  async function draw() {
  const [d, cat] = await Promise.all([get('/dashboard'), loadCatalogos()]);
  const vac = d.saldos.find((s) => s.clave === 'vacaciones');
  const pers = d.saldos.find((s) => s.clave === 'dia_personal');
  const cumple = d.saldos.find((s) => s.clave === 'cumpleanos');
  const proxima = d.mis_proximas[0];
  const pendientesMias = d.recientes.filter((r) => r.estatus === 'Pendiente').length;
  const ant = d.vacaciones?.antiguedad;

  const ringCard = (s, label, ic) => {
    if (!s) return '';
    const total = s.otorgado + s.adicional;
    const pct = total ? Math.max(0, Math.min(100, (s.disponible / total) * 100)) : 0;
    return html`<div class="card balance-card">
      <div class="ring" style="--p:${pct};--c:${s.color}"><span>${num(s.disponible)}</span></div>
      <div class="meta">
        <div class="kpi-label small muted" style="font-weight:700">${icon(ic)} ${label}</div>
        <div><b style="font-size:1.05rem">${plural(s.disponible, 'día disponible', 'días disponibles')}</b></div>
        <div class="stat-row"><span>Otorgados <b>${num(total)}</b></span><span>Usados <b>${num(s.usado)}</b></span>${s.agendado + s.pendiente ? html`<span>Por disfrutar <b>${num(s.agendado + s.pendiente)}</b></span>` : ''}</div>
      </div>
    </div>`;
  };

  mount(
    el,
    html`
    <div class="stack">
      <section class="hero">
        <svg class="hero-art" viewBox="0 0 100 100" aria-hidden="true"><path d="M63 5C31 11 11 37 14 62c2 19 18 32 37 34-15-10-22-28-20-47 2-19 14-34 32-44Z" fill="#fff"/><path d="M52 35c22 1 38 14 37 30-1 17-21 30-42 31 17-8 27-20 28-32 1-12-8-23-23-29Z" fill="#fff"/><circle cx="50" cy="61" r="11" fill="none" stroke="#fff" stroke-width="7"/></svg>
        <h1>${saludo()}, ${d.user.nombre || d.user.nombre_corto} 👋</h1>
        <p>
          ${vac ? html`Tienes <b>${plural(vac.disponible, 'día', 'días')} de vacaciones</b> disponibles. ` : ''}
          ${proxima ? html`Tu próxima ausencia es <b>${fmtRange(proxima.desde, proxima.hasta)}</b> (${proxima.estatus.toLowerCase()}).` : 'No tienes ausencias próximas: ¿ya planeaste tu descanso?'}
          ${ant ? html`<br />Antigüedad: <b>${ant.anios} año(s) ${ant.meses} mes(es)</b>${d.vacaciones?.proximo ? html` · el ${fmtDate(d.vacaciones.proximo.fecha)} sumas ${d.vacaciones.proximo.dias} días más` : ''}.` : ''}
        </p>
        <div class="hero-actions">
          <button class="btn" data-new>${icon('calendar-plus')}Solicitar días</button>
          <a class="btn secondary" href="#/calendario">${icon('calendar')}Ver mi calendario</a>
          <a class="btn secondary" href="#/equipo">${icon('users')}¿Quién está fuera?</a>
        </div>
      </section>

      ${d.por_aprobar
        ? html`<a class="alert warn" href="#/aprobaciones" style="text-decoration:none">${icon('check-square')}<div><b>Tienes ${plural(d.por_aprobar, 'solicitud', 'solicitudes')} por aprobar.</b> Revísalas para que tu equipo pueda planear.</div></a>`
        : ''}
      ${d.coberturas.length
        ? html`<div class="alert">${icon('life-buoy')}<div><b>Eres backup:</b> ${d.coberturas.map((c) => `${c.nombre} (${fmtRange(c.desde, c.hasta)})`).join(' · ')}. Esos días no podrás solicitar ausencias.</div></div>`
        : ''}

      <div class="grid cols-4">
        ${ringCard(vac, 'Vacaciones', 'umbrella')}
        ${ringCard(pers, 'Días personales', 'user')}
        ${ringCard(cumple, 'Día de cumpleaños', 'gift')}
        <div class="card kpi">
          <div class="kpi-label">${icon('clock')} Mis solicitudes pendientes</div>
          <div class="kpi-value">${pendientesMias}</div>
          <div class="kpi-foot">Aprobador: ${d.mi_aprobador || '—'}</div>
          <a class="small" href="#/solicitudes">Ver historial →</a>
        </div>
      </div>

      <div class="grid dash">
        <div class="stack">
          <div class="grid cols-2">
            <section class="card">
              <div class="card-head"><h2>${icon('calendar')}<span style="text-transform:capitalize">${monthLabel(d.mes.desde.slice(0, 7))}</span></h2><a class="small" href="#/calendario">Abrir →</a></div>
              ${miniCal(d, cat)}
            </section>
            <section class="card">
              <div class="card-head"><h2>${icon('plane')}Fuera esta semana</h2><span class="tag">${d.fuera_semana.length}</span></div>
              ${d.fuera_hoy.length ? html`<p class="small" style="margin-bottom:6px"><b>Hoy:</b> ${d.fuera_hoy.map((x) => x.nombre.split(' ')[0]).join(', ')}</p>` : ''}
              <div class="list">
                ${d.fuera_semana.length
                  ? d.fuera_semana.slice(0, 7).map(
                      (a) => html`<div class="list-item">
                        <span class="avatar sm">${initials(a.nombre)}</span>
                        <div class="grow"><div class="title">${a.nombre}</div>
                          <div class="xs muted"><span class="dot" style="background:${cat.beneficiosMap[a.tipo]?.color};width:8px;height:8px"></span> ${cat.beneficiosMap[a.tipo]?.nombre} · ${fmtRange(a.desde, a.hasta)}${a.estatus === 'Pendiente' ? ' · pendiente' : ''}</div></div>
                      </div>`,
                    )
                  : emptyState('Todo el equipo está disponible esta semana', 'users')}
              </div>
            </section>
          </div>
          <section class="card">
            <div class="card-head"><h2>${icon('list')}Mis solicitudes recientes</h2><a class="small" href="#/solicitudes">Ver todas →</a></div>
            <div class="list">
              ${d.recientes.length
                ? d.recientes.map(
                    (r) => html`<div class="list-item">
                      <div class="date-pill"><b>${Number(r.desde.slice(8))}</b><small>${MESES_C[Number(r.desde.slice(5, 7)) - 1]}</small></div>
                      <div class="grow"><div class="title">${cat.beneficiosMap[r.tipo]?.nombre || r.tipo} · ${plural(r.dias, 'día', 'días')}</div>
                        <div class="xs muted">${r.folio} · ${fmtRange(r.desde, r.hasta)}${r.backup ? ` · Backup: ${r.backup}` : ''}</div></div>
                      ${statusBadge(r.estatus)}
                    </div>`,
                  )
                : emptyState('Aún no tienes solicitudes. ¡Usa “Solicitar días”!', 'calendar-plus')}
            </div>
          </section>
        </div>

        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>${icon('flag')}Próximos días festivos</h2></div>
            <div class="list">
              ${d.festivos_proximos.length
                ? d.festivos_proximos.map(
                    (f) => html`<div class="list-item">
                      <div class="date-pill" style="background:var(--holiday);color:var(--holiday-ink)"><b>${Number(f.fecha.slice(8))}</b><small>${MESES_C[Number(f.fecha.slice(5, 7)) - 1]}</small></div>
                      <div class="grow"><div class="title">${f.nombre}</div><div class="xs muted">${fmtDate(f.fecha, { weekday: true })} · ${f.tipo}</div></div>
                    </div>`,
                  )
                : emptyState('Sin festivos registrados', 'flag')}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>${icon('gift')}Próximos cumpleaños</h2></div>
            <div class="list">
              ${d.cumpleanos.length
                ? d.cumpleanos.map((c) => personItem(c, html`<div style="text-align:right"><b class="small">${fmtDate(c.fecha, { year: false })}</b><div class="xs muted">${c.dias === 0 ? '🎉 ¡Hoy!' : relDays(c.dias)}</div></div>`))
                : emptyState('Sin cumpleaños en los próximos 60 días', 'gift')}
            </div>
          </section>
          ${d.aniversarios.length
            ? html`<section class="card">
                <div class="card-head"><h2>${icon('award')}Aniversarios laborales</h2></div>
                <div class="list">${d.aniversarios.map((c) => personItem(c, html`<div style="text-align:right"><b class="small">${plural(c.anios, 'año', 'años')}</b><div class="xs muted">${fmtDate(c.fecha, { year: false })}</div></div>`))}</div>
              </section>`
            : ''}
        </div>
      </div>
    </div>`,
  );

  }
}
