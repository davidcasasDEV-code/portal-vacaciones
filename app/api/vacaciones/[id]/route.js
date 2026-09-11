import { z } from "zod";
import { notificarCambioEstatus } from "../../../../lib/notifications.js";
import { apiError, ApiError, canCancelSolicitud, canDecideSolicitud, requireAuth } from "../../../../lib/permissions.js";
import {
  actualizarEstatus,
  ESTATUS,
  obtenerSolicitud,
  puedeCancelarse
} from "../../../../lib/vacaciones.js";

export const runtime = "nodejs";

const schema = z.object({ accion: z.enum(["aprobar", "rechazar", "cancelar"]) });

export async function PATCH(request, context) {
  try {
    const authContext = await requireAuth(request);
    const { id } = await context.params;
    const { accion } = schema.parse(await request.json());

    const solicitud = await obtenerSolicitud(id);
    if (!solicitud) {
      throw new ApiError(404, "La solicitud no existe");
    }

    if (accion === "aprobar" || accion === "rechazar") {
      if (!canDecideSolicitud(authContext, solicitud)) {
        throw new ApiError(403, "Solo el aprobador designado o un administrador puede decidir esta solicitud");
      }
      if (solicitud.estatus !== ESTATUS.PENDIENTE) {
        throw new ApiError(400, "Esta solicitud ya fue procesada");
      }

      const nuevoEstatus = accion === "aprobar" ? ESTATUS.APROBADO : ESTATUS.RECHAZADO;
      await actualizarEstatus(id, nuevoEstatus);
      await notificarCambioEstatus({ solicitud, estatus: nuevoEstatus });
      return Response.json({ id, estatus: nuevoEstatus });
    }

    // accion === "cancelar"
    if (!canCancelSolicitud(authContext, solicitud)) {
      throw new ApiError(403, "Solo quien solicito estas vacaciones (o un administrador) puede cancelarlas");
    }
    if (!puedeCancelarse(solicitud)) {
      throw new ApiError(400, "Esta solicitud ya no puede cancelarse (rechazada, cancelada o ya en curso)");
    }

    await actualizarEstatus(id, ESTATUS.CANCELADO);
    await notificarCambioEstatus({ solicitud, estatus: ESTATUS.CANCELADO });
    return Response.json({ id, estatus: ESTATUS.CANCELADO });
  } catch (error) {
    return apiError(error);
  }
}
