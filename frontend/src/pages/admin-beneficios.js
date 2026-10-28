import { html, mount, $, on, toast, confirmDialog, openModal, setBusy, formData } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, put, post, del } from '../api.js';
import { loadCatalogos } from '../main.js';
import { num, fmtDateTime } from '../ui/format.js';
import { dataTable } from '../ui/table.js';

const PERIODO = { lft: 'Según LFT (antigüedad)', anual: 'Por año calendario', ilimitado: 'Sin límite' };

export default async function adminBeneficios(el, { query }) {
  let cat = await loadCatalogos(true);
  let [beneficios, adicionales, usuarios] = await Promise.all([
    get('/admin/beneficios').then((r) => r.beneficios),
    get('/admin/saldo-adicional').then((r) => r.adicionales),
    get('/admin/usuarios').then((r) => r.usuarios),
  ]);
  let tab = query.tab || 'beneficios';

  const reload = async () => {
    [beneficios, adicionales] = await Promise.all([get('/admin/beneficios').then((r) => r.beneficios), get('/admin/saldo-adicional').then((r) => r.adicionales)]);
    cat = await loadCatalogos(true);
    draw();
  };

  function editBeneficio(b) {
    const yes = (v) => (v ? 'checked' : '');
    const m = openModal({
      title: `Editar · ${b.nombre}`,
      body: html`<form id="bf" class="stack" novalidate>
        <div class="form-grid">
          <div class="field"><label for="b-nombre">Nombre</label><input class="input" id="b-nombre" name="nombre" value="${b.nombre}" /></div>
          <div class="field"><label for="b-color">Color en calendario</label><input class="color-input" type="color" id="b-color" name="color" value="${b.color}" /></div>
          <div class="field full"><label for="b-desc">Descripción (la ven los colaboradores)</label><textarea class="input" id="b-desc" name="descripcion">${b.descripcion || ''}</textarea></div>
          ${b.periodo !== 'ilimitado' && !b.descuenta_de
            ? html`<div class="field"><label for="b-dias">${b.periodo === 'lft' ? 'Días del primer año (base LFT)' : 'Días por año'}</label><input class="input" type="number" min="0" id="b-dias" name="dias" value="${b.dias}" /></div>
                <div class="field"><label for="b-min">Meses mínimos de antigüedad</label><input class="input" type="number" min="0" id="b-min" name="minimo_meses" value="${b.minimo_meses ?? 0}" /></div>`
            : ''}
          ${b.periodo === 'lft'
            ? html`<div class="field"><label for="b-ant">Anticipo a los meses mínimos</label><input class="input" type="number" min="0" id="b-ant" name="anticipo_dias" value="${b.anticipo_dias ?? 6}" /></div>
                <label class="check"><input type="checkbox" name="acumulable" ${yes(b.acumulable !== false)} /> Acumulable (los días no usados pasan al siguiente año)</label>`
            : ''}
          <div class="field"><label for="b-gen">Aplica a</label><select class="input" id="b-gen" name="genero">${['Todos', 'Hombre', 'Mujer'].map((g) => html`<option ${b.genero === g ? 'selected' : ''}>${g}</option>`)}</select></div>
          <div class="stack-sm full">
            <label class="check"><input type="checkbox" name="requiere_backup" ${yes(b.requiere_backup)} /> Requiere backup obligatorio</label>
            <label class="check"><input type="checkbox" name="permite_retroactivo" ${yes(b.permite_retroactivo)} /> Permite registrar fechas pasadas</label>
            <label class="check"><input type="checkbox" name="activo" ${yes(b.activo !== false)} /> Activo (aparece al solicitar)</label>
          </div>
        </div>
      </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" data-save>${icon('check')}Guardar</button>`,
    });
    m.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const form = $('#bf', m.el);
      const f = formData(form);
      const body = { ...f };
      for (const k of ['requiere_backup', 'permite_retroactivo', 'activo', 'acumulable']) if (form[k]) body[k] = form[k].checked;
      setBusy(e.currentTarget, true, 'Guardando…');
      try {
        await put(`/admin/beneficios/${b.clave}`, body);
        m.close();
        toast('Beneficio actualizado', 'ok');
        reload();
      } catch (err) {
        toast(err.message, 'bad');
        setBusy(e.currentTarget, false);
      }
    });
  }

  function newAjuste() {
    const tipos = beneficios.filter((b) => !b.descuenta_de && b.periodo !== 'ilimitado');
    const m = openModal({
      title: 'Nuevo ajuste de saldo',
      body: html`<form id="af" class="stack" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="a-correo">Colaborador *</label><select class="input" id="a-correo" name="correo" required><option value="">Selecciona…</option>${usuarios.filter((u) => u.activo).map((u) => html`<option value="${u.correo}">${u.nombre_completo}</option>`)}</select></div>
          <div class="field"><label for="a-tipo">Beneficio *</label><select class="input" id="a-tipo" name="tipo">${tipos.map((b) => html`<option value="${b.clave}">${b.nombre}</option>`)}</select></div>
          <div class="field"><label for="a-cant">Días (+ suma, − resta) *</label><input class="input" type="number" step="0.5" id="a-cant" name="cantidad" required placeholder="Ej. 2 o -3" /></div>
          <div class="field"><label for="a-anio">Año de vigencia</label><input class="input" type="number" id="a-anio" name="anio" value="${cat.hoy.slice(0, 4)}" /><span class="hint">Para vacaciones aplica siempre; para beneficios anuales solo ese año.</span></div>
          <div class="field full"><label for="a-motivo">Motivo *</label><input class="input" id="a-motivo" name="motivo" required placeholder="Ej. Días no disfrutados de 2025" /></div>
        </div>
      </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" data-save>${icon('check')}Guardar ajuste</button>`,
    });
    m.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      setBusy(e.currentTarget, true, 'Guardando…');
      try {
        await post('/admin/saldo-adicional', formData($('#af', m.el)));
        m.close();
        toast('Ajuste registrado', 'ok');
        reload();
      } catch (err) {
        toast(err.message, 'bad');
        setBusy(e.currentTarget, false);
      }
    });
  }

  function draw() {
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Beneficios y ajustes</h1><p>Reglas con las que se calculan los saldos y ajustes manuales por colaborador.</p></div>
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="beneficios" aria-selected="${tab === 'beneficios'}">Beneficios</button>
          <button role="tab" data-tab="ajustes" aria-selected="${tab === 'ajustes'}">Ajustes de saldo (${adicionales.length})</button>
        </div>
      </div>
      ${tab === 'beneficios'
        ? html`<div class="stack">
            <div class="alert">${icon('scale')}<div>Las <b>vacaciones</b> se calculan con la tabla del art. 76 de la LFT (12 días el primer año, +2 por año hasta 20 en el quinto, y +2 cada 5 años después). El valor “base” es el del primer año.</div></div>
            <div class="grid cols-2">
              ${beneficios.map(
                (b) => html`<article class="card stack-sm" style="border-left:5px solid ${b.color}">
                  <div class="row between"><h3>${b.nombre}</h3>${b.activo === false ? html`<span class="badge plain">Inactivo</span>` : html`<span class="badge Aprobado plain">Activo</span>`}</div>
                  <p class="small muted">${b.descripcion || ''}</p>
                  <div class="row" style="gap:6px">
                    <span class="tag">${b.descuenta_de ? `Descuenta ${num(b.factor)} de ${cat.beneficiosMap[b.descuenta_de]?.nombre}` : PERIODO[b.periodo]}</span>
                    ${b.periodo !== 'ilimitado' && !b.descuenta_de ? html`<span class="tag">${b.dias} días${b.periodo === 'lft' ? ' (año 1)' : '/año'}</span>` : ''}
                    ${b.genero && b.genero !== 'Todos' ? html`<span class="tag">Solo ${b.genero.toLowerCase()}s</span>` : ''}
                    ${b.requiere_backup ? html`<span class="tag">${icon('life-buoy')}Backup</span>` : ''}
                    ${b.permite_retroactivo ? html`<span class="tag">Retroactivo</span>` : ''}
                    ${b.periodo === 'lft' ? html`<span class="tag">${b.acumulable !== false ? 'Acumulable' : 'No acumulable'}</span>` : ''}
                  </div>
                  <div class="row" style="justify-content:flex-end"><button class="btn secondary sm" data-edit="${b.clave}">${icon('edit')}Editar</button></div>
                </article>`,
              )}
            </div>
          </div>`
        : html`<div class="stack"><div class="row" style="justify-content:flex-end"><button class="btn" data-new-ajuste>${icon('plus')}Nuevo ajuste</button></div><div id="tbl"></div></div>`}`,
    );
    if (tab === 'ajustes') {
      dataTable($('#tbl', el), {
        rows: adicionales,
        exportName: 'ajustes-saldo',
        columns: [
          { key: 'nombre', label: 'Colaborador' },
          { key: 'tipo', label: 'Beneficio', value: (a) => cat.beneficiosMap[a.tipo]?.nombre || a.tipo },
          { key: 'cantidad', label: 'Días', num: true, render: (a) => html`<b style="color:${a.cantidad > 0 ? 'var(--ok)' : 'var(--bad)'}">${a.cantidad > 0 ? '+' : ''}${num(a.cantidad)}</b>` , value: (a) => a.cantidad },
          { key: 'anio', label: 'Año' },
          { key: 'motivo', label: 'Motivo' },
          { key: 'creado', label: 'Registrado', render: (a) => html`<span class="xs muted">${fmtDateTime(a.creado)} · ${a.creado_por || ''}</span>` },
          { key: 'acc', label: '', sortable: false, csv: () => '', render: (a) => html`<button class="icon-btn" data-del="${a.id}" aria-label="Eliminar ajuste" style="color:var(--bad)">${icon('trash')}</button>` },
        ],
      });
    }
  }

  on(el, 'click', '[data-tab]', (e, b) => {
    tab = b.dataset.tab;
    draw();
  });
  on(el, 'click', '[data-edit]', (e, b) => editBeneficio(beneficios.find((x) => x.clave === b.dataset.edit)));
  on(el, 'click', '[data-new-ajuste]', newAjuste);
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmDialog({ title: 'Eliminar ajuste', message: 'El saldo del colaborador se recalculará sin este ajuste.', confirmText: 'Eliminar', danger: true }))) return;
    try {
      await del(`/admin/saldo-adicional/${encodeURIComponent(b.dataset.del)}`);
      toast('Ajuste eliminado', 'ok');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
  draw();
}
