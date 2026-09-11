import { apiError, ApiError } from "../../../../lib/permissions.js";
import { getContext } from "../../../../lib/context.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const context = await getContext(request);
    if (!context) {
      throw new ApiError(401, "No hay sesion activa");
    }
    return Response.json(context);
  } catch (error) {
    return apiError(error);
  }
}
