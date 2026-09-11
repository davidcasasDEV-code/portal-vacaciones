import { randomBytes } from "crypto";
import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, scanAll, TABLES } from "./dynamo.js";
import { ApiError } from "./permissions.js";

// Mismos tipos de solicitud que el portal anterior, mas "dia_extra" (la
// pagina "Dias Extra" no tenia funcionalidad real, era un archivo vacio -
// se implementa aqui como un tipo de solicitud mas, reutilizando el mismo
// flujo de aprobacion en vez de inventar una tabla nueva).
export const EVENT_TYPES = {
  vacation: "Vacaciones",
  "personal-day": "Dia Personal",
  birthday: "Dia de Cumpleaños",
  enfermedad: "Enfermedad",
  "medio-dia": "Medio dia",
  permiso: "Permiso sin goce de sueldo",
  nacimiento_adopcion_padre: "Nacimiento y/o adopción (padre)",
  licencia_maternidad_madre: "Licencia de maternidad",
  licencia_adopcion_madre: "Licencia adopción (madre)",
  fallecimiento_familiar: "Fallecimiento Familiar",
  dia_extra: "Día Extra"
};

export const ESTATUS = {
  PENDIENTE: "Pendiente de Aprobación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado"
};

function generarId() {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
}

export async function crearSolicitud({
  correoSolicitante,
  solicitanteNombre,
  aprobador,
  tipoSolicitud,
  desde,
  hasta,
  descripcion,
  diasSolicitados
}) {
  const item = {
    id: generarId(),
    tipo_solicitud: tipoSolicitud,
    desde,
    hasta,
    aprobador,
    descripcion: descripcion || "",
    dias_solicitados: String(diasSolicitados),
    solicitante: solicitanteNombre,
    correo_solicitante: correoSolicitante,
    estatus: ESTATUS.PENDIENTE
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.VACACIONES, Item: item }));
  return item;
}

export async function obtenerSolicitud(id) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.VACACIONES,
    Key: { id }
  }));
  return result.Item || null;
}

export async function listarPorSolicitante(correo) {
  return scanAll((ExclusiveStartKey) => dynamo.send(new ScanCommand({
    TableName: TABLES.VACACIONES,
    FilterExpression: "#correo_solicitante = :correo",
    ExpressionAttributeNames: { "#correo_solicitante": "correo_solicitante" },
    ExpressionAttributeValues: { ":correo": correo },
    ExclusiveStartKey
  })));
}

export async function listarPendientesParaAprobador(correo) {
  return scanAll((ExclusiveStartKey) => dynamo.send(new ScanCommand({
    TableName: TABLES.VACACIONES,
    FilterExpression: "#aprobador = :correo and #estatus = :pendiente",
    ExpressionAttributeNames: { "#aprobador": "aprobador", "#estatus": "estatus" },
    ExpressionAttributeValues: { ":correo": correo, ":pendiente": ESTATUS.PENDIENTE },
    ExclusiveStartKey
  })));
}

export async function listarTodas() {
  return scanAll((ExclusiveStartKey) => dynamo.send(new ScanCommand({
    TableName: TABLES.VACACIONES,
    ExclusiveStartKey
  })));
}

// Solicitudes activas (aprobadas o pendientes) de una persona, para pintar
// su calendario.
export async function listarActivasPorSolicitante(correo) {
  return scanAll((ExclusiveStartKey) => dynamo.send(new ScanCommand({
    TableName: TABLES.VACACIONES,
    FilterExpression: "#correo_solicitante = :correo and (#estatus = :aprobado or #estatus = :pendiente)",
    ExpressionAttributeNames: { "#correo_solicitante": "correo_solicitante", "#estatus": "estatus" },
    ExpressionAttributeValues: { ":correo": correo, ":aprobado": ESTATUS.APROBADO, ":pendiente": ESTATUS.PENDIENTE },
    ExclusiveStartKey
  })));
}

// Solicitudes activas de todo el equipo que se traslapan con un rango de
// fechas, para el "mapa de equipo".
export async function listarActivasEquipo(desde, hasta) {
  return scanAll((ExclusiveStartKey) => dynamo.send(new ScanCommand({
    TableName: TABLES.VACACIONES,
    FilterExpression: "(#desde <= :hasta and #hasta >= :desde) and (#estatus = :aprobado or #estatus = :pendiente)",
    ExpressionAttributeNames: { "#desde": "desde", "#hasta": "hasta", "#estatus": "estatus" },
    ExpressionAttributeValues: { ":desde": desde, ":hasta": hasta, ":aprobado": ESTATUS.APROBADO, ":pendiente": ESTATUS.PENDIENTE },
    ExclusiveStartKey
  })));
}

export async function actualizarEstatus(id, estatus) {
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.VACACIONES,
    Key: { id },
    ExpressionAttributeValues: { ":estatus": estatus },
    UpdateExpression: "SET estatus = :estatus"
  }));
}

// Misma regla de negocio que el portal anterior: una vez rechazada, o si el
// primer dia del rango ya paso, la solicitud ya no se puede cancelar.
export function puedeCancelarse(solicitud) {
  if (solicitud.estatus === ESTATUS.RECHAZADO || solicitud.estatus === ESTATUS.CANCELADO) {
    return false;
  }
  const hoy = new Date().toISOString().split("T")[0];
  return solicitud.desde >= hoy;
}

export function requireSolicitudEditable(solicitud) {
  if (!solicitud) {
    throw new ApiError(404, "La solicitud no existe.");
  }
}
