import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, setSessionCookie } from "../../../../lib/auth.js";
import { apiError, ApiError } from "../../../../lib/permissions.js";
import { completarRegistro, getUsuario } from "../../../../lib/usuarios.js";

export const runtime = "nodejs";

const schema = z.object({
  correo: z.string().trim().toLowerCase().min(1),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  sexo: z.string().trim().min(1),
  fechaIngreso: z.string().trim().min(1),
  fechaNacimiento: z.string().trim().min(1)
});

const NO_ACCESO = "Tu correo no cuenta con acceso a este sitio, favor de validar con los administradores";

// El dato llega como yyyy-mm-dd (input type=date). Los registros existentes
// en DynamoDB usan dd/mm/yyyy (mismo formato que usaba el frontend anterior).
function aFormatoLegado(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export async function POST(request) {
  try {
    const body = schema.parse(await request.json());

    const usuario = await getUsuario(body.correo);
    if (!usuario) {
      throw new ApiError(400, NO_ACCESO);
    }
    if (usuario.password) {
      throw new ApiError(400, "Ya cuenta con un usuario, favor de iniciar sesión o recuperar tu cuenta");
    }
    if (!usuario.permisos) {
      throw new ApiError(400, NO_ACCESO);
    }

    const passwordHash = await hashPassword(body.password);
    await completarRegistro(body.correo, {
      nombre: body.nombre,
      apellido: body.apellido,
      passwordHash,
      sexo: body.sexo,
      fechaIngreso: aFormatoLegado(body.fechaIngreso),
      fechaNacimiento: aFormatoLegado(body.fechaNacimiento)
    });

    const rol = usuario.permisos === "Admin" ? "Admin" : "Usuario";
    const token = await createSessionToken({ correo: body.correo, nombre: body.nombre, apellido: body.apellido, rol });

    const response = NextResponse.json({ correo: body.correo, nombre: body.nombre, apellido: body.apellido, rol });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
