# Portal de Vacaciones · Go Productivity

Portal para solicitar, aprobar y consultar vacaciones, días festivos, cumpleaños y
beneficios. Reemplaza al portal NAVE (bucket `nave-doti-oxxo`), que tenía las llaves de
AWS expuestas en el navegador.

| | |
|---|---|
| Portal (HTTPS) | https://d2nz2i7d67obl8.cloudfront.net/ |
| Portal (S3, público) | http://go-productivity-vacaciones.s3-website-us-east-1.amazonaws.com/ |
| API | Lambda `Go_Productivity_Vacaciones_API` (Function URL) |
| Correos | Amazon SES, remitente configurable (hoy `david.casas@go-productivity.com.mx`) |

## Arquitectura

```
Navegador ──HTTPS──▶ CloudFront ──▶ S3 (go-productivity-vacaciones, sitio estático)
    │
    └──HTTPS + token de sesión──▶ Lambda Go_Productivity_Vacaciones_API (Node.js 22, arm64)
                                     ├── DynamoDB  Go_Productivity_*
                                     └── Amazon SES
```

- **Frontend** (`frontend/`): Vite 8 + JavaScript moderno sin framework, Chart.js para
  gráficas, CSS con variables (modo claro/oscuro), diseño responsivo y accesible
  (navegación por teclado, etiquetas ARIA, contraste, `prefers-reduced-motion`).
- **API** (`backend/`): una sola Lambda sin dependencias externas (usa el AWS SDK v3
  del runtime). Toda la autorización ocurre en el servidor: el navegador nunca tiene
  credenciales de AWS.
- **Secretos**: la firma de sesiones (`jwt_secret`) y los parámetros de correo viven en
  la tabla `Go_Productivity_Config`. No hay credenciales en el código ni en el bundle.

### ¿Por qué una Lambda?
El portal anterior hablaba con DynamoDB directo desde el navegador usando llaves IAM
visibles para cualquiera. Un sitio estático no puede guardar secretos, así que la API
en Lambda es indispensable para: iniciar sesión de forma segura, validar roles, aplicar
reglas (saldos, festivos, backups) y enviar correos con SES.

## Tablas DynamoDB (On-Demand)

| Tabla | Llave | Contenido |
|---|---|---|
| `Go_Productivity_Usuarios` | `correo` | Perfil, `rol` (Admin/Aprobador/Usuario), `torre_id`, aprobador de excepción, hash de contraseña (scrypt) |
| `Go_Productivity_Solicitudes` | `id` (+ GSI `solicitante-desde-index`) | Solicitudes con folio, días hábiles, backup, aprobadores, historial |
| `Go_Productivity_Beneficios` | `clave` | Reglas de cada beneficio (LFT, anuales, ilimitados) |
| `Go_Productivity_Torres` | `id` | Torres de servicio y sus aprobadores |
| `Go_Productivity_Dias_Festivos` | `fecha` | Festivos oficiales y de empresa |
| `Go_Productivity_Saldo_Adicional` | `id` | Ajustes manuales de saldo (+/−) |
| `Go_Productivity_Recuperar_Cuenta` | `correo` | Códigos de verificación (hash, TTL 15 min) |
| `Go_Productivity_Config` | `clave` | `jwt_secret`, remitente SES, URL del portal, contador de folios |

## Reglas de negocio

- **Vacaciones (LFT art. 76, reforma 2023)**: año 1 = 12, 2 = 14, 3 = 16, 4 = 18, 5 = 20,
  6–10 = 22, 11–15 = 24… Anticipo de 6 días a los 6 meses. Acumulable (configurable).
- **Días hábiles**: lunes a viernes sin festivos. No se puede iniciar/terminar en festivo
  o fin de semana; los festivos dentro del rango no se descuentan.
- **Backup**: obligatorio según el beneficio. Se elige de la misma torre (o de todos si la
  persona no tiene torre). El backup debe estar disponible esas fechas, y quien es backup
  no puede pedir ausencias en los días que cubre.
- **Aprobadores**: excepción por usuario → aprobadores de su torre → administradores.
- **Correos**: al solicitar (colaborador, aprobadores, backup), al aprobar/rechazar
  (colaborador y backup) y al cancelar.
- **Perfil obligatorio**: nombre, apellidos, género, fecha de nacimiento y de ingreso.
  Si falta algo, el portal lleva al usuario a completarlo antes de continuar.

## Roles

| Rol | Acceso |
|---|---|
| Usuario | Inicio, calendario/solicitud, mis solicitudes, saldos, mapa del equipo, perfil |
| Aprobador | + Aprobaciones y reportes de las torres que aprueba |
| Admin | + Todo: usuarios, torres, festivos, beneficios, ajustes de saldo, configuración |

## Desarrollo local

```bash
npm install
npm --prefix frontend install
cp frontend/.env.example frontend/.env.development.local   # pon la URL de la API
npm run dev        # http://localhost:5173
npm test           # pruebas del cálculo de saldos/LFT
```

> La carpeta de OneDrive contiene `&` en la ruta, lo que rompe los atajos `npx`/`.bin`
> de npm en Windows; por eso los scripts invocan Vite con `node node_modules/vite/bin/vite.js`.

## Despliegue

Requiere AWS CLI/SDK con credenciales de la cuenta (perfil local). Parámetros en
`.env` (ver `.env.example`).

```bash
npm run infra:tablas   # crea las tablas Go_Productivity_* (idempotente)
npm run infra:config   # jwt_secret, remitente, beneficios y festivos (no sobrescribe)
npm run infra:migrar   # simulación de migración desde NAVE_* (agrega --aplicar para escribir)
npm run deploy:api     # rol IAM + Lambda + Function URL
npm run deploy:web     # build + S3 + CloudFront + CORS + app_url
```

## Recursos del portal anterior (pendientes de eliminar tras la validación)

Bucket `nave-doti-oxxo`, tablas `NAVE_Vacaciones`, `NAVE_Reporte_Usuarios_Web`,
`NAVE_Beneficios`, `NAVE_Recuperar_Cuenta`, `NAVE_Saldo_Adicional_Beneficios`, Lambdas
`Obtener_Saldos_Beneficios`, `Send_Email` (Gmail), `Send_Team_MSG`, la llave IAM usada
en `credenciales.js` y la app de Amplify `portal-vacaciones` (intento previo en Next.js).
