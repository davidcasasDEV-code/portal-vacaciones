# Migracion a AWS Amplify

## Objetivo

El portal deja de publicar credenciales de AWS en el navegador. Amplify solo hospeda el frontend estatico; DynamoDB y las Lambdas actuales se mantienen detras de una API HTTP.

## Pasos

1. Revoca y rota de inmediato la access key que estuvo publicada en `js/credenciales.js`. Aunque el archivo ya quedo saneado localmente, esa llave debe considerarse comprometida.
2. Despliega `backend/api-proxy` como Lambda + API Gateway en `us-east-1`.
3. Configura Amplify Hosting conectado al repo `portal-vacaciones`, rama `main`, usando `amplify.yml`.
4. En Amplify agrega estas variables de entorno:
   - `NAVE_API_BASE_URL`: URL base del API Gateway, por ejemplo `https://abc123.execute-api.us-east-1.amazonaws.com`
   - `NAVE_PORTAL_URL`: URL publica final del portal en Amplify. Si queda vacia, el portal usa `window.location.origin`.
5. Cuando tengas el dominio final de Amplify, actualiza `AllowedOrigins` del API para permitir ese origen y quitar `*`.
6. Valida login, registro, solicitud, aprobacion, cancelacion, reportes y mapa mensual.
7. Cuando todo este validado, deshabilita el website hosting del bucket S3 y activa Block Public Access.

## Despliegue del API con SAM

```bash
cd backend/api-proxy
npm install
sam build
sam deploy --guided --region us-east-1
```

El output `ApiUrl` es el valor que va en `NAVE_API_BASE_URL`.

## Contrato del API

El frontend llama estos endpoints:

- `POST /dynamodb/get`
- `POST /dynamodb/scan`
- `POST /dynamodb/update`
- `POST /dynamodb/put`
- `POST /lambda/invoke`

El cuerpo mantiene el mismo formato que usaba el SDK de AWS en el navegador. La Lambda proxy valida allowlists de tablas y funciones antes de ejecutar la operacion con su rol IAM.
