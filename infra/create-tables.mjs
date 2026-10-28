// Crea (si no existen) las tablas Go_Productivity_* en modo On-Demand.
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
  UpdateContinuousBackupsCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { T, log } from './settings.mjs';

const ddb = new DynamoDBClient({});

const tables = [
  { name: T.usuarios, pk: 'correo', pitr: true },
  {
    name: T.solicitudes,
    pk: 'id',
    pitr: true,
    attrs: [['correo_solicitante', 'S'], ['desde', 'S']],
    gsi: [{ IndexName: 'solicitante-desde-index', KeySchema: [{ AttributeName: 'correo_solicitante', KeyType: 'HASH' }, { AttributeName: 'desde', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } }],
  },
  { name: T.beneficios, pk: 'clave', pitr: true },
  { name: T.torres, pk: 'id', pitr: true },
  { name: T.festivos, pk: 'fecha' },
  { name: T.adicional, pk: 'id', pitr: true },
  { name: T.recuperar, pk: 'correo', ttl: 'expira' },
  { name: T.config, pk: 'clave', pitr: true },
];

for (const t of tables) {
  let exists = true;
  try {
    await ddb.send(new DescribeTableCommand({ TableName: t.name }));
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    exists = false;
  }
  if (exists) {
    log(`${t.name}: ya existe`);
    continue;
  }
  await ddb.send(
    new CreateTableCommand({
      TableName: t.name,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [[t.pk, 'S'], ...(t.attrs || [])].map(([AttributeName, AttributeType]) => ({ AttributeName, AttributeType })),
      KeySchema: [{ AttributeName: t.pk, KeyType: 'HASH' }],
      GlobalSecondaryIndexes: t.gsi,
      Tags: [{ Key: 'proyecto', Value: 'portal-vacaciones' }],
    }),
  );
  await waitUntilTableExists({ client: ddb, maxWaitTime: 120 }, { TableName: t.name });
  if (t.ttl) await ddb.send(new UpdateTimeToLiveCommand({ TableName: t.name, TimeToLiveSpecification: { AttributeName: t.ttl, Enabled: true } }));
  if (t.pitr) {
    await ddb.send(new UpdateContinuousBackupsCommand({ TableName: t.name, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } }));
  }
  log(`${t.name}: creada`);
}
