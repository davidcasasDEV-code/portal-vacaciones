import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, scanAll, TABLES } from "./dynamo.js";

export async function getUsuario(correo) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.USUARIOS,
    Key: { correo: correo.toLowerCase() }
  }));
  return result.Item || null;
}

// Catalogo de compañeros para los selects de aprobador (registro previo por
// un admin en NAVE_Reporte_Usuarios_Web, mismo comportamiento de negocio de
// siempre).
export async function listUsuarios() {
  const items = await scanAll((ExclusiveStartKey) =>
    dynamo.send(new ScanCommand({ TableName: TABLES.USUARIOS, ExclusiveStartKey })));

  return items
    .filter((item) => item.correo)
    .map((item) => ({ correo: item.correo, nombre: item.nombre, apellido: item.apellido, permisos: item.permisos }));
}

export async function setPassword(correo, passwordHash) {
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.USUARIOS,
    Key: { correo: correo.toLowerCase() },
    ExpressionAttributeValues: { ":password": passwordHash },
    UpdateExpression: "SET password = :password"
  }));
}

export async function completarRegistro(correo, datos) {
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.USUARIOS,
    Key: { correo: correo.toLowerCase() },
    ExpressionAttributeValues: {
      ":nombre": datos.nombre,
      ":apellido": datos.apellido,
      ":password": datos.passwordHash,
      ":sexo": datos.sexo,
      ":fecha_ingreso": datos.fechaIngreso,
      ":fecha_nacimiento": datos.fechaNacimiento
    },
    UpdateExpression:
      "SET nombre = :nombre, apellido = :apellido, password = :password, sexo = :sexo, fecha_ingreso = :fecha_ingreso, fecha_nacimiento = :fecha_nacimiento"
  }));
}
