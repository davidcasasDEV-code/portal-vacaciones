import { html, mount, $, on, toast, emptyState } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../api.js';
import { session } from '../state.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, fmtRange, monthDays, monthLabel, shiftMonth, dow, isWeekend, statusBadge, inkFor, plural, eachDay } from '../ui/format.js';
import { openRequestModal } from '../ui/request-modal.js';

export default async function calendario(el, { query }) {
  const cat = await loadCatalogos();
  const state = { mes: /^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : cat.hoy.slice(0, 7), mias: [], team: null, sel: null, verEquipo: true };

  const loadMine = async () => (state.mias = (await get('/solicitudes')).solicitudes);
  const loadTeam = async () => (state.team = await get(`/equipo/calendario?mes=${state.mes}`));

  const selectable = (f) => !isWeekend(f) && !cat.festivosMap[f];

  function dayInfo(f) {
    const mine = state.mias.find((s) => ['Pendiente', 'Aprobado'].includes(s.estatus) && (s.fechas || []).includes(f));
    const fuera = (state.team?.ausencias || []).filter((a) => a.fechas.includes(f) && a.correo !== session.user.correo);
    const cubro = (state.team?.ausencias || []).filter((a) => a.fechas.includes(f) && (a.backup_correos || []).includes(session.user.correo));
    return { mine, fuera, cubro, fest: cat.festivosMap[f] };
  }

  function draw() {
    const days = monthDays(state.mes);
    const lead = (dow(days[0]) + 6) % 7;
    const sel = state.sel;
    const inSel = (f) => sel && f >= sel.desde && f <= (sel.hasta || sel.desde);
    const misMes = state.mias
      .filter((s) => ['Pendiente', 'Aprobado'].includes(s.estatus) && (s.fechas || []).some((f) => f.startsWith(state.mes)))
      .sort((a, b) => a.desde.localeCompare(b.desde));
    const festMes = cat.festivos.filter((f) => f.fecha.startsWith(state.mes));
    const tiposUsados = [...new Set(state.mias.map((s) => s.tipo))].filter((t) => cat.beneficiosMap[t]);

    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Calendario</h1><p>Toca un día para empezar tu solicitud y otro para terminar el rango. Los fines de semana y festivos no se descuentan.</p></div>
        <button class="btn" data-new>${icon('plus')}Nueva solicitud</button>
      </div>
      <div class="grid dash">
        <section class="card">
          <div class="cal-head">
            <div class="row">
              <button class="icon-btn" data-month="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
              <h2 aria-live="polite">${monthLabel(state.mes)}</h2>
              <button class="icon-btn" data-month="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
            </div>
            <div class="row">
              <button class="btn secondary sm" data-today>Hoy</button>
              <label class="check small"><input type="checkbox" data-team ${state.verEquipo ? 'checked' : ''} /> Ver ausencias del equipo</label>
            </div>
          </div>
          <div class="cal-grid" role="grid" aria-label="Calendario de ${monthLabel(state.mes)}">
            ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((x) => html`<div class="cal-dow" role="columnheader">${x}</div>`)}
            ${Array.from({ length: lead }, () => html`<div class="cal-day out" aria-hidden="true"></div>`)}
            ${days.map((f) => {
              const { mine, fuera, cubro, fest } = dayInfo(f);
              const b = mine ? cat.beneficiosMap[mine.tipo] : null;
              const disabled = !selectable(f) || mine;
              const past = f < cat.hoy;
              const label = [
                fmtDate(f, { weekday: true }),
                fest ? `Festivo: ${fest.nombre}` : '',
                mine ? `${b?.nombre} (${mine.estatus})` : '',
                cubro.length ? `Cubres a ${cubro.map((c) => state.team.miembros.find((m) => m.correo === c.correo)?.nombre).join(', ')}` : '',
                fuera.length ? `${fuera.length} del equipo fuera` : '',
              ]
                .filter(Boolean)
                .join(' · ');
              return html`<button type="button" role="gridcell" data-day="${f}"
                class="cal-day ${isWeekend(f) ? 'weekend' : ''} ${fest ? 'holiday' : ''} ${f === cat.hoy ? 'today' : ''} ${past ? 'past' : ''} ${mine ? 'mine' : ''} ${mine?.estatus === 'Pendiente' ? 'pending' : ''} ${inSel(f) ? 'selecting' : ''} ${sel && (f === sel.desde || f === sel.hasta) ? 'sel-edge' : ''}"
                style="${b ? `background-color:${b.color};color:${inkFor(b.color)}` : ''}"
                aria-disabled="${disabled ? 'true' : 'false'}" aria-label="${label}" title="${label}">
                <span class="n">${Number(f.slice(8))}</span>
                ${fest ? html`<span class="h-name">${fest.nombre}</span>` : ''}
                ${mine ? html`<span class="chip-tipo">${b?.nombre}</span>` : ''}
                ${cubro.length ? html`<span class="cover" title="Eres backup este día">${icon('life-buoy')}</span>` : ''}
                ${state.verEquipo && fuera.length && !isWeekend(f) ? html`<span class="team">${icon('users')}${fuera.length}<span> fuera</span></span>` : ''}
              </button>`;
            })}
          </div>
          ${sel
            ? html`<div class="selection-bar" role="status">
                <div><b>${fmtRange(sel.desde, sel.hasta || sel.desde)}</b> · ${plural(eachDay(sel.desde, sel.hasta || sel.desde).filter(selectable).length, 'día hábil', 'días hábiles')}
                  <div class="xs" style="opacity:.8">${sel.hasta ? 'Listo para solicitar' : 'Toca el día final del rango (o solicita solo este día)'}</div></div>
                <div class="row"><button class="btn secondary sm" data-clear style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)">Cancelar</button>
                <button class="btn sm" data-request style="background:#fff;color:var(--navy)">${icon('calendar-plus')}Solicitar</button></div>
              </div>`
            : ''}
          <div class="legend" style="margin-top:16px">
            ${tiposUsados.map((t) => html`<span><span class="dot" style="background:${cat.beneficiosMap[t].color}"></span>${cat.beneficiosMap[t].nombre}</span>`)}
            <span><span class="dot" style="background:var(--holiday-ink)"></span>Festivo</span>
            <span><span class="dot" style="background:repeating-linear-gradient(135deg,#888 0 3px,#ccc 3px 6px)"></span>Pendiente de aprobar</span>
            <span>${icon('life-buoy')} Eres backup</span>
          </div>
        </section>

        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>${icon('list')}Tus días este mes</h2></div>
            <div class="list">
              ${misMes.length
                ? misMes.map(
                    (s) => html`<div class="list-item">
                      <span class="dot" style="background:${cat.beneficiosMap[s.tipo]?.color};width:12px;height:12px"></span>
                      <div class="grow"><div class="title">${cat.beneficiosMap[s.tipo]?.nombre}</div><div class="xs muted">${s.folio} · ${fmtRange(s.desde, s.hasta)} · ${plural(s.fechas.length, 'día', 'días')}</div></div>
                      ${statusBadge(s.estatus)}
                    </div>`,
                  )
                : emptyState('Sin ausencias este mes', 'calendar')}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>${icon('flag')}Festivos del mes</h2></div>
            <div class="list">
              ${festMes.length
                ? festMes.map((f) => html`<div class="list-item"><div class="grow"><div class="title">${f.nombre}</div><div class="xs muted">${fmtDate(f.fecha, { weekday: true })}</div></div><span class="tag">${f.tipo}</span></div>`)
                : emptyState('Sin festivos este mes', 'flag')}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>${icon('users')}Equipo fuera este mes</h2><a class="small" href="#/equipo?mes=${state.mes}">Mapa →</a></div>
            <div class="list">
              ${(state.team?.ausencias || []).filter((a) => a.correo !== session.user.correo).length
                ? state.team.ausencias
                    .filter((a) => a.correo !== session.user.correo)
                    .sort((a, b) => a.desde.localeCompare(b.desde))
                    .slice(0, 10)
                    .map((a) => {
                      const p = state.team.miembros.find((m) => m.correo === a.correo);
                      return html`<div class="list-item"><span class="dot" style="background:${cat.beneficiosMap[a.tipo]?.color}"></span><div class="grow"><div class="title">${p?.nombre || a.correo}</div><div class="xs muted">${fmtRange(a.desde, a.hasta)}${a.backup ? ` · Backup: ${a.backup}` : ''}</div></div>${a.estatus === 'Pendiente' ? statusBadge('Pendiente') : ''}</div>`;
                    })
                : emptyState('Nadie del equipo tiene ausencias este mes', 'users')}
            </div>
          </section>
        </div>
      </div>`,
    );
  }

  const openWith = async (desde, hasta) => {
    const r = await openRequestModal({ desde, hasta });
    state.sel = null;
    if (r) {
      await Promise.all([loadMine(), loadTeam()]);
      state.mes = r.desde.slice(0, 7);
      await loadTeam();
    }
    draw();
  };

  on(el, 'click', '[data-month]', async (e, b) => {
    state.mes = shiftMonth(state.mes, Number(b.dataset.month));
    await loadTeam();
    draw();
  });
  on(el, 'click', '[data-today]', async () => {
    state.mes = cat.hoy.slice(0, 7);
    await loadTeam();
    draw();
  });
  on(el, 'change', '[data-team]', (e) => {
    state.verEquipo = e.target.checked;
    draw();
  });
  on(el, 'click', '[data-new]', () => openWith());
  on(el, 'click', '[data-clear]', () => {
    state.sel = null;
    draw();
  });
  on(el, 'click', '[data-request]', () => openWith(state.sel.desde, state.sel.hasta || state.sel.desde));
  on(el, 'click', '[data-day]', (e, btn) => {
    const f = btn.dataset.day;
    const { mine, fest } = dayInfo(f);
    if (mine) return toast(`Ya tienes ${cat.beneficiosMap[mine.tipo]?.nombre.toLowerCase()} ese día (${mine.estatus.toLowerCase()}).`);
    if (fest) return toast(`${fmtDate(f)} es día festivo (${fest.nombre}); no necesitas solicitarlo.`);
    if (isWeekend(f)) return toast('Los fines de semana no se solicitan ni se descuentan.');
    const minDate = cat.hoy;
    if (f < minDate) return toast('Para fechas pasadas (p. ej. enfermedad) usa “Nueva solicitud” y elige el tipo.');
    if (!state.sel || state.sel.hasta) state.sel = { desde: f, hasta: null };
    else if (f < state.sel.desde) state.sel = { desde: f, hasta: state.sel.desde };
    else state.sel.hasta = f;
    draw();
    if (state.sel.hasta) el.querySelector('[data-request]')?.focus();
  });
  const onKey = (e) => {
    if (e.key === 'Escape' && state.sel && !document.querySelector('.modal-backdrop')) {
      state.sel = null;
      draw();
    }
  };
  document.addEventListener('keydown', onKey);

  await Promise.all([loadMine(), loadTeam()]);
  draw();
  if (query.nueva) openWith();
  return () => document.removeEventListener('keydown', onKey);
}
