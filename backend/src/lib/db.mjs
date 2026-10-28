import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function getItem(TableName, Key) {
  const r = await client.send(new GetCommand({ TableName, Key }));
  return r.Item || null;
}

export async function putItem(TableName, Item, opts = {}) {
  await client.send(new PutCommand({ TableName, Item, ...opts }));
  return Item;
}

export async function deleteItem(TableName, Key) {
  await client.send(new DeleteCommand({ TableName, Key }));
}

// Actualiza solo los campos indicados; `null` elimina el atributo.
// `condition` = { expr, values } para escrituras condicionales.
export async function patchItem(TableName, Key, fields, { condition } = {}) {
  const sets = [];
  const removes = [];
  const names = {};
  const values = {};
  Object.entries(fields).forEach(([k, v], i) => {
    if (v === undefined) return;
    names[`#f${i}`] = k;
    if (v === null) removes.push(`#f${i}`);
    else {
      values[`:v${i}`] = v;
      sets.push(`#f${i} = :v${i}`);
    }
  });
  if (!sets.length && !removes.length) return null;
  if (condition?.values) Object.assign(values, condition.values);
  const expr = [sets.length ? `SET ${sets.join(', ')}` : '', removes.length ? `REMOVE ${removes.join(', ')}` : '']
    .filter(Boolean)
    .join(' ');
  const r = await client.send(
    new UpdateCommand({
      TableName,
      Key,
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
      ConditionExpression: condition?.expr,
      ReturnValues: 'ALL_NEW',
    }),
  );
  return r.Attributes;
}

// Contador atómico (folios).
export async function nextCounter(TableName, clave) {
  const r = await client.send(
    new UpdateCommand({
      TableName,
      Key: { clave },
      UpdateExpression: 'ADD valor :one',
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  return r.Attributes.valor;
}

export async function scanAll(TableName, params = {}) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await client.send(new ScanCommand({ TableName, ExclusiveStartKey, ...params }));
    out.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

export async function queryAll(TableName, params) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await client.send(new QueryCommand({ TableName, ExclusiveStartKey, ...params }));
    out.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}
