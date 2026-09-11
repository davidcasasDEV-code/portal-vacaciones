import { obtenerResumenDashboard } from "../../../lib/dashboard.js";
import { apiError, requireAuth } from "../../../lib/permissions.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const context = await requireAuth(request);
    const resumen = await obtenerResumenDashboard(context.correo);
    return Response.json(resumen);
  } catch (error) {
    return apiError(error);
  }
}
