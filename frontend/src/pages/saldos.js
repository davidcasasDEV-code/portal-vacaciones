import { html, mount, $, emptyState } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../api.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, num, MESES_C } from '../ui/format.js';
import { session } from '../state.js';
import { stackedBar } from '../ui/charts.js';

export default async function saldos(el) {
  const [d, cat] = await Promise.all([get('/saldo'), loadCatalogos()]);
  const v = d.saldos.find((s) => s.clave === 'vacaciones');
  const info = d.vacaciones;
  const ant = info?.antiguedad;
  const otros = d.saldos.filter((s) => s.clave !== 'vacaciones');
  const tramoActual = ant ? d.lft.find((t) => ant.anios + 1 >= t.desde && ant.anios + 1 <= t.hasta) : null;
  const diasAlAniv = info?.proximo ? Math.round((new Date(`${info.proximo.fecha}T00:00:00Z`) - new Date(`${d.hoy}T00:00:00Z`)) / 86400000) : null;

  const bar = (s) => {
    const total = Math.max(s.otorgado + s.adicional, s.usado + s.agendado + s.pendiente, 1);
    const seg = (n, color, label) => (n > 0 ? html`<span style="width:${(n / total) * 100}%;background:${color}" title="${label}: ${num(n)}"></span>` : '');
    return html`<div class="progress" style="height:12px" role="img" aria-label="Usados ${num(s.usado)}, agendados ${num(s.agendado)}, pendientes ${num(s.pendiente)}, disponibles ${num(s.disponible)}">
      ${seg(s.usado, 'var(--neutral)', 'Usados')}${seg(s.agendado, s.color, 'Agendados')}${seg(s.pendiente, 'var(--warn)', 'Pendientes')}${seg(Math.max(0, s.disponible), 'color-mix(in srgb, ' + s.color + ' 25%, transparent)', 'Disponibles')}
    </div>`;
  };

  mount(
    el,
    html`
    <div class="page-head">
      <div><h1>Saldos y beneficios</h1><p>Cómo se calcula cada saldo, cuánto has usado y lo que tienes por disfrutar.</p></div>
      <a class="btn" href="#/calendario">${icon('calendar-plus')}Solicitar días</a>
    </div>
    <div class="stack">
      ${v
        ? html`<section class="card">
          <div class="grid cols-2" style="align-items:center">
            <div class="stack-sm">
              <div class="kpi-label muted small" style="font-weight:700">${icon('umbrella')} VACACIONES DISPONIBLES</div>
              <div style="font-size:3rem;font-weight:800;line-height:1;color:${v.color}">${num(v.disponible)} <span style="font-size:1rem;color:var(--muted)">días</span></div>
              ${bar(v)}
              <div class="legend">
                <span><span class="dot" style="background:var(--neutral)"></span>Usados ${num(v.usado)}</span>
                <span><span class="dot" style="background:${v.color}"></span>Agendados ${num(v.agendado)}</span>
                <span><span class="dot" style="background:var(--warn)"></span>Pendientes ${num(v.pendiente)}</span>
                <span><span class="dot" style="background:color-mix(in srgb, ${v.color} 25%, transparent)"></span>Disponibles ${num(v.disponible)}</span>
              </div>
            </div>
            <div class="grid cols-2" style="gap:12px">
              <div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="xs muted" style="font-weight:700">Antigüedad</div><b style="font-size:1.2rem">${ant ? `${ant.anios} a ${ant.meses} m` : '—'}</b><div class="xs muted">Ingreso ${fmtDate(session.user.fecha_ingreso)}</div></div>
              <div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="xs muted" style="font-weight:700">Otorgados (acumulado)</div><b style="font-size:1.2rem">${num(v.otorgado)}</b>${v.adicional ? html`<div class="xs muted">+ ${num(v.adicional)} de ajustes</div>` : html`<div class="xs muted">${info?.acumulable ? 'Acumulable' : 'Año en curso'}</div>`}</div>
              <div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="xs muted" style="font-weight:700">Próximo aniversario</div><b style="font-size:1.2rem">${info?.proximo ? fmtDate(info.proximo.fecha) : '—'}</b>${diasAlAniv != null ? html`<div class="xs muted">En ${diasAlAniv} días</div>` : ''}</div>
              <div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="xs muted" style="font-weight:700">Ese día sumas</div><b style="font-size:1.2rem">${info?.proximo ? `+${info.proximo.dias} días` : '—'}</b><div class="xs muted">${info?.proximo ? `Año ${info.proximo.anio_servicio} de servicio` : ''}</div></div>
            </div>
          </div>
        </section>`
        : ''}

      <div class="grid cols-2">
        <section class="card">
          <div class="card-head"><h2>${icon('scale')}Tabla de vacaciones (LFT art. 76)</h2></div>
          <p class="small muted" style="margin-bottom:10px">Reforma 2023 “Vacaciones dignas”. ${info?.acumulable ? 'En Go Productivity los días no disfrutados se acumulan año con año.' : ''} A los 6 meses de antigüedad se otorga un anticipo.</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Años de servicio</th><th class="num">Días</th></tr></thead>
            <tbody>
              ${d.lft.slice(0, 9).map(
                (t) => html`<tr style="${t === tramoActual ? 'background:var(--primary-soft);font-weight:800' : ''}">
                  <td>${t.desde === t.hasta ? `Año ${t.desde}` : `Años ${t.desde} a ${t.hasta}`}${t === tramoActual ? html` <span class="tag">Tu siguiente año</span>` : ''}</td>
                  <td class="num">${t.dias}</td></tr>`,
              )}
            </tbody>
          </table></div>
        </section>
        <section class="card">
          <div class="card-head"><h2>${icon('award')}Tus años de servicio</h2></div>
          ${info?.desglose?.length
            ? html`<div class="table-wrap"><table class="data">
                <thead><tr><th>Año</th><th>Cumplido el</th><th class="num">Días otorgados</th></tr></thead>
                <tbody>${info.desglose.map((r) => html`<tr><td>Año ${r.anio_servicio}</td><td>${fmtDate(r.fecha)}</td><td class="num">${r.dias}</td></tr>`)}</tbody>
                <tfoot><tr><td colspan="2"><b>Total</b></td><td class="num"><b>${info.desglose.reduce((a, r) => a + r.dias, 0)}</b></td></tr></tfoot>
              </table></div>`
            : emptyState(ant && ant.totalMeses >= 6 ? 'Aún no cumples tu primer año: tienes el anticipo de 6 meses.' : 'Aún no cumples tu primer año de servicio.', 'award')}
        </section>
      </div>

      <section>
        <h2 style="margin-bottom:12px">Otros beneficios</h2>
        <div class="grid cols-3">
          ${otros.map((s) => {
            const b = cat.beneficiosMap[s.clave];
            return html`<div class="card stack-sm">
              <div class="row between"><b>${s.nombre}</b>${s.ilimitado ? html`<span class="tag">Sin límite</span>` : html`<span class="tag">${b?.periodo === 'anual' ? `Anual ${d.hoy.slice(0, 4)}` : ''}</span>`}</div>
              ${s.ilimitado
                ? html`<div class="kpi-value" style="font-size:1.6rem">${num(s.usado + s.agendado + s.pendiente)} <small class="muted" style="font-size:.85rem">días registrados este año</small></div>`
                : html`<div class="kpi-value" style="font-size:1.6rem;color:${s.color}">${num(s.disponible)} <small class="muted" style="font-size:.85rem">de ${num(s.otorgado + s.adicional)} disponibles</small></div>${bar(s)}`}
              <p class="xs muted">${b?.descripcion || ''}</p>
            </div>`;
          })}
        </div>
      </section>

      <div class="grid cols-2">
        <section class="card">
          <div class="card-head"><h2>${icon('chart')}Tus días por mes · ${d.hoy.slice(0, 4)}</h2></div>
          <div class="chart-box"><canvas id="ch-mes" aria-label="Días de ausencia por mes"></canvas></div>
        </section>
        <section class="card">
          <div class="card-head"><h2>${icon('sliders')}Ajustes de saldo</h2></div>
          ${d.adicionales.length
            ? html`<div class="list">${d.adicionales.map(
                (a) => html`<div class="list-item"><div class="grow"><div class="title">${a.cantidad > 0 ? '+' : ''}${num(a.cantidad)} · ${cat.beneficiosMap[a.tipo]?.nombre || a.tipo}</div><div class="xs muted">${a.motivo} · ${a.anio}</div></div></div>`,
              )}</div>`
            : emptyState('No tienes ajustes de saldo', 'sliders')}
        </section>
      </div>

      <section class="card flush">
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Beneficio</th><th class="num">Otorgado</th><th class="num">Ajustes</th><th class="num">Usado</th><th class="num">Agendado</th><th class="num">Pendiente</th><th class="num">Disponible</th></tr></thead>
          <tbody>${d.saldos.map(
            (s) => html`<tr><td><span class="row" style="gap:8px"><span class="dot" style="background:${s.color}"></span>${s.nombre}</span></td>
              <td class="num">${s.ilimitado ? '—' : num(s.otorgado)}</td><td class="num">${num(s.adicional)}</td><td class="num">${num(s.usado)}</td>
              <td class="num">${num(s.agendado)}</td><td class="num">${num(s.pendiente)}</td><td class="num"><b>${s.ilimitado ? '∞' : num(s.disponible)}</b></td></tr>`,
          )}</tbody>
        </table></div>
      </section>
    </div>`,
  );

  const tipos = [...new Set(d.por_mes.flatMap((m) => Object.keys(m.tipos)))];
  stackedBar(
    $('#ch-mes', el),
    MESES_C,
    tipos.map((t) => ({ label: cat.beneficiosMap[t]?.nombre || t, data: d.por_mes.map((m) => m.tipos[t] || 0), backgroundColor: cat.beneficiosMap[t]?.color })),
  );
}

