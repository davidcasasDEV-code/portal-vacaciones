import { html, mount, openModal, $, toast, setBusy } from './dom.js';
import { icon } from './icons.js';
import { fmtDate, num, plural } from './format.js';
import { post } from '../api.js';
import { session } from '../state.js';
import { loadCatalogos } from '../main.js';

export async function openRequestModal({ desde, hasta, tipo } = {}) {
  const cat = await loadCatalogos();
  const tipos = cat.mis_beneficios.map((k) => cat.beneficiosMap[k]).filter(Boolean);
  const hoy = cat.hoy;
  const state = { tipo: tipo || 'vacaciones', desde: desde || '', hasta: hasta || desde || '', backups: [], filtro: '', preview: null, seq: 0 };

  return new Promise((resolve) => {
    const m = openModal({
      title: 'Nueva solicitud',
      size: 'lg',
      body: html`
        <form id="rq" class="stack" novalidate>
          <div class="form-grid">
            <div class="field full">
              <label for="rq-tipo">Tipo de ausencia</label>
              <select class="input" id="rq-tipo" name="tipo">
                ${tipos.map((b) => html`<option value="${b.clave}" ${b.clave === state.tipo ? 'selected' : ''}>${b.nombre}</option>`)}
              </select>
              <span class="hint" id="rq-desc"></span>
            </div>
            <div class="field">
              <label for="rq-desde">Desde</label>
              <input class="input" type="date" id="rq-desde" name="desde" value="${state.desde}" required />
            </div>
            <div class="field">
              <label for="rq-hasta">Hasta</label>
              <input class="input" type="date" id="rq-hasta" name="hasta" value="${state.hasta}" required />
            </div>
          </div>
          <div id="rq-preview"><div class="skeleton" style="height:90px"></div></div>
          <div class="field" id="rq-backup-wrap">
            <span class="label" id="rq-backup-label">Backups (quién te cubre) *</span>
            <input class="input" id="rq-backup-filter" placeholder="Buscar compañero…" aria-label="Buscar backup" style="min-height:38px" />
            <div class="backup-list" id="rq-backups" role="group" aria-labelledby="rq-backup-label"></div>
            <span class="hint" id="rq-backup-hint"></span>
          </div>
          <div class="field">
            <label for="rq-nota">Comentarios para tu aprobador (opcional)</label>
            <textarea class="input" id="rq-nota" name="descripcion" maxlength="500" placeholder="Ej. viaje familiar, trámite, etc."></textarea>
          </div>
        </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" id="rq-send" disabled>${icon('check')}Enviar solicitud</button>`,
      onClose: (r) => resolve(r || null),
    });

    const el = m.el;
    const form = $('#rq', el);
    const sendBtn = $('#rq-send', el);

    const syncLimits = () => {
      const b = cat.beneficiosMap[state.tipo];
      const min = b?.permite_retroactivo ? '' : hoy;
      $('#rq-desde', el).min = min;
      $('#rq-hasta', el).min = state.desde || min;
      mount($('#rq-desc', el), b?.descripcion || '');
      if (b?.un_solo_dia) {
        state.hasta = state.desde;
        $('#rq-hasta', el).value = state.desde;
      }
      $('#rq-hasta', el).disabled = Boolean(b?.un_solo_dia);
    };

    const renderBackups = () => {
      const p = state.preview;
      const wrap = $('#rq-backups', el);
      if (!p) return;
      $('#rq-backup-label', el).textContent = `Backups (quién te cubre) * · ${state.backups.length ? `${state.backups.length} seleccionado(s)` : 'elige al menos uno'}`;
      const f = state.filtro.toLowerCase();
      const list = p.backups.filter((b) => !f || b.nombre.toLowerCase().includes(f));
      mount(
        wrap,
        list.length
          ? list.map(
              (b) => html`<label class="backup-opt ${b.disponible ? '' : 'unavailable'}">
                <input type="checkbox" name="backup" value="${b.correo}" ${state.backups.includes(b.correo) ? 'checked' : ''} ${b.disponible ? '' : 'disabled'} />
                <span class="avatar sm">${b.nombre.split(' ').slice(0, 2).map((x) => x[0]).join('')}</span>
                <span class="grow"><b class="small">${b.nombre}</b><br /><span class="xs muted">${b.disponible ? b.torre || 'Disponible' : b.motivo}</span></span>
                ${b.disponible ? html`<span class="badge Aprobado plain">Disponible</span>` : html`<span class="badge plain">No disponible</span>`}
              </label>`,
            )
          : html`<div class="muted small">No hay compañeros que coincidan.</div>`,
      );
      mount(
        $('#rq-backup-hint', el),
        session.user?.torre
          ? `Se muestran compañeros de tu torre (${session.user.torre}). Quien sea tu backup no podrá pedir ausencias esos días.`
          : 'No tienes torre asignada, por lo que puedes elegir a cualquier colaborador.',
      );
    };

    const renderPreview = () => {
      const p = state.preview;
      const box = $('#rq-preview', el);
      if (!p) return;
      const b = cat.beneficiosMap[state.tipo];
      const s = p.saldo;
      const ilimitado = !s || s.ilimitado;
      const despuesBad = !ilimitado && p.saldo_despues < 0;
      const errores = p.errores.filter((e) => !/Selecciona al menos una persona/.test(e));
      mount(
        box,
        html`
        <div class="stack-sm">
          <div class="summary">
            <div><div class="l">Días hábiles</div><div class="v">${p.fechas.length}</div></div>
            <div><div class="l">${b?.descuenta_de ? `Descuenta de ${cat.beneficiosMap[b.descuenta_de]?.nombre}` : 'Disponibles hoy'}</div><div class="v">${ilimitado ? '∞' : num(s.disponible)}</div></div>
            <div class="${ilimitado ? '' : despuesBad ? 'bad' : 'good'}"><div class="l">Te quedarían</div><div class="v">${ilimitado ? '—' : num(p.saldo_despues)}</div></div>
          </div>
          ${p.fechas.length || p.festivos_en_rango.length
            ? html`<div class="date-chips" aria-label="Días que se descuentan">
                ${p.fechas.map((f) => html`<span>${fmtDate(f, { year: false, weekday: true })}</span>`)}
                ${p.festivos_en_rango.map((f) => html`<span class="off" title="${f.nombre}">${fmtDate(f.fecha, { year: false })} · ${f.nombre}</span>`)}
              </div>`
            : ''}
          ${errores.length ? html`<div class="alert bad" role="alert">${icon('alert')}<div><b>No se puede enviar todavía</b><ul>${errores.map((e) => html`<li>${e}</li>`)}</ul></div></div>` : ''}
          ${p.advertencias.length ? html`<div class="alert warn">${icon('info')}<div>${p.advertencias.map((a) => html`<div>${a}</div>`)}
              ${p.companeros_fuera.length ? html`<div class="xs" style="margin-top:4px">${p.companeros_fuera.map((c) => `${c.nombre} (${fmtDate(c.desde, { year: false })}–${fmtDate(c.hasta, { year: false })})`).join(' · ')}</div>` : ''}</div></div>` : ''}
          <div class="small muted">${icon('check-circle')} Se enviará a: <b>${p.aprobadores.map((a) => a.nombre).join(', ') || 'Administradores'}</b></div>
        </div>`,
      );
      sendBtn.disabled = p.errores.length > 0;
      sendBtn.innerHTML = '';
      mount(sendBtn, html`${icon('check')}Enviar solicitud${p.dias_descuento ? ` (${plural(p.dias_descuento, 'día', 'días')})` : ''}`);
    };

    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!state.desde) {
          mount($('#rq-preview', el), html`<div class="alert">${icon('info')}<div>Elige las fechas para ver tus días disponibles.</div></div>`);
          return;
        }
        const seq = ++state.seq;
        try {
          const p = await post('/solicitudes/preview', { tipo: state.tipo, desde: state.desde, hasta: state.hasta || state.desde, backups: state.backups });
          if (seq !== state.seq) return;
          state.preview = p;
          const disponibles = new Set(p.backups.filter((b) => b.disponible).map((b) => b.correo));
          if (state.backups.some((c) => !disponibles.has(c))) {
            state.backups = state.backups.filter((c) => disponibles.has(c));
            return refresh();
          }
          renderPreview();
          renderBackups();
        } catch (e) {
          mount($('#rq-preview', el), html`<div class="alert bad">${icon('alert')}<div>${e.message}</div></div>`);
        }
      }, 220);
    };

    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'tipo') state.tipo = t.value;
      if (t.name === 'desde') {
        state.desde = t.value;
        if (!state.hasta || state.hasta < state.desde) {
          state.hasta = state.desde;
          $('#rq-hasta', el).value = state.desde;
        }
      }
      if (t.name === 'hasta') state.hasta = t.value;
      if (t.name === 'backup') state.backups = [...form.querySelectorAll('input[name=backup]:checked')].map((x) => x.value).concat(state.backups.filter((c) => !form.querySelector(`input[name=backup][value="${c}"]`)));
      if (['tipo', 'desde', 'hasta', 'backup'].includes(t.name)) {
        syncLimits();
        refresh();
      }
    });
    $('#rq-backup-filter', el).addEventListener('input', (e) => {
      state.filtro = e.target.value;
      renderBackups();
    });

    sendBtn.addEventListener('click', async () => {
      setBusy(sendBtn, true, 'Enviando…');
      try {
        const r = await post('/solicitudes', {
          tipo: state.tipo,
          desde: state.desde,
          hasta: state.hasta || state.desde,
          backups: state.backups,
          descripcion: $('#rq-nota', el).value,
        });
        toast(html`<b>Solicitud ${r.solicitud.folio} enviada.</b><br>Te enviamos el detalle por correo y avisamos a ${r.aprobadores.map((a) => a.nombre).join(', ')}.`, 'ok', 8000);
        m.close(r.solicitud);
      } catch (e) {
        toast(e.message, 'bad');
        setBusy(sendBtn, false);
        refresh();
      }
    });

    syncLimits();
    refresh();
  });
}
