# Portal de Vacaciones en Amplify

Esta version usa Next.js, como la base de Go Pulsar. El portal HTML actual vive en `public/` y las llamadas a DynamoDB/Lambda pasan por rutas server-side de Next.js en `/api`.

## Variables de entorno en Amplify

Configura estas variables en la app de Amplify:

- `APP_BASE_URL`: URL final del portal, por ejemplo `https://main.xxxxx.amplifyapp.com`
- `AWS_REGION`: `us-east-1`
- `ALLOWED_TABLES`: `NAVE_Vacaciones,NAVE_Reporte_Usuarios_Web,NAVE_Recuperar_Cuenta,NAVE_Reporte_Capacidades,NAVE_Reporte_General_MVPs`
- `ALLOWED_LAMBDAS`: `Send_Email,Send_Team_MSG,Obtener_Saldos_Beneficios`

Para salir rapido puedes agregar tambien `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en Amplify, pero solo como variables server-side de esta app Next.js. En este proyecto ya no se escriben esas llaves en `public/js/config.js`.

El camino recomendado es asignar a Amplify un rol IAM con permisos limitados a esas tablas y Lambdas, y quitar las access keys.

## Permisos minimos

El rol o usuario IAM debe permitir:

- `dynamodb:GetItem`
- `dynamodb:Scan`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `lambda:InvokeFunction`

Limita los recursos a las tablas y funciones NAVE usadas por el portal.

## Build

Amplify debe usar el `amplify.yml` incluido:

```bash
npm ci
npm run build
```

El resultado se publica desde `.next`.

## Validaciones

Antes de apagar el S3 publico valida:

- Login y recuperacion de cuenta
- Registro de usuario
- Solicitud de vacaciones y beneficios
- Aprobacion/rechazo de solicitudes
- Reportes de vacaciones, capacidades y MVP
- Navegacion del calendario, incluyendo octubre 2026 y febrero 2027
