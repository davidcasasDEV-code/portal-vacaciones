import { sendEmail, sendTeamMessage } from "./lambda.js";
import { EVENT_TYPES } from "./vacaciones.js";

// Antes esto se disparaba desde el navegador (cualquiera podia invocar
// Send_Email/Send_Team_MSG con cualquier payload). Ahora vive solo en el
// servidor, despues de que la solicitud ya se valido y se guardo.
export async function notificarNuevaSolicitud({ solicitud, portalUrl }) {
  const eventName = EVENT_TYPES[solicitud.tipo_solicitud] || solicitud.tipo_solicitud;
  const portalMessage = portalUrl
    ? `La aprobación o rechazo es mediante el portal de Vacaciones: ${portalUrl}`
    : "La aprobación o rechazo es mediante el portal de Vacaciones.";
  const baseMessage = `Se recibió una solicitud de tipo: "${eventName}" por parte de ${solicitud.solicitante}
Días Solicitados: ${solicitud.dias_solicitados}
Desde: ${solicitud.desde}
Hasta: ${solicitud.hasta}`;

  await Promise.allSettled([
    sendEmail({
      email_to: solicitud.aprobador,
      subject: `Solicitud ${eventName} de ${solicitud.solicitante}`,
      body: `${baseMessage}\n${portalMessage}`
    }),
    sendEmail({
      email_to: solicitud.correo_solicitante,
      subject: `Solicitud ${eventName} de ${solicitud.solicitante}`,
      body: `${baseMessage}\nSe le notificará cuando esta sea aprobada o rechazada`
    }),
    sendTeamMessage(`${baseMessage}\n${portalMessage}`)
  ]);
}

export async function notificarCambioEstatus({ solicitud, estatus }) {
  const eventName = EVENT_TYPES[solicitud.tipo_solicitud] || solicitud.tipo_solicitud;
  await sendEmail({
    email_to: solicitud.correo_solicitante,
    subject: `Solicitud ${eventName} ${estatus}`,
    body: `Tu solicitud de tipo "${eventName}" del ${solicitud.desde} al ${solicitud.hasta} fue marcada como: ${estatus}.`
  }).catch((error) => console.error("No se pudo notificar el cambio de estatus", error));
}

export async function notificarRecuperacion({ correo, codigo }) {
  await sendEmail({
    email_to: correo,
    subject: "Restablecer Contraseña Portal de Vacaciones",
    body: `Se recibió una solicitud para cambio de contraseña, el código es: ${codigo}\nEste código expira en 15 minutos.`
  });
}
