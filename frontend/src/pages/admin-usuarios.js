import { html, mount, $, on, toast, confirmDialog, openModal, setBusy, formData, initials } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, post, put, del } from '../api.js';
import { session } from '../state.js';
import { loadCatalogos } from '../main.js';
import { fmtDate, fmtDateTime } from '../ui/format.js';
import { dataTable } from '../ui/table.js';

const ROLES = [
  { value: 'Usuario', label: 'Usuario — solicita y consulta' },
  { value: 'Aprobador', label: 'Aprobador — aprueba y ve reportes de sus torres' },
  { value: 'Admin', label: 'Admin — acceso total' },
];

export default async function adminUsuarios(el) {
  const cat = await loadCatalogos(true);
  let usuarios = (await get('/admin/usuarios')).usuarios;

  const reload = async () => {
    usuarios = (await get('/admin/usuarios')).usuarios;
    draw();
  };

  function showTemp(correo, temp) {
    const m = openModal({
      title: 'Contraseña temporal generada',
      size: 'sm',
      body: html`<div class="stack-sm">
        <p>Compártela de forma segura con <b>${correo}</b> (también se le envió por correo). Se le pedirá cambiarla al entrar.</p>
        <div class="input mono" style="font-size:1.3rem;text-align:center;user-select:all">${temp}</div>
        <p class="xs muted">Por seguridad no se volverá a mostrar.</p></div>`,
      footer: html`<button class="btn secondary" data-copy>${icon('check')}Copiar</button><button class="btn" data-close>Listo</button>`,
    });
    m.el.querySelector('[data-copy]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(temp);
        toast('Copiada al portapapeles', 'ok');
      } catch {
        toast('No se pudo copiar; selecciónala manualmente', 'bad');
      }
    });
  }

  function userForm(u) {
    const isNew = !u;
    u ||= { rol: 'Usuario', activo: true };
    const approverOpts = usuarios.filter((x) => x.correo !== u.correo && x.activo && x.rol !== 'Usuario');
    const m = openModal({
      title: isNew ? 'Nuevo usuario' : `Editar · ${u.nombre_completo}`,
      size: 'lg',
      body: html`<form id="uf" class="stack" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="u-correo">Correo *</label><input class="input" id="u-correo" name="correo" type="email" required value="${u.correo || ''}" ${isNew ? '' : 'readonly'} /></div>
          <div class="field"><label for="u-nombre">Nombre(s)</label><input class="input" id="u-nombre" name="nombre" value="${u.nombre || ''}" /></div>
          <div class="field"><label for="u-apellido">Apellidos</label><input class="input" id="u-apellido" name="apellido" value="${u.apellido || ''}" /></div>
          <div class="field"><label for="u-rol">Rol *</label><select class="input" id="u-rol" name="rol">${ROLES.map((r) => html`<option value="${r.value}" ${u.rol === r.value ? 'selected' : ''}>${r.label}</option>`)}</select></div>
          <div class="field"><label for="u-torre">Torre de servicio</label><select class="input" id="u-torre" name="torre_id"><option value="">Sin torre</option>${cat.torres.map((t) => html`<option value="${t.id}" ${u.torre_id === t.id ? 'selected' : ''}>${t.nombre}</option>`)}</select></div>
          <div class="field"><label for="u-genero">Género</label><select class="input" id="u-genero" name="genero"><option value="">Sin capturar</option>${['Hombre', 'Mujer'].map((g) => html`<option ${u.genero === g ? 'selected' : ''}>${g}</option>`)}</select></div>
          <div class="field"><label for="u-puesto">Puesto</label><input class="input" id="u-puesto" name="puesto" value="${u.puesto || ''}" /></div>
          <div class="field"><label for="u-ingreso">Fecha de ingreso</label><input class="input" id="u-ingreso" name="fecha_ingreso" type="date" value="${u.fecha_ingreso || ''}" /><span class="hint">Define su saldo de vacaciones según la LFT.</span></div>
          <div class="field"><label for="u-nac">Fecha de nacimiento</label><input class="input" id="u-nac" name="fecha_nacimiento" type="date" value="${u.fecha_nacimiento || ''}" /></div>
          <div class="field full"><label for="u-aprob">Aprobador específico (excepción)</label>
            <select class="input" id="u-aprob" name="aprobador_correo"><option value="">Usar los aprobadores de su torre</option>${approverOpts.map((a) => html`<option value="${a.correo}" ${u.aprobador_correo === a.correo ? 'selected' : ''}>${a.nombre_completo} (${a.rol})</option>`)}</select>
            <span class="hint">Si lo dejas vacío, sus solicitudes llegan a los aprobadores de su torre; sin torre, a los administradores.</span></div>
          <label class="check full"><input type="checkbox" name="activo" ${u.activo !== false ? 'checked' : ''} /> Usuario activo (puede iniciar sesión)</label>
          ${isNew
            ? html`<div class="field full"><span class="label">Acceso inicial</span>
                <label class="check"><input type="radio" name="modo_password" value="bienvenida" checked /> Enviar correo de bienvenida para que cree su contraseña con un código</label>
                <label class="check"><input type="radio" name="modo_password" value="temporal" /> Generar una contraseña temporal (se le pedirá cambiarla)</label></div>`
            : ''}
        </div>
      </form>`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn" data-save>${icon('check')}${isNew ? 'Crear usuario' : 'Guardar cambios'}</button>`,
    });
    m.el.querySelector('[data-save]').addEventListener('click', async (e) => {
      const f = formData($('#uf', m.el));
      const body = { ...f, activo: Boolean(f.activo) };
      const btn = e.currentTarget;
      setBusy(btn, true, 'Guardando…');
      try {
        if (isNew) {
          const r = await post('/admin/usuarios', body);
          m.close();
          toast(`Usuario ${r.usuario.correo} creado`, 'ok');
          if (r.password_temporal) showTemp(r.usuario.correo, r.password_temporal);
        } else {
          await put(`/admin/usuarios/${encodeURIComponent(u.correo)}`, body);
          m.close();
          toast('Cambios guardados', 'ok');
          if (u.correo === session.user.correo) location.reload();
        }
        reload();
      } catch (err) {
        toast(err.message, 'bad');
        setBusy(btn, false);
      }
    });
  }

  function passwordMenu(u) {
    const m = openModal({
      title: `Acceso de ${u.nombre_completo}`,
      size: 'sm',
      body: html`<div class="stack-sm">
        <p class="small muted">${u.tiene_password ? 'Tiene contraseña registrada.' : 'Aún no ha creado su contraseña.'} Último acceso: ${fmtDateTime(u.ultimo_acceso)}.</p>
        <button class="btn secondary block" data-mode="temporal">${icon('key')}Resetear con contraseña temporal</button>
        <button class="btn secondary block" data-mode="forzar">${icon('refresh')}Forzar cambio en su próximo acceso</button>
        <button class="btn secondary block" data-mode="desbloquear">${icon('unlock')}Desbloquear (intentos fallidos)</button>
      </div>`,
    });
    m.el.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', async () => {
        setBusy(b, true);
        try {
          const r = await post(`/admin/usuarios/${encodeURIComponent(u.correo)}/password`, { modo: b.dataset.mode });
          m.close();
          toast(r.mensaje, 'ok');
          if (r.password_temporal) showTemp(u.correo, r.password_temporal);
          reload();
        } catch (e) {
          toast(e.message, 'bad');
          setBusy(b, false);
        }
      }),
    );
  }

  async function remove(u) {
    const ok = await confirmDialog({
      title: 'Eliminar usuario',
      message: `¿Eliminar definitivamente a ${u.nombre_completo} (${u.correo})? Su historial de solicitudes se conserva en reportes. Si solo quieres impedir su acceso, mejor desactívalo.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/admin/usuarios/${encodeURIComponent(u.correo)}`);
      toast('Usuario eliminado', 'ok');
      reload();
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  function draw() {
    const activos = usuarios.filter((u) => u.activo);
    const incompletos = activos.filter((u) => u.perfil_incompleto.length);
    const sinPass = activos.filter((u) => !u.tiene_password);
    mount(
      el,
      html`
      <div class="page-head">
        <div><h1>Usuarios</h1><p>Altas, roles, torres, aprobadores y acceso de cada colaborador.</p></div>
        <button class="btn" data-new>${icon('plus')}Nuevo usuario</button>
      </div>
      <div class="stack">
        <div class="grid cols-4">
          <div class="card kpi"><div class="kpi-label">${icon('users')}Activos</div><div class="kpi-value">${activos.length}</div><div class="kpi-foot">${usuarios.length - activos.length} inactivos</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('shield')}Admins / Aprobadores</div><div class="kpi-value">${usuarios.filter((u) => u.rol === 'Admin').length} / ${usuarios.filter((u) => u.rol === 'Aprobador').length}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('alert')}Perfil incompleto</div><div class="kpi-value" style="color:var(--warn)">${incompletos.length}</div><div class="kpi-foot">Se les pedirá completarlo al entrar</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('key')}Sin contraseña</div><div class="kpi-value">${sinPass.length}</div><div class="kpi-foot">Deben activar su cuenta</div></div>
        </div>
        <div id="tbl"></div>
      </div>`,
    );
    dataTable($('#tbl', el), {
      rows: usuarios,
      exportName: 'usuarios',
      pageSize: 20,
      filters: [
        { key: 'rol', label: 'Rol', options: ROLES.map((r) => ({ value: r.value, label: r.value })) },
        { key: 'torre', label: 'Torre', options: [...cat.torres.map((t) => ({ value: t.nombre, label: t.nombre })), { value: '__none', label: 'Sin torre' }], match: (r, v) => (v === '__none' ? !r.torre : r.torre === v) },
        { key: 'estado', label: 'Estado', options: [{ value: 'activo', label: 'Activos' }, { value: 'inactivo', label: 'Inactivos' }, { value: 'incompleto', label: 'Perfil incompleto' }], match: (r, v) => (v === 'activo' ? r.activo : v === 'inactivo' ? !r.activo : r.perfil_incompleto.length > 0) },
      ],
      columns: [
        { key: 'nombre_completo', label: 'Colaborador', render: (u) => html`<div class="row" style="gap:10px;flex-wrap:nowrap"><span class="avatar sm">${initials(u.nombre_completo)}</span><div><b>${u.nombre_completo}</b>${u.activo ? '' : html` <span class="badge plain">Inactivo</span>`}<div class="xs muted">${u.correo}</div></div></div>` },
        { key: 'rol', label: 'Rol', render: (u) => html`<span class="tag">${u.rol}</span>` },
        { key: 'torre', label: 'Torre', value: (u) => u.torre || '—' },
        { key: 'aprobadores', label: 'Aprueba(n)', value: (u) => u.aprobadores.join(', '), render: (u) => html`<span class="small">${u.aprobador_correo ? html`<span class="tag">Excepción</span> ` : ''}${u.aprobadores.join(', ') || '—'}</span>` },
        { key: 'fecha_ingreso', label: 'Ingreso', render: (u) => (u.fecha_ingreso ? fmtDate(u.fecha_ingreso) : '—'), value: (u) => u.fecha_ingreso || '' },
        { key: 'perfil', label: 'Perfil', value: (u) => (u.perfil_incompleto.length ? 'Incompleto' : 'Completo'), render: (u) => (u.perfil_incompleto.length ? html`<span class="badge Pendiente" title="Falta: ${u.perfil_incompleto.map((p) => p.label).join(', ')}">Falta ${u.perfil_incompleto.length}</span>` : html`<span class="badge Aprobado">Completo</span>`) },
        { key: 'acceso', label: 'Acceso', value: (u) => (u.tiene_password ? 'Activo' : 'Sin contraseña'), render: (u) => (u.debe_cambiar_password ? html`<span class="badge Pendiente plain">Cambio forzado</span>` : u.tiene_password ? html`<span class="xs muted">${u.ultimo_acceso ? fmtDateTime(u.ultimo_acceso) : 'Nunca ha entrado'}</span>` : html`<span class="badge plain">Sin contraseña</span>`) },
        {
          key: 'acc',
          label: '',
          sortable: false,
          csv: () => '',
          render: (u) => html`<div class="row" style="gap:2px;flex-wrap:nowrap;justify-content:flex-end">
            <button class="icon-btn" data-edit="${u.correo}" title="Editar" aria-label="Editar ${u.nombre_completo}">${icon('edit')}</button>
            <button class="icon-btn" data-pass="${u.correo}" title="Contraseña y acceso" aria-label="Contraseña de ${u.nombre_completo}">${icon('key')}</button>
            ${u.correo !== session.user.correo ? html`<button class="icon-btn" data-del="${u.correo}" title="Eliminar" aria-label="Eliminar ${u.nombre_completo}" style="color:var(--bad)">${icon('trash')}</button>` : ''}
          </div>`,
        },
      ],
    });
  }

  const find = (c) => usuarios.find((u) => u.correo === c);
  on(el, 'click', '[data-new]', () => userForm());
  on(el, 'click', '[data-edit]', (e, b) => userForm(find(b.dataset.edit)));
  on(el, 'click', '[data-pass]', (e, b) => passwordMenu(find(b.dataset.pass)));
  on(el, 'click', '[data-del]', (e, b) => remove(find(b.dataset.del)));
  draw();
}
