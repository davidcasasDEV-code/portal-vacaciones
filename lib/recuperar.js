import { randomInt } from "crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLES } from "./dynamo.js";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos

export function generarCodigo() {
  return String(randomInt(0, 100000)).padStart(5, "0");
}

export async function guardarCodigo(correo, codigo) {
  await dynamo.send(new PutCommand({
    TableName: TABLES.RECUPERAR_CUENTA,
    Item: {
      correo: correo.toLowerCase(),
      codigo,
      expiresAt: Date.now() + CODE_TTL_MS
    }
  }));
}

// Valida el codigo en el servidor (nunca se responde al cliente si es
// valido sin que la confirmacion venga acompañada del cambio de password en
// la misma llamada).
export async function validarCodigo(correo, codigo) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.RECUPERAR_CUENTA,
    Key: { correo: correo.toLowerCase() }
  }));

  const item = result.Item;
  if (!item || item.codigo !== codigo) {
    return false;
  }
  if (item.expiresAt && Date.now() > item.expiresAt) {
    return false;
  }
  return true;
}
