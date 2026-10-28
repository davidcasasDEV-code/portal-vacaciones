import { html, mount, $, toast, setBusy, formData, initials } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { put } from '../api.js';
import { session } from '../state.js';
import { fmtDate } from '../ui/format.js';

export default async function perfil(el, { query, navigate }) {
  const u = session.user;
  const faltan = u.perfil_incompleto || [];
  const hoy = new Date().toISOString().slice(0, 10);
  mount(
    el,
    html`
    <div class="page-head"><div><h1>Mi perfil</h1><p>Estos datos son necesarios para calcular tus saldos y mostrar tu información al equipo.</p></div></div>
    <div class="stack">
      ${faltan.length
        ? html`<div class="alert warn" role="alert">${icon('alert')}<div><b>Completa tu información para continuar.</b> Necesitamos: ${faltan.map((f) => f.label).join(', ')}. Sin estos datos no podemos calcular tus vacaciones.</div></div>`
        : query.completar
          ? html`<div class="alert ok">${icon('check-circle')}<div>Tu perfil está completo.</div></div>`
          : ''}
      <div class="grid dash">
        <section class="card">
          <form id="pf" class="stack" novalidate>
            <div class="form-grid">
              <div class="field"><label for="p-nombre">Nombre(s) *</label><input class="input" id="p-nombre" name="nombre" required value="${u.nombre}" autocomplete="given-name" /></div>
              <div class="field"><label for="p-apellido">Apellidos *</label><input class="input" id="p-apellido" name="apellido" required value="${u.apellido}" autocomplete="family-name" /></div>
              <div class="field"><label for="p-genero">Género *</label>
                <select class="input" id="p-genero" name="genero" required><option value="">Selecciona…</option>${['Hombre', 'Mujer'].map((g) => html`<option ${u.genero === g ? 'selected' : ''}>${g}</option>`)}</select>
                <span class="hint">Define qué licencias aplican (paternidad/maternidad).</span></div>
              <div class="field"><label for="p-nac">Fecha de nacimiento *</label><input class="input" type="date" id="p-nac" name="fecha_nacimiento" required value="${u.fecha_nacimiento}" max="${hoy}" autocomplete="bday" />
                <span class="hint">Para tu día de cumpleaños y el calendario del equipo.</span></div>
              <div class="field"><label for="p-ing">Fecha de ingreso *</label>
                <input class="input" type="date" id="p-ing" name="fecha_ingreso" value="${u.fecha_ingreso}" max="${hoy}" ${u.fecha_ingreso ? 'readonly' : 'required'} />
                <span class="hint">${u.fecha_ingreso ? 'Solo un administrador puede modificarla.' : 'Con esta fecha se calcula tu antigüedad y tus vacaciones según la LFT.'}</span></div>
              <div class="field"><label for="p-puesto">Puesto</label><input class="input" id="p-puesto" name="puesto" value="${u.puesto}" autocomplete="organization-title" /></div>
              <div class="field"><label for="p-tel">Teléfono</label><input class="input" type="tel" id="p-tel" name="telefono" value="${u.telefono}" autocomplete="tel" /></div>
            </div>
            <div class="row" style="justify-content:flex-end"><button class="btn" type="submit">${icon('check')}${faltan.length ? 'Guardar y continuar' : 'Guardar cambios'}</button></div>
          </form>
        </section>
        <div class="stack">
          <section class="card stack-sm">
            <div class="row" style="flex-wrap:nowrap"><span class="avatar" style="width:52px;height:52px;font-size:1.1rem">${initials(u.nombre_completo)}</span><div style="min-width:0"><b>${u.nombre_completo}</b><div class="small muted" style="overflow-wrap:anywhere">${u.correo}</div></div></div>
            <div>
              <div class="kv"><span>Rol</span><span><span class="tag">${u.rol}</span></span></div>
              <div class="kv"><span>Torre de servicio</span><span>${u.torre || 'Sin asignar'}</span></div>
              <div class="kv"><span>Aprueba mis solicitudes</span><span>${(session.aprobadores || []).map((a) => html`<div>${a.nombre}</div>`)}${session.aprobadores?.length ? '' : '—'}</span></div>
              <div class="kv"><span>Ingreso</span><span>${fmtDate(u.fecha_ingreso)}</span></div>
            </div>
            <p class="xs muted">La torre y el rol los asigna un administrador.</p>
          </section>
          <section class="card stack-sm">
            <h3>${icon('lock')} Seguridad</h3>
            <p class="small muted">Te recomendamos cambiar tu contraseña periódicamente.</p>
            <a class="btn secondary" href="#/cambiar-password">${icon('key')}Cambiar contraseña</a>
          </section>
        </div>
      </div>
    </div>`,
  );

  $('#pf', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    setBusy(btn, true, 'Guardando…');
    try {
      const r = await put('/me', f);
      session.set({ user: r.user });
      toast('Perfil actualizado', 'ok');
      if (faltan.length && !r.user.perfil_incompleto.length) navigate('/');
      else perfil(el, { query: {}, navigate });
    } catch (err) {
      toast(err.message, 'bad');
      setBusy(btn, false);
    }
  });
}
