import { z } from "zod";
import { apiError } from "../../../../../lib/permissions.js";
import { notificarRecuperacion } from "../../../../../lib/notifications.js";
import { generarCodigo, guardarCodigo } from "../../../../../lib/recuperar.js";
import { getUsuario } from "../../../../../lib/usuarios.js";

export const runtime = "nodejs";

const schema = z.object({ correo: z.string().trim().toLowerCase().min(1) });

// Respuesta identica exista o no el correo, para no filtrar que cuentas
// existen. Si existe, se genera un codigo de un solo uso (expira en 15 min)
// y se envia por correo.
export async function POST(request) {
  try {
    const { correo } = schema.parse(await request.json());

    const usuario = await getUsuario(correo);
    if (usuario) {
      const codigo = generarCodigo();
      await guardarCodigo(correo, codigo);
      await notificarRecuperacion({ correo, codigo });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
