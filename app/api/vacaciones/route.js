import { z } from "zod";
import { businessDaysBetween } from "../../../lib/holidays.js";
import { notificarNuevaSolicitud } from "../../../lib/notifications.js";
import { apiError, ApiError, requireAdmin, requireAuth } from "../../../lib/permissions.js";
import { getUsuario } from "../../../lib/usuarios.js";
import {
  crearSolicitud,
  EVENT_TYPES,
  listarActivasEquipo,
  listarActivasPorSolicitante,
  listarPendientesParaAprobador,
  listarPorSolicitante,
  listarTodas
} from "../../../lib/vacaciones.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const context = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");

    switch (scope) {
      case "mine":
        return Response.json({ solicitudes: await listarPorSolicitante(context.correo) });
      case "pending":
        return Response.json({ solicitudes: await listarPendientesParaAprobador(context.correo) });
      case "calendar":
        return Response.json({ solicitudes: await listarActivasPorSolicitante(context.correo) });
      case "team": {
        const desde = searchParams.get("desde");
        const hasta = searchParams.get("hasta");
        if (!desde || !hasta) {
          throw new ApiError(400, "Faltan los parametros desde/hasta");
        }
        return Response.json({ solicitudes: await listarActivasEquipo(desde, hasta) });
      }
      case "all":
        requireAdmin(context);
        return Response.json({ solicitudes: await listarTodas() });
      default:
        throw new ApiError(400, "Parametro scope invalido");
    }
  } catch (error) {
    return apiError(error);
  }
}

const createSchema = z.object({
  tipoSolicitud: z.enum(Object.keys(EVENT_TYPES)),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha 'desde' invalida"),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha 'hasta' invalida"),
  aprobador: z.string().trim().toLowerCase().email("Selecciona un aprobador valido"),
  descripcion: z.string().trim().max(1000).optional()
});

export async function POST(request) {
  try {
    const context = await requireAuth(request);
    const body = createSchema.parse(await request.json());

    if (body.hasta < body.desde) {
      throw new ApiError(400, "La fecha 'hasta' no puede ser anterior a 'desde'");
    }
    if (body.aprobador === context.correo) {
      throw new ApiError(400, "No puedes elegirte a ti mismo como aprobador");
    }

    const aprobadorUsuario = await getUsuario(body.aprobador);
    if (!aprobadorUsuario) {
      throw new ApiError(400, "El aprobador seleccionado no existe en el portal");
    }

    const diasSolicitados = businessDaysBetween(body.desde, body.hasta);
    if (diasSolicitados === 0) {
      throw new ApiError(400, "El rango seleccionado no tiene dias habiles (fines de semana / festivos)");
    }

    const solicitud = await crearSolicitud({
      correoSolicitante: context.correo,
      solicitanteNombre: `${context.nombre} ${context.apellido}`,
      aprobador: body.aprobador,
      tipoSolicitud: body.tipoSolicitud,
      desde: body.desde,
      hasta: body.hasta,
      descripcion: body.descripcion,
      diasSolicitados
    });

    const portalUrl = process.env.APP_BASE_URL || new URL(request.url).origin;
    await notificarNuevaSolicitud({ solicitud, portalUrl });

    return Response.json({ solicitud }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
