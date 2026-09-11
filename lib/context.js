import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth.js";

// Resuelve el usuario autenticado desde la cookie de sesion (nunca desde
// datos que mande el cliente en el body o en headers). Acepta un NextRequest
// (rutas /api) o se puede llamar sin argumentos desde Server Components /
// layouts, donde se usa next/headers.
export async function getContext(request) {
  const token = request
    ? request.cookies.get(SESSION_COOKIE_NAME)?.value
    : (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }

  return {
    correo: payload.correo,
    nombre: payload.nombre,
    apellido: payload.apellido,
    rol: payload.rol
  };
}
