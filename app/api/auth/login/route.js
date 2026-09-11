import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, setSessionCookie, verifyPassword } from "../../../../lib/auth.js";
import { apiError, ApiError } from "../../../../lib/permissions.js";
import { getUsuario, setPassword } from "../../../../lib/usuarios.js";

export const runtime = "nodejs";

const schema = z.object({
  correo: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1)
});

export async function POST(request) {
  try {
    const body = schema.parse(await request.json());

    const usuario = await getUsuario(body.correo);
    if (!usuario || !usuario.password) {
      throw new ApiError(401, "Correo o Contraseña incorrectas, favor de validar la información");
    }

    const { valid, needsRehash } = await verifyPassword(body.password, usuario.password);
    if (!valid) {
      throw new ApiError(401, "Correo o Contraseña incorrectas, favor de validar la información");
    }

    if (needsRehash) {
      await setPassword(body.correo, await hashPassword(body.password));
    }

    // Cualquier valor de "permisos" que no sea exactamente "Admin" se trata
    // como usuario estandar (privilegio minimo por defecto).
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
