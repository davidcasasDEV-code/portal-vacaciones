# Portal de Vacaciones en Amplify (Next.js SSR)

Esta version usa Next.js 15 (App Router) como en Go PulsarX Suite. Ya no hay un
frontend estatico en `public/*.html`: todas las paginas viven en `app/` y se
renderizan en el servidor. El acceso a DynamoDB y a los Lambdas NAVE existentes
(`Send_Email`, `Send_Team_MSG`, `Obtener_Saldos_Beneficios`) ocurre solo del
lado servidor, dentro de `app/api/*` y de los Server Components en
`app/(portal)/*`.

## Variables de entorno en Amplify

Configura estas variables en la app de Amplify (Hosting > Environment variables):

- `APP_BASE_URL`: URL final del portal, por ejemplo `https://main.xxxxx.amplifyapp.com`
- `AWS_REGION`: `us-east-1`
- `SESSION_TOKEN_SECRET`: cadena aleatoria de al menos 32 caracteres, distinta
  por entorno (main/QA). Generarla con:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  Rotarla invalida todas las sesiones activas (fuerza a todos a iniciar sesion
  de nuevo), asi que no se debe cambiar sin avisar.

No configures `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` en Amplify: el
compute de Amplify Hosting para apps Next.js SSR ya corre con un rol de
servicio. Asigna a ese rol los permisos minimos de abajo en vez de usar access
keys de larga duracion.

## Permisos IAM minimos del rol de servicio de Amplify

- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Scan`
  sobre `NAVE_Vacaciones`, `NAVE_Reporte_Usuarios_Web`, `NAVE_Recuperar_Cuenta`
  (modulo de Vacaciones) y `NAVE_Reporte_Capacidades`,
  `NAVE_Reporte_General_MVPs` (paginas legado, ver mas abajo).
- `lambda:InvokeFunction` sobre `Send_Email`, `Send_Team_MSG`,
  `Obtener_Saldos_Beneficios`.

## Build

Amplify usa el `amplify.yml` incluido (`npm ci` + `npm run build`, falla rapido
si falta `AWS_REGION` o `SESSION_TOKEN_SECRET`). El artefacto se publica desde
`.next` (Amplify lo reconoce automaticamente como una app Next.js SSR).

## Validaciones antes de dar por buena la migracion

- Login con un usuario existente que tenga password del portal anterior (hash
  SHA-256) y confirmar que su registro en `NAVE_Reporte_Usuarios_Web` se
  actualiza a un hash bcrypt en su primer login.
- Registro de un correo pre-autorizado, y que un correo no autorizado sea
  rechazado.
- Recuperar cuenta: codigo, expiracion a los 15 minutos, cambio de password.
- Solicitud de vacaciones (calendario, festivos/fines de semana bloqueados),
  cancelacion de una solicitud propia.
- Aprobacion/rechazo solo por el aprobador designado o un Admin (probar que
  otro usuario recibe 403).
- Reporte de vacaciones visible solo para rol Admin.
- Dashboard: saldo de beneficios y KPIs cargan correctamente.

## Pendiente fuera de esta migracion

- `Reporte de Capacidad TI` y `Reporte de MVP's` (`public/reporte_capacidad.html`,
  `public/reporte_mvp.html`) no se rediseñaron; siguen siendo HTML/JS plano.
  Solo se les hizo el minimo cambio necesario para no romperse con el nuevo
  esquema de sesion: un script puente (`public/js/legacy-session.js`) que lee
  la sesion real via `/api/auth/session` y la refleja en `localStorage`, y sus
  enlaces al modulo de Vacaciones ahora apuntan a las rutas Next.js
  (`/vacaciones`, `/mis-solicitudes`, `/aprobaciones`, `/reportes`).
  Siguen usando un passthrough generico (`app/api/dynamodb/[operation]`,
  `app/api/lambda/invoke`) pero ahora acotado solo a
  `NAVE_Reporte_Capacidades` y `NAVE_Reporte_General_MVPs` (las tablas y
  Lambdas de Vacaciones ya no pasan por ahi) y exige sesion valida. El rol de
  Amplify tambien necesita `dynamodb:*` sobre esas 2 tablas para que sigan
  funcionando.
- La logica interna de `Send_Email`, `Send_Team_MSG` y
  `Obtener_Saldos_Beneficios` no se toco; se siguen invocando tal cual.
