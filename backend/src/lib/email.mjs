import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { getConfig } from './config.mjs';

const ses = new SESv2Client({});

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`;
};

const STATUS_COLOR = { Pendiente: '#B7791F', Aprobado: '#2F855A', Rechazado: '#C53030', Cancelado: '#718096' };

function layout({ titulo, intro, filas = [], estatus, cta, nota, appUrl }) {
  const rows = filas
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) => `<tr><td style="padding:8px 12px;color:#5A6B82;font-size:13px;width:38%;border-bottom:1px solid #E6EDF5">${esc(k)}</td>
        <td style="padding:8px 12px;color:#12304F;font-size:14px;font-weight:600;border-bottom:1px solid #E6EDF5">${esc(v)}</td></tr>`,
    )
    .join('');
  const badge = estatus
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${STATUS_COLOR[estatus] || '#1B4F8C'};color:#fff;font-size:12px;font-weight:700">${esc(estatus)}</span>`
    : '';
  const button = cta
    ? `<p style="text-align:center;margin:28px 0 8px"><a href="${esc(cta.url)}" style="background:#1B4F8C;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#EEF3F9;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F9;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(18,48,79,.08)">
    <tr><td style="background:linear-gradient(135deg,#12467F,#5DADEC);padding:22px 28px">
      <div style="color:#fff;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Go Productivity</div>
      <div style="color:#fff;font-size:20px;font-weight:700;margin-top:4px">Portal de Vacaciones</div>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 6px;font-size:20px;color:#12304F">${esc(titulo)}</h1>
      ${badge ? `<div style="margin:10px 0 14px">${badge}</div>` : ''}
      <p style="margin:0 0 18px;color:#3C4F66;font-size:14px;line-height:1.6">${intro}</p>
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6EDF5;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table>` : ''}
      ${nota ? `<p style="margin:18px 0 0;padding:12px 14px;background:#F3F8FD;border-left:4px solid #5DADEC;color:#3C4F66;font-size:13px;line-height:1.5">${nota}</p>` : ''}
      ${button}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#F7FAFD;color:#8494A7;font-size:11px;text-align:center">
      Mensaje automático del Portal de Vacaciones · <a href="${esc(appUrl)}" style="color:#1B4F8C">${esc(appUrl)}</a>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

function textVersion({ titulo, filas = [], estatus, cta }) {
  return [titulo, estatus ? `Estatus: ${estatus}` : '', '', ...filas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '', cta ? `${cta.label}: ${cta.url}` : '']
    .filter((l) => l !== undefined)
    .join('\n');
}

export async function sendEmail({ to, subject, ...content }) {
  const recipients = [...new Set([].concat(to).filter(Boolean))];
  if (!recipients.length) return;
  const cfg = await getConfig();
  const html = layout({ ...content, appUrl: cfg.app_url });
  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: `"${cfg.ses_from_name}" <${cfg.ses_from}>`,
        Destination: { ToAddresses: recipients },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: textVersion(content), Charset: 'UTF-8' } },
          },
        },
      }),
    );
  } catch (err) {
    // El correo nunca debe tumbar la operación de negocio; queda en CloudWatch.
    console.error('SES error', { to: recipients, subject, message: err.message });
  }
}

// ---------- Plantillas de negocio ----------
function detalle(s, extra = []) {
  return [
    ['Folio', s.folio],
    ['Colaborador', s.solicitante],
    ['Tipo', s.tipo_nombre],
    ['Desde', fmtDate(s.desde)],
    ['Hasta', fmtDate(s.hasta)],
    ['Días hábiles', String(s.fechas?.length ?? '')],
    ['Días que descuenta', s.dias_descuento != null ? String(s.dias_descuento) : ''],
    ['Backup', s.backup_nombre],
    ['Comentarios', s.descripcion],
    ...extra,
  ];
}

export async function notifyCreated(s, { aprobadores, backupEmails = [] }) {
  const cfg = await getConfig();
  const link = `${cfg.app_url}#/aprobaciones?id=${encodeURIComponent(s.id)}`;
  await Promise.all([
    sendEmail({
      to: s.correo_solicitante,
      subject: `Recibimos tu solicitud ${s.folio} · ${s.tipo_nombre}`,
      titulo: 'Tu solicitud fue registrada',
      estatus: s.estatus,
      intro: `Hola ${esc(s.nombre_corto)}, tu solicitud quedó registrada y fue enviada a aprobación. Te avisaremos por correo cuando cambie de estatus.`,
      filas: detalle(s, [['Aprobador(es)', aprobadores.map((a) => a.nombre).join(', ')]]),
      cta: { label: 'Ver mis solicitudes', url: `${cfg.app_url}#/solicitudes` },
    }),
    sendEmail({
      to: aprobadores.map((a) => a.correo),
      subject: `Solicitud por aprobar ${s.folio}: ${s.solicitante} · ${s.tipo_nombre}`,
      titulo: 'Tienes una solicitud por aprobar',
      estatus: s.estatus,
      intro: `<b>${esc(s.solicitante)}</b> solicitó <b>${esc(s.tipo_nombre)}</b>. Revísala y apruébala o recházala desde el portal.`,
      filas: detalle(s),
      cta: { label: 'Revisar solicitud', url: link },
    }),
    backupEmails.length && cfg.notificar_backup !== 'no'
      ? sendEmail({
          to: backupEmails,
          subject: `Te asignaron como backup de ${s.solicitante}`,
          titulo: 'Fuiste asignado como backup',
          estatus: s.estatus,
          intro: `<b>${esc(s.solicitante)}</b> te asignó como su backup durante su ausencia. Mientras la cubras no podrás solicitar ausencias en esas fechas.`,
          filas: detalle(s),
          cta: { label: 'Ir al portal', url: cfg.app_url },
        })
      : null,
  ]);
}

export async function notifyDecision(s, { decididoPor, backupEmails = [], notificarEmails = [] }) {
  const cfg = await getConfig();
  const aprobado = s.estatus === 'Aprobado';
  await Promise.all([
    sendEmail({
      to: s.correo_solicitante,
      subject: `Tu solicitud ${s.folio} fue ${aprobado ? 'aprobada' : 'rechazada'}`,
      titulo: aprobado ? '¡Tu solicitud fue aprobada!' : 'Tu solicitud fue rechazada',
      estatus: s.estatus,
      intro: aprobado
        ? `Hola ${esc(s.nombre_corto)}, ${esc(decididoPor)} aprobó tu solicitud. ¡Disfruta tus días!`
        : `Hola ${esc(s.nombre_corto)}, ${esc(decididoPor)} rechazó tu solicitud. Los días se regresaron a tu saldo.`,
      filas: detalle(s, [['Decidió', decididoPor], ['Comentario del aprobador', s.comentario_aprobador]]),
      cta: { label: 'Ver mis solicitudes', url: `${cfg.app_url}#/solicitudes` },
    }),
    aprobado && backupEmails.length && cfg.notificar_backup !== 'no'
      ? sendEmail({
          to: backupEmails,
          subject: `Confirmado: cubrirás a ${s.solicitante}`,
          titulo: 'Ausencia confirmada',
          estatus: s.estatus,
          intro: `La ausencia de <b>${esc(s.solicitante)}</b> fue aprobada y tú serás su backup.`,
          filas: detalle(s),
          cta: { label: 'Ir al portal', url: cfg.app_url },
        })
      : null,
    aprobado && notificarEmails.length
      ? sendEmail({
          to: notificarEmails,
          subject: `Ausencia aprobada: ${s.solicitante} · ${fmtDate(s.desde)} – ${fmtDate(s.hasta)}`,
          titulo: 'Ausencia aprobada en tu torre',
          estatus: s.estatus,
          intro: `Te informamos que ${esc(decididoPor)} aprobó la ausencia de <b>${esc(s.solicitante)}</b>.`,
          filas: detalle(s),
          cta: { label: 'Ver mapa del equipo', url: `${cfg.app_url}#/equipo` },
        })
      : null,
  ]);
}

export async function notifyCancelled(s, { canceladoPor, aprobadores, backupEmails = [] }) {
  const cfg = await getConfig();
  await sendEmail({
    to: [s.correo_solicitante, ...aprobadores, ...backupEmails].filter(Boolean),
    subject: `Solicitud ${s.folio} cancelada · ${s.solicitante}`,
    titulo: 'Solicitud cancelada',
    estatus: 'Cancelado',
    intro: `La solicitud de <b>${esc(s.solicitante)}</b> fue cancelada por ${esc(canceladoPor)}. Los días regresan al saldo.`,
    filas: detalle(s),
    cta: { label: 'Ir al portal', url: cfg.app_url },
  });
}

export async function sendRecoveryCode(correo, nombre, codigo) {
  await sendEmail({
    to: correo,
    subject: `Tu código de verificación: ${codigo}`,
    titulo: 'Código para restablecer tu contraseña',
    intro: `Hola ${esc(nombre || '')}, usa este código para crear tu contraseña. Vence en 15 minutos.<br><br>
      <span style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:800;color:#12467F;background:#EEF5FC;padding:12px 20px;border-radius:12px">${esc(codigo)}</span>`,
    nota: 'Si no solicitaste este código puedes ignorar este correo; tu contraseña no cambiará.',
  });
}

export async function sendTempPassword(correo, nombre, temp) {
  const cfg = await getConfig();
  await sendEmail({
    to: correo,
    subject: 'Tu acceso al Portal de Vacaciones',
    titulo: 'Se generó una contraseña temporal',
    intro: `Hola ${esc(nombre || '')}, un administrador generó una contraseña temporal para tu cuenta. Al entrar se te pedirá cambiarla.<br><br>
      Usuario: <b>${esc(correo)}</b><br>Contraseña temporal: <b style="font-family:Consolas,monospace;font-size:16px">${esc(temp)}</b>`,
    cta: { label: 'Entrar al portal', url: cfg.app_url },
  });
}

export async function sendWelcome(correo, nombre) {
  const cfg = await getConfig();
  await sendEmail({
    to: correo,
    subject: 'Bienvenido al Portal de Vacaciones Go Productivity',
    titulo: `¡Bienvenido${nombre ? `, ${nombre}` : ''}!`,
    intro: 'Se creó tu cuenta en el Portal de Vacaciones. Para entrar por primera vez elige <b>"¿Primera vez u olvidaste tu contraseña?"</b> en la pantalla de acceso; te enviaremos un código para crear tu contraseña.',
    filas: [['Usuario', correo]],
    cta: { label: 'Activar mi cuenta', url: `${cfg.app_url}#/recuperar?correo=${encodeURIComponent(correo)}` },
  });
}
