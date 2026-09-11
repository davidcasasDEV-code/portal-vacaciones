import { apiError } from "../../../lib/permissions.js";
import { requireAuth } from "../../../lib/permissions.js";
import { listUsuarios } from "../../../lib/usuarios.js";

export const runtime = "nodejs";

// Catalogo de compañeros para el selector de aprobador. Requiere sesion,
// pero cualquier usuario autenticado puede verlo (igual que hoy).
export async function GET(request) {
  try {
    await requireAuth(request);
    const usuarios = await listUsuarios();
    return Response.json({ usuarios });
  } catch (error) {
    return apiError(error);
  }
}
