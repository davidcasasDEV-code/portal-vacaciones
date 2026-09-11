import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const region = process.env.AWS_REGION || "us-east-1";
const lambda = new LambdaClient({ region });

// Funciones NAVE existentes en AWS. Se invocan como caja negra desde el
// servidor (nunca desde el navegador): este modulo no expone un passthrough
// generico, solo estas funciones especificas.
const FUNCTIONS = {
  SEND_EMAIL: "Send_Email",
  SEND_TEAM_MSG: "Send_Team_MSG",
  OBTENER_SALDOS_BENEFICIOS: "Obtener_Saldos_Beneficios"
};

async function invoke(functionName, payload, invocationType) {
  const result = await lambda.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: invocationType,
    Payload: Buffer.from(JSON.stringify(payload || {}))
  }));

  if (!result.Payload) {
    return null;
  }

  const text = Buffer.from(result.Payload).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendEmail({ email_to, subject, body }) {
  await invoke(FUNCTIONS.SEND_EMAIL, { email_to, subject, body }, "Event");
}

export async function sendTeamMessage(mensaje) {
  await invoke(FUNCTIONS.SEND_TEAM_MSG, { Mensaje: mensaje }, "Event");
}

export async function obtenerSaldosBeneficios(correo) {
  const data = await invoke(FUNCTIONS.OBTENER_SALDOS_BENEFICIOS, { correo }, "RequestResponse");
  return data?.response ?? null;
}
