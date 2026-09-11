import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, setSessionCookie } from "../../../../../lib/auth.js";
import { apiError, ApiError } from "../../../../../lib/permissions.js";
import { validarCodigo } from "../../../../../lib/recuperar.js";
import { getUsuario, setPassword } from "../../../../../lib/usuarios.js";

export const runtime = "nodejs";

const schema = z.object({
  correo: z.string().trim().toLowerCase().min(1),
  codigo: z.string().trim().min(1),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
});

export async function POST(request) {
  try {
    const body = schema.parse(await request.json());

    const codigoValido = await validarCodigo(body.correo, body.codigo);
    if (!codigoValido) {
      throw new ApiError(400, "Codigo incorrecto o expirado, favor de solicitar uno nuevo");
    }

    const usuario = await getUsuario(body.correo);
    if (!usuario) {
      throw new ApiError(400, "No se encontro la cuenta");
    }

    await setPassword(body.correo, await hashPassword(body.password));

    const rol = usuario.permisos === "Admin" ? "Admin" : "Usuario";
    const token = await createSessionToken({
      correo: body.correo,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol
    });

    const response = NextResponse.json({ correo: body.correo, nombre: usuario.nombre, apellido: usuario.apellido, rol });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
