import { html, mount, $, toast, setBusy, formData } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, put } from '../api.js';

export default async function adminConfig(el) {
  const { config } = await get('/admin/config');
  mount(
    el,
    html`
    <div class="page-head"><div><h1>Configuración</h1><p>Parámetros generales del portal. Las credenciales y secretos viven en DynamoDB y nunca se muestran aquí.</p></div></div>
    <div class="grid cols-2">
      <section class="card">
        <div class="card-head"><h2>${icon('mail')}Correos</h2></div>
        <form id="cfg" class="stack" novalidate>
          <div class="field"><label for="c-from">Correo remitente (Amazon SES) *</label><input class="input" type="email" id="c-from" name="ses_from" value="${config.ses_from}" required />
            <span class="hint">Debe estar verificado en Amazon SES (cuenta en modo producción).</span></div>
          <div class="field"><label for="c-name">Nombre del remitente</label><input class="input" id="c-name" name="ses_from_name" value="${config.ses_from_name}" /></div>
          <div class="field"><label for="c-url">URL pública del portal</label><input class="input" type="url" id="c-url" name="app_url" value="${config.app_url}" /><span class="hint">Se usa en los enlaces de los correos.</span></div>
          <div class="field"><label for="c-app">Nombre del portal</label><input class="input" id="c-app" name="app_name" value="${config.app_name}" /></div>
          <div class="field"><label for="c-backup">Notificar al backup</label><select class="input" id="c-backup" name="notificar_backup"><option value="si" ${config.notificar_backup !== 'no' ? 'selected' : ''}>Sí, avisar cuando lo asignan y cuando se aprueba</option><option value="no" ${config.notificar_backup === 'no' ? 'selected' : ''}>No</option></select></div>
          <div class="row" style="justify-content:flex-end"><button class="btn" type="submit">${icon('check')}Guardar</button></div>
        </form>
      </section>
      <section class="card stack-sm">
        <div class="card-head"><h2>${icon('info')}Flujo de notificaciones</h2></div>
        <div class="timeline">
          <div><b class="small">Al solicitar</b><div class="small muted">Correo al colaborador con el detalle, a su(s) aprobador(es) con enlace directo para decidir y a su backup.</div></div>
          <div><b class="small">Al aprobar o rechazar</b><div class="small muted">Correo al colaborador con el nuevo estatus y comentario; si se aprueba, también a sus backups y a quienes se notifica en su torre.</div></div>
          <div><b class="small">Al cancelar</b><div class="small muted">Correo al colaborador, aprobadores y backup.</div></div>
          <div><b class="small">Acceso</b><div class="small muted">Códigos de verificación (15 min) y contraseñas temporales.</div></div>
        </div>
        <div class="alert">${icon('building')}<div>¿Quién aprueba? Se define en <a href="#/admin/usuarios">Usuarios → Aprobadores de solicitudes</a> (aplica a todos). En <a href="#/admin/torres">Torres de servicio</a> eliges a quién solo se le avisa cuando se aprueba una ausencia de esa torre.</div></div>
      </section>
    </div>`,
  );
  $('#cfg', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    setBusy(btn, true, 'Guardando…');
    try {
      await put('/admin/config', formData(e.target));
      toast('Configuración guardada', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
    setBusy(btn, false);
  });
}
