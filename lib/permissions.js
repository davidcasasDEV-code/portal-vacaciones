import { ZodError } from "zod";
import { getContext } from "./context.js";

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function apiError(error) {
  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join(" ");
    return Response.json({ message: message || "Datos invalidos" }, { status: 400 });
  }

  if (!(error instanceof ApiError)) {
    console.error(error);
  }
  return Response.json(
    { message: error.message || "Error interno" },
    { status: error.statusCode || 500 }
  );
}

// Lanza 401 si no hay sesion valida. Usar al inicio de cada route handler
// protegido.
export async function requireAuth(request) {
  const context = await getContext(request);
  if (!context) {
    throw new ApiError(401, "Sesion invalida o expirada. Inicia sesion de nuevo.");
  }
  return context;
}

export function requireAdmin(context) {
  if (context.rol !== "Admin") {
    throw new ApiError(403, "No tienes permisos de administrador para esta accion.");
  }
}

// Solo el solicitante puede cancelar su propia solicitud; solo el aprobador
// designado (o un Admin) puede aprobar/rechazar. Se valida contra la sesion
// real, nunca contra un campo que mande el cliente.
export function canCancelSolicitud(context, solicitud) {
  return context.correo === solicitud.correo_solicitante || context.rol === "Admin";
}

export function canDecideSolicitud(context, solicitud) {
  return context.correo === solicitud.aprobador || context.rol === "Admin";
}
