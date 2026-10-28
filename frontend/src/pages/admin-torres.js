import { html, mount, $, on, toast, confirmDialog, openModal, setBusy, initials, emptyState } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, post, put, del } from '../api.js';
import { loadCatalogos } from '../main.js';

export default async function adminTorres(el) {
  let [torres, usuarios] = await Promise.all([get('/admin/torres').then((r) => r.torres), get('/admin/usuarios').then((r) => r.usuarios)]);

  const reload = async () => {
    torres = (await get('/admin/torres')).torres;
    await loadCatalogos(true);
    draw();
  };

  function form(t) {
    const isNew = !t;
    t ||= { nombre: '', descripcion: '', color: '#1B4F8C', notificar: [] };
    const candidatos = usuarios.filter((u) => u.activo).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
    const m = openModal({
      title: isNew ? 'Nueva torre de servicio' : `Editar · ${t.nombre}`,
      body: html`<form id="tf" class="stack" novalidate>
        <div class="form-grid">
          <div class="field"><label for="t-nombre">Nombre *</label><input class="input" id="t-nombre" name="nombre" required value="${t.nombre}" /></div>
          <div class="field"><label for="t-color">Color</label><input class="color-input" type="color" id="t-color" name="color" value="${t.color || '#1B4F8C'}" /></div>
          <div class="field full"><label for="t-desc">Descripción</label><input class="input" id="t-desc" name="descripcion" value="${t.descripcion || ''}" /></div>
        </div>
        <div class="field">
          <span class="label">Notificar aprobaciones a</span>
          <span class="hint">Estas personas reciben un correo cada vez que se aprueba una ausencia de alguien de la torre (no aprueban; quién aprueba se define en Usuarios).</span>
          <input class="input" id="t-filter" placeholder="Buscar persona…" style="min-height:38px" aria-label="Buscar persona a notificar" />
          <div class="backup-list" id="t-list" style="max-height:260px">
            ${candidatos.map(
              (u) => html`<label class="backup-opt" data-name="${u.nombre_completo.toLowerCase()} ${u.correo}">
                <input type="checkbox" name="notificar" value="${u.correo}" ${(t.notificar || []).includes(u.correo) ? 'checked' : ''} />
                <span class="avatar sm">${initials(u.nombre_completo)}</span>
                <span class="grow"><b class="small">${u.nombre_completo}</b><br /><span class="xs muted">${u.rol}${u.torre ? ` · ${u.torre}` : ''}</span></span>
              </label>`,
            )}
          </div>
        </div>
      </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" data-save>${icon('check')}Guardar</button>`,
    });
    $('#t-filter', m.el).addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      m.el.querySelectorAll('#t-list [data-name]').forEach((l) => l.classList.toggle('hidden', !l.dataset.name.includes(q)));
    });
    m.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const f = $('#tf', m.el);
      const body = {
        nombre: f.nombre.value,
        color: f.color.value,
        descripcion: f.descripcion.value,
        notificar: [...f.querySelectorAll('input[name=notificar]:checked')].map((x) => x.value),
      };
      setBusy(e.currentTarget, true, 'Guardando…');
      try {
        if (isNew) await post('/admin/torres', body);
        else await put(`/admin/torres/${encodeURIComponent(t.id)}`, body);
        m.close();
        toast('Torre guardada', 'ok');
        usuarios = (await get('/admin/usuarios')).usuarios;
        reload();
      } catch (err) {
        toast(err.message, 'bad');
        setBusy(e.currentTarget, false);
      }
    });
  }

  async function remove(t) {
    const ok = await confirmDialog({
      title: `Eliminar ${t.nombre}`,
      message: `${t.miembros} colaborador(es) quedarán sin torre. ¿Continuar?`,
      confirmText: 'Eliminar torre',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await del(`/admin/torres/${encodeURIComponent(t.id)}`);
      toast(`Torre eliminada; ${r.desasignados} colaborador(es) sin torre`, 'ok');
      reload();
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  function draw() {
    const sinTorre = usuarios.filter((u) => u.activo && !u.torre_id);
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Torres de servicio</h1><p>Agrupan a los colaboradores, definen entre quiénes se elige el backup y a quién se avisa cuando se aprueba una ausencia.</p></div>
        <button class="btn" data-new>${icon('plus')}Nueva torre</button>
      </div>
      <div class="stack">
        ${sinTorre.length
          ? html`<div class="alert warn">${icon('info')}<div><b>${sinTorre.length} colaborador(es) activos sin torre:</b> ${sinTorre.map((u) => u.nombre_completo).join(', ')}. Pueden elegir como backup a cualquier persona. Asígnalos desde <a href="#/admin/usuarios">Usuarios</a>.</div></div>`
          : ''}
        ${torres.length
          ? html`<div class="grid cols-3">
            ${torres.map(
              (t) => html`<article class="card stack-sm" style="border-top:5px solid ${t.color}">
                <div class="row between"><h2>${t.nombre}</h2><span class="tag">${t.miembros} miembro(s)</span></div>
                ${t.descripcion ? html`<p class="small muted">${t.descripcion}</p>` : ''}
                <div class="xs muted" style="font-weight:700;margin-top:6px">SE NOTIFICA AL APROBARSE</div>
                <div class="list">
                  ${t.notificar_detalle.length
                    ? t.notificar_detalle.map((a) => html`<div class="list-item" style="padding:6px 0"><span class="avatar sm">${initials(a.nombre)}</span><div class="grow small"><b>${a.nombre}</b><div class="xs muted">${a.correo}</div></div></div>`)
                    : html`<div class="xs muted">Nadie; solo se avisa al colaborador y a sus backups.</div>`}
                </div>
                <div class="row" style="justify-content:flex-end;margin-top:auto">
                  <a class="btn ghost sm" href="#/equipo?torre=${t.id}">${icon('users')}Mapa</a>
                  <button class="btn secondary sm" data-edit="${t.id}">${icon('edit')}Editar</button>
                  <button class="icon-btn" data-del="${t.id}" aria-label="Eliminar ${t.nombre}" style="color:var(--bad)">${icon('trash')}</button>
                </div>
              </article>`,
            )}
          </div>`
          : html`<div class="card">${emptyState('Aún no hay torres de servicio. Crea la primera.', 'building')}</div>`}
      </div>`,
    );
  }

  const find = (id) => torres.find((t) => t.id === id);
  on(el, 'click', '[data-new]', () => form());
  on(el, 'click', '[data-edit]', (e, b) => form(find(b.dataset.edit)));
  on(el, 'click', '[data-del]', (e, b) => remove(find(b.dataset.del)));
  draw();
}
