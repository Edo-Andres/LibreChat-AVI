# Auditoría de Seguridad — LibreChat-AVI

| Campo | Valor |
|---|---|
| **Proyecto** | LibreChat-AVI (fork de LibreChat `v0.8.0-rc4`) |
| **Rama auditada** | `perfiles` (commit `bf56e4750`) |
| **Fecha** | 2026-07-27 |
| **Tipo** | Auditoría READ-ONLY (SCA + revisión de configuración + revisión de código) |
| **Alcance** | Monorepo completo: `api/`, `client/`, `packages/*`, Docker, CI/CD, configuración |
| **Modificaciones realizadas** | Ninguna. Solo lectura y ejecución de `npm audit` / `npm outdated`. |

---

## RESUMEN EJECUTIVO

| Métrica | Valor |
|---|---|
| Vulnerabilidades **CRITICAL** (npm audit) | **5** |
| Vulnerabilidades **HIGH** (npm audit) | **43** |
| Vulnerabilidades MODERATE / LOW | 69 / 14 |
| **Total advisories** | **131** sobre 3.659 dependencias resueltas |
| Paquetes desactualizados (total) | **211** |
| Paquetes desactualizados (**major** de retraso) | **97** |
| Hallazgos de configuración CRITICAL | **1** (secretos por defecto en producción) |
| Hallazgos de configuración HIGH | **5** |

### Riesgo general: **CRÍTICO**

El nivel crítico **no** lo determina el `npm audit` (que por sí solo daría ALTO), sino un hallazgo de
configuración concreto y explotable de forma remota:

> **Los cuatro secretos criptográficos de la aplicación (`JWT_SECRET`, `JWT_REFRESH_SECRET`,
> `CREDS_KEY`, `CREDS_IV`) más `MEILI_MASTER_KEY` conservan exactamente los valores de ejemplo
> públicos de LibreChat en los tres archivos de entorno del proyecto, incluido el de producción
> (`.env.copy.master` → `https://avi.corporacionccm.cl`).**

Estos valores están publicados en el repositorio upstream de LibreChat y son de conocimiento público.
Cualquier persona en Internet puede forjar un JWT válido para cualquier usuario —incluido un `ADMIN`—
y descifrar las credenciales de proveedores de IA almacenadas en la base de datos. Esto anula por
completo el control de acceso de la plataforma.

Adicionalmente, el backend **no usa `helmet` ni ninguna cabecera de seguridad**, y aplica
`cors()` sin restricción de orígenes.

---

## HALLAZGOS POR PRIORIDAD

---

### 🔴 [CRITICAL-01] Secretos de firma y cifrado con los valores de ejemplo públicos de LibreChat

**Archivos afectados**
- `.env` (entorno local — no versionado)
- `.env.copy.dev` (`DOMAIN_CLIENT=https://avi-dev.corporacionccm.cl`)
- `.env.copy.master` (`DOMAIN_CLIENT=https://avi.corporacionccm.cl` ← **producción**)
- `.env.example` líneas 241-242, 419-420, 328 (origen de los valores)
- Verificación en código: `api/server/services/start/checks.js:10-15`

**Evidencia** (comparación programática contra `.env.example`; valores enmascarados):

| Variable | `.env` | `.env.copy.dev` | `.env.copy.master` |
|---|---|---|---|
| `JWT_SECRET` | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo |
| `JWT_REFRESH_SECRET` | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo |
| `CREDS_KEY` | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo |
| `CREDS_IV` | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo |
| `MEILI_MASTER_KEY` | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo | ⚠️ valor de ejemplo |

El propio código de LibreChat mantiene una lista de estos valores exactos
(`api/server/services/start/checks.js`) precisamente para advertir en el log de arranque
(`logger.warn('Default value for ${key} is being used.')`). **La advertencia está siendo ignorada.**

**Riesgo**
1. **Bypass total de autenticación.** `JWT_SECRET` firma los access tokens
   (`packages/api/src/crypto/jwt.ts:10`) que valida `api/strategies/jwtStrategy.js:11`. Con el secreto
   conocido, un atacante forja `{ id: "<ObjectId de cualquier usuario>" }` y obtiene sesión completa.
   Si conoce o adivina el `_id` de un administrador, obtiene privilegios de administración.
2. **Falsificación de refresh tokens.** `JWT_REFRESH_SECRET` permite emitir sesiones persistentes y
   además firma el acceso a imágenes (`api/server/middleware/validateImageRequest.js:31`) → lectura de
   archivos subidos por otros usuarios.
3. **Descifrado de credenciales almacenadas.** `CREDS_KEY`/`CREDS_IV` cifran en MongoDB las API keys de
   proveedores (OpenAI, Anthropic, Google…), tokens OAuth de acciones y credenciales de MCP. Con acceso
   a un volcado de BD, todas son recuperables en texto plano.
4. **Acceso administrativo a Meilisearch**, que indexa el contenido íntegro de las conversaciones.
5. Se usa **el mismo secreto en dev y en producción**: comprometer el entorno de desarrollo compromete
   producción.

**Acción recomendada**
1. Generar valores únicos por entorno (`openssl rand -hex 32` para las claves de 64 caracteres,
   `openssl rand -hex 16` para `CREDS_IV`, y una clave nueva para Meilisearch).
2. Rotarlos en el gestor de secretos del despliegue (Dokploy) y **no** en archivos `.env.copy.*` del
   repositorio de trabajo.
3. **Tras rotar `CREDS_KEY`/`CREDS_IV` los datos cifrados existentes quedan ilegibles**: planificar
   re-cifrado o invalidación de las credenciales de usuario guardadas.
4. Invalidar todas las sesiones activas y forzar re-login.
5. Rotar todas las API keys de proveedores que hayan estado almacenadas bajo la clave por defecto —
   deben considerarse comprometidas.
6. Convertir la advertencia de `checks.js` en un fallo duro (`process.exit`) cuando
   `NODE_ENV=production`.

> **Nota positiva:** ningún archivo `.env` está versionado. `.gitignore:75` aplica `.env*` con excepción
> solo para `.env.example`, y `git log --all -- .env .env.copy.*` no devuelve commits. La exposición
> proviene de que los valores *son públicos por origen*, no de una fuga del repositorio.

---

### 🔴 [CRITICAL-02] Dependencias con advisories CRITICAL en el árbol de producción

`npm audit` (workspace raíz; el monorepo comparte un único `package-lock.json`, por lo que este audit
cubre `api/`, `client/` y `packages/*`):

| Paquete | Versión | CVSS máx. | Vector | Ruta |
|---|---|---|---|---|
| `fast-xml-parser` | 4.4.1 | **9.3** | Bypass de codificación de entidades vía inyección regex en DOCTYPE; DoS por expansión de entidades | `api/` (directo vía `@aws-sdk/*`, `@azure/core-xml`, `@google-cloud/storage`, `@langchain/anthropic`) |
| `protobufjs` | 7.4.0 | **9.8** | Ejecución arbitraria de código; contaminación de prototipos | transitiva (`@google-cloud/*`, gRPC) |
| `handlebars` | 4.7.8 | **9.8** | Inyección de JavaScript por confusión de tipos en el AST | **directa** en `api/package.json` |
| `websocket-driver` | 0.7.4 | — | Bypass de límite de recursos vía compresión de mensajes | transitiva |
| `convict` | 6.2.4 | — | Contaminación de prototipos vía `load()`/`loadFile()` | transitiva |

**Riesgo**
- `fast-xml-parser` procesa respuestas XML de S3/Azure Blob/GCS y de la API de Anthropic. Un endpoint
  S3-compatible hostil o un proxy inverso manipulado puede provocar DoS del backend.
- `protobufjs` con CVSS 9.8 (RCE) está en la cadena de `@google-cloud/bigquery` y `@google-cloud/storage`,
  ambos activamente usados por los scripts de exportación de chats.
- **`handlebars` tiene riesgo real reducido en este proyecto**: se verificó su uso y solo compila
  plantillas estáticas de correo desde disco (`api/server/utils/sendEmail.js:96`, plantillas
  `verifyEmail.handlebars`, `passwordReset.handlebars`, `inviteUser.handlebars`). Los CVE de confusión
  de AST requieren plantillas controladas por el atacante. Se mantiene como acción prioritaria por
  higiene, pero no es explotable con la superficie actual.

**Acción recomendada**
- Ejecutar `npm audit fix` (la mayoría reporta `fixAvailable: true` sin cambio de major).
- Forzar `fast-xml-parser` a `>=5.6.1` y `protobufjs` a `>=7.6.3` vía `overrides` en el `package.json`
  raíz, junto a los overrides ya existentes.
- Actualizar `handlebars` a la última 4.x parcheada.

---

### 🟠 [HIGH-01] Ausencia total de cabeceras de seguridad (sin `helmet`, sin CSP)

**Archivo:** `api/server/index.js:74-80`

```js
app.use(noIndex);
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(mongoSanitize());
app.use(cors());
app.use(cookieParser());
```

Búsqueda de `helmet` / `contentSecurityPolicy` / `Content-Security-Policy` en `api/server` y
`packages/api/src`: **cero coincidencias**. `helmet` tampoco figura en `api/package.json`.
`client/nginx.conf` tampoco añade cabeceras (la única línea `Strict-Transport-Security` está comentada,
dentro del bloque SSL inactivo, líneas 74-76).

Cabeceras ausentes: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
Lo único presente es `app.disable('x-powered-by')` y `noIndex`.

**Riesgo**
- **Sin CSP**, cualquier XSS (ver `MEDIUM-01`) escala a exfiltración total: el token JWT vive en memoria
  del cliente y el atacante puede enviarlo a un dominio externo sin restricción.
- **Sin `X-Frame-Options`/`frame-ancestors`**: clickjacking sobre la interfaz de chat.
- **Sin HSTS**: degradación a HTTP y ataques de máquina intermedia en el primer contacto.
- **Sin `X-Content-Type-Options: nosniff`**: MIME sniffing sobre archivos subidos servidos desde
  `/images/` y `/uploads`.

**Acción recomendada**
Añadir `helmet` en `api/server/index.js` antes del registro de rutas, con CSP explícita
(hay que contemplar `posthog-js`, ElevenLabs `elevenlabs-convai`, Sandpack/CodeSandbox y los blobs de
`react-avatar-editor`), o bien inyectar las cabeceras en `client/nginx.conf` si se prefiere el borde.

---

### 🟠 [HIGH-02] CORS abierto a cualquier origen

**Archivo:** `api/server/index.js:78` → `app.use(cors());`

Sin opciones, el middleware `cors` responde `Access-Control-Allow-Origin: *` para **todas** las rutas,
incluidas `/api/auth`, `/api/keys`, `/api/user` y `/api/agents`. Además, `ALLOWED_ORIGINS` **no está
definida** en ninguno de los tres archivos de entorno (`.env`, `.env.copy.dev`, `.env.copy.master`).

**Riesgo**
`Access-Control-Allow-Credentials` no se activa, por lo que las cookies `httpOnly` de refresh no viajan
en peticiones cross-origin — eso limita el impacto directo. Sin embargo, cualquier sitio web puede
consumir la API con un token robado y leer las respuestas, y se pierde la defensa en profundidad frente
a CSRF y frente al abuso de endpoints no autenticados (`/api/config`, `/api/banner`).

**Acción recomendada**
Configurar `cors({ origin: <lista blanca desde DOMAIN_CLIENT/ALLOWED_ORIGINS>, credentials: true })`
y definir `ALLOWED_ORIGINS` en cada entorno.

---

### 🟠 [HIGH-03] La imagen de producción se ejecuta como `root`

**Archivo:** `Dockerfile.multi`, etapa `api-build` (líneas 66-115)

La etapa que el pipeline publica **no contiene ninguna directiva `USER`**, por lo que el proceso Node
corre como `root` (UID 0) dentro del contenedor. Contraste:

- `Dockerfile` (línea 20): `USER node` ✅
- `Dockerfile.multi` etapa `api-build`: sin `USER` ❌
- `.github/workflows/ci-docker-build.yml` construye `file: Dockerfile.multi`, `target: api-build` y
  hace `push: true` → **la imagen desplegada es la que corre como root**.
- `deploy-compose.yml` y `deploy-compose-dokploy.yml` tampoco declaran `user:` (a diferencia de
  `docker-compose.yml`, que sí usa `user: "${UID}:${GID}"`).

**Riesgo**
Cualquier RCE en el backend (p. ej. vía `protobufjs`, o a través de la ejecución de servidores MCP con
`uv`/`uvx` que la imagen instala) se convierte en root dentro del contenedor, facilitando el escape a
través de volúmenes montados (`/app/uploads`, `/app/api/logs`, `/app/librechat.yaml`) y aumentando el
impacto de un fallo del runtime.

**Acción recomendada**
Añadir en la etapa `api-build`: creación del directorio con `chown node:node`, `USER node` antes del
`CMD`, y verificar que los bind-mounts de Dokploy (`../files/*`) tengan permisos coherentes.

---

### 🟠 [HIGH-04] MongoDB sin autenticación en todos los archivos de despliegue

**Archivos:**
- `docker-compose.yml:44` → `command: mongod --noauth` **+ línea 45-46: `ports: - 27017:27017`**
- `deploy-compose.yml:53` → `command: mongod --noauth`
- `deploy-compose-dokploy.yml:66` → `command: mongod --noauth`

En `docker-compose.yml` el puerto 27017 está **descomentado y publicado en el host** (`0.0.0.0:27017`),
pese al comentario adyacente que advierte «*not safe in deployment*».

**Riesgo**
Base de datos sin credenciales accesible desde cualquier interfaz de red del host: lectura y escritura
completa de conversaciones, usuarios, hashes de contraseña y credenciales cifradas. Combinado con
`CRITICAL-01`, las credenciales cifradas se descifran trivialmente.

**Acción recomendada**
- Eliminar la publicación del puerto 27017 en `docker-compose.yml`.
- Habilitar autenticación de MongoDB (`MONGO_INITDB_ROOT_USERNAME`/`PASSWORD`) y actualizar `MONGO_URI`
  con credenciales, al menos en `deploy-compose.yml` y `deploy-compose-dokploy.yml`.

---

### 🟠 [HIGH-05] Credenciales de PostgreSQL/pgvector hardcodeadas

**Archivos:**
- `docker-compose.yml:62-64`
- `deploy-compose.yml:70-72`
- `deploy-compose-dokploy.yml:87-89`
- `rag.yml:7-9` y `rag.yml:19-21` — **además publica el puerto `5433:5432` en el host**

```yaml
POSTGRES_DB: mydatabase
POSTGRES_USER: myuser
POSTGRES_PASSWORD: mypassword
```

**Riesgo**
La base vectorial contiene los embeddings de los documentos cargados por los usuarios (RAG), es decir,
contenido potencialmente sensible. `rag.yml` la expone en el host con credenciales triviales y públicas.

**Acción recomendada**
Sustituir por variables `${POSTGRES_*}` resueltas desde el gestor de secretos y retirar la publicación
del puerto 5433.

---

### 🟠 [HIGH-06] 43 advisories HIGH en dependencias — subconjunto directamente relevante

Paquetes **directos** con advisories HIGH que están en la ruta caliente de la aplicación:

| Paquete | Instalada | Advisory relevante | CVSS |
|---|---|---|---|
| `mongoose` | 8.12.1 | Sanitización incorrecta de `$nor` en `sanitizeFilter` → NoSQL injection (GHSA-wpg9-53fq-2r8h) | 7.5 |
| `axios` | 1.12.1 | SSRF por bypass de `NO_PROXY`; MitM completo vía prototype pollution en `config.proxy` (GHSA-35jp-ww65-95wh) | 8.7 |
| `express` | 4.21.2 | ReDoS vía `path-to-regexp`, `qs`, `body-parser` | 7.5 |
| `@langchain/core` | 0.3.62 | Inyección de serialización → **extracción de secretos** (GHSA-r399-636x-v7f6) | 8.6 |
| `@langchain/community` | 0.3.47 | Bypass de SSRF en `RecursiveUrlLoader`; arrastra `expr-eval` (prototype pollution, 7.3) | 7.3+ |
| `@modelcontextprotocol/sdk` | ≤1.17.x | Fuga de datos entre clientes por reutilización de transporte; sin protección DNS-rebinding por defecto | 7.1 |
| `multer` | 2.0.2 | 5 advisories de DoS (nombres de campo anidados, limpieza incompleta de subidas abortadas) | 7.5 |
| `nodemailer` | 6.9.15 | Inyección de comandos SMTP vía CRLF; SSRF y lectura de archivos vía opción `raw` | 7.1 |
| `undici` | 7.10.0 | HTTP request smuggling; agotamiento de memoria en WebSocket | 7.5 |
| `js-yaml` | 4.1.0 | Prototype pollution en claves de merge; DoS cuadrático | 7.5 |
| `lodash` | 4.17.21 | Code injection en `_.template`; prototype pollution en `_.unset`/`_.omit` | 8.1 |
| `sharp` | 0.33.5 | Vulnerabilidades heredadas de libvips (CVE-2026-33327/33328/35590/35591) | — |
| `form-data` | 4.0.4 | Inyección CRLF en nombres de campo multipart | 7.5 |
| `js-cookie` | 3.0.5 | Secuestro de prototipo en `assign()` → inyección de atributos de cookie | 7.5 |
| `react-router-dom` | 6.22.0 | XSS vía open redirect; redirección externa inesperada | — |
| `jws` (vía `jsonwebtoken`) | — | **Verificación incorrecta de firma HMAC** (GHSA-869p-cjfg-cm3x) | 7.5 |
| `vite` | 6.3.6 | Bypass de `server.fs.deny` en Windows; lectura arbitraria de archivos vía WebSocket del dev server | 7.5 |

**Nota sobre `mongoose`:** el backend aplica `express-mongo-sanitize` globalmente
(`api/server/index.js:77`), lo que mitiga la inyección NoSQL en la capa de entrada. El advisory de
`$nor` afecta a `sanitizeFilter` de mongoose, una defensa secundaria. La combinación reduce el riesgo
práctico, pero conviene actualizar.

**Nota sobre `vite`:** es dependencia de desarrollo; el bug del dev server no afecta al artefacto de
producción, pero sí a las máquinas de los desarrolladores (todas ellas Windows en este proyecto).

---

### 🟡 [MEDIUM-01] `dangerouslySetInnerHTML` sin sanitizar en dos componentes

| Archivo | Línea | Origen del HTML | ¿Sanitizado? |
|---|---|---|---|
| `packages/client/src/components/Tooltip.tsx` | 104 | `description` prop | ✅ **Sí** — `DOMPurify` con configuración explícita (líneas 25-51) |
| `client/src/components/Banners/Banner.tsx` | 36 | `banner.message` desde `/api/banner` (BD) | ❌ **No** |
| `client/src/components/Chat/Input/MCPConfigDialog.tsx` | 86 | `details.description` de la config del servidor MCP | ❌ **No** |

**Riesgo**
- **Banner:** el contenido lo fija un administrador mediante `npm run update-banner`. Es XSS almacenado
  con requisito de privilegio administrativo → riesgo moderado en condiciones normales, **pero se
  convierte en crítico combinado con `CRITICAL-01`**, ya que forjar un JWT de administrador es trivial.
  El banner se renderiza para todos los usuarios de la plataforma.
- **MCPConfigDialog:** `details.description` proviene de la definición de variables de servidores MCP.
  Si se permite a usuarios no administradores registrar servidores MCP, un servidor hostil inyecta HTML
  arbitrario en el diálogo de configuración de la víctima.

Sin CSP (`HIGH-01`), ambos permiten exfiltración directa del token de sesión.

**Acción recomendada**
Reutilizar el patrón ya presente en `Tooltip.tsx`: envolver ambos valores con `DOMPurify.sanitize()`
restringido a etiquetas de formato (`b`, `i`, `a`, `br`, `span`) y atributos seguros.

**Verificado como correcto:** no se usa `rehype-raw` ni `allowDangerousHtml` en el pipeline de
`react-markdown` (búsqueda sin coincidencias), por lo que el renderizado de respuestas del modelo —la
superficie más expuesta— **no** interpreta HTML crudo.

---

### 🟡 [MEDIUM-02] `ALLOW_UNVERIFIED_EMAIL_LOGIN=true` con registro abierto en producción

**Archivos:** `.env`, `.env.copy.dev`, `.env.copy.master` (los tres idénticos)

```
ALLOW_REGISTRATION=true
ALLOW_UNVERIFIED_EMAIL_LOGIN=true
```

**Riesgo**
Registro público sin verificación de correo en una plataforma que expone modelos de IA de pago. Permite
creación masiva de cuentas, consumo de presupuesto de API y evasión de trazabilidad. No se encontró
`CHECK_BALANCE` definido en ningún `.env`.

**Acción recomendada**
En producción: `ALLOW_UNVERIFIED_EMAIL_LOGIN=false`, y restringir el registro con
`ALLOWED_REGISTRATION_DOMAINS` (o `interface.registration.allowedDomains` en `librechat.yaml`) al
dominio corporativo. Considerar `ALLOW_REGISTRATION=false` + flujo de invitación, que ya existe
(`config/invite-user.js`).

---

### 🟡 [MEDIUM-03] Rate limiting: configurado y aplicado, pero con umbrales laxos y cobertura parcial

**Verificado como presente** — la implementación es correcta y usa store distribuido:
- `api/server/middleware/limiters/` contiene 12 limitadores (login, registro, reset de contraseña,
  mensajes, uploads, imports, forks, TTS, STT, tool calls, verificación de email).
- Se aplican en `api/server/routes/auth.js:37,46,54` y usan `limiterCache` (Redis) + `logViolation` +
  sistema de baneo (`BAN_VIOLATIONS=true`).

**Observaciones**
- `LOGIN_MAX=20` en ventana `LOGIN_WINDOW=10` min (el valor por defecto de LibreChat es 7/5min). Se ha
  **relajado** respecto al default: 20 intentos cada 10 minutos por IP facilita el password spraying,
  sobre todo con registro abierto.
- `FILE_UPLOAD_IP_MAX` e `IMPORT_IP_MAX` **no están definidas** en ningún `.env` → se usan los valores
  por defecto del código, no los ajustados a la carga real.
- `keyGenerator: removePorts` usa la IP del cliente; depende de `TRUST_PROXY=1`, que es correcto para el
  único proxy nginx del despliegue.

**Acción recomendada**
Restaurar `LOGIN_MAX` a ≤10 y definir explícitamente los límites de subida e importación.

---

### 🟡 [MEDIUM-04] El pipeline de CI/CD no ejecuta ninguna comprobación de seguridad ni tests

**Archivo:** `.github/workflows/ci-docker-build.yml` (único workflow del proyecto)

El pipeline hace: detección de cambios → login en GHCR → build → push. **No ejecuta**:
- Tests unitarios (`npm run test:api` / `test:client` existen pero no se invocan)
- Lint (`npm run lint` existe pero no se invoca)
- SCA (`npm audit`)
- SAST (CodeQL / Semgrep)
- Escaneo de la imagen (Trivy / Grype)
- Firma de imagen o generación de SBOM
- E2E de Playwright (configurados en `e2e/` pero sin workflow)

**Aspectos correctos verificados:** usa `secrets.GITHUB_TOKEN` (efímero, con scope automático), no hay
secretos en texto plano ni `echo` de secretos hacia los logs, y las acciones están fijadas a major
(`@v4`, `@v3`, `@v6`).

**Riesgo**
Los 131 advisories detectados en esta auditoría habrían sido visibles en cada push. Nada impide que una
regresión de seguridad llegue a `latest`/`stable` en GHCR, tags que el despliegue consume directamente.

**Acción recomendada**
Añadir un job `security` con `npm audit --audit-level=high`, `npm run lint`, los tests existentes, y un
escaneo de imagen con Trivy antes del `push`.

---

### 🟡 [MEDIUM-05] `npm ci` sin `--ignore-scripts` en la construcción de imágenes

**Archivos:** `Dockerfile:37` (`npm ci --no-audit`), `Dockerfile.multi:26` (`npm ci`) y
`Dockerfile.multi:72` (`npm ci --omit=dev`)

Con 3.659 dependencias resueltas, los scripts `postinstall` de cualquiera de ellas se ejecutan durante
el build. En `Dockerfile.multi` esto ocurre además **como root** (`HIGH-03`).

**Riesgo**
Vector de compromiso de cadena de suministro: un paquete transitivo comprometido ejecuta código
arbitrario con privilegios de root en el runner de GitHub Actions y en la imagen resultante.

**Acción recomendada**
Evaluar `npm ci --ignore-scripts` (requiere verificar que `sharp` y `tiktoken`, que sí necesitan
scripts de compilación de binarios nativos, sigan funcionando; posiblemente con una lista explícita).

---

### 🔵 [LOW-01] `console.log` de configuración en el cliente de producción

**Archivo:** `client/src/components/Chat/Input/ChatForm.tsx:222`

```js
console.log('ElevenLabs Agent ID desde Vite:', import.meta.env.VITE_ELEVENLABS_AGENT_ID);
```

El `agent-id` de ElevenLabs es un identificador público destinado al widget del navegador, por lo que no
constituye una fuga de secreto. Aun así, el log queda en el bundle de producción.

**Verificado como correcto:** `client/vite.config.ts:29` restringe `envPrefix` a
`['VITE_', 'SCRIPT_', 'DOMAIN_', 'ALLOW_']`, lo que **impide** que `JWT_SECRET`, `CREDS_KEY` u otras
variables del `.env` compartido (`envDir: '../'`) se filtren al bundle. Buena práctica ya implementada.

**Acción recomendada:** eliminar el `console.log` o encapsularlo en `client/src/utils/logger.ts`, que ya
existe y respeta `VITE_ENABLE_LOGGER`.

---

### 🔵 [LOW-02] `emails.txt` versionado y copiado a la imagen

**Archivos:** `emails.txt` (rastreado en git), `Dockerfile.multi:75-77`

Contiene tres direcciones de marcador (`usuario1@email.com`, `usuario2@email.com`, `usuario3@email.com`)
y alimenta `enviar-invitaciones.sh`, que itera `npm run invite-user "$email"`.

**Riesgo**
Actualmente inocuo, pero es un archivo de datos personales versionado por diseño: si alguien lo rellena
con correos reales del personal, quedarán en el historial de git de forma permanente y dentro de cada
imagen publicada en GHCR. El workflow de CI incluso lo trata como *root asset* que dispara rebuilds
(`ci-docker-build.yml`, filtro `root_assets`).

**Acción recomendada**
Añadir `emails.txt` a `.gitignore`, versionar en su lugar un `emails.txt.example`, y pasar la lista
como montaje en tiempo de ejecución en lugar de `COPY` en el Dockerfile.

---

### 🔵 [LOW-03] ESLint sin reglas de seguridad

**Archivo:** `eslint.config.mjs`

Presente y correcto: `react-hooks/rules-of-hooks: 'error'` (línea 254),
`react-hooks/exhaustive-deps: 'warn'` (línea 255), `jsx-a11y`, `import`, `i18next`, `typescript-eslint`.

Ausente: `eslint-plugin-security`, `eslint-plugin-no-unsanitized`, y `react/no-danger`, que habría
señalado los dos `dangerouslySetInnerHTML` sin sanitizar de `MEDIUM-01`.

**Acción recomendada**
Añadir `react/no-danger: 'warn'` como red de seguridad barata, y considerar
`eslint-plugin-no-unsanitized`.

---

## DEPENDENCIAS CRÍTICAS — Actualización inmediata

Ordenadas por urgencia. Todas reportan `fixAvailable: true` salvo indicación contraria.

### Bloque 1 — Sin cambio de major (aplicables ya)

| Paquete | Actual | Mínimo seguro | Motivo |
|---|---|---|---|
| `fast-xml-parser` | 4.4.1 | ≥5.6.1 | CVSS 9.3 — requiere `override` (major transitivo) |
| `protobufjs` | 7.4.0 | ≥7.6.3 | CVSS 9.8 — RCE |
| `handlebars` | 4.7.8 | última 4.x | CVSS 9.8 (mitigado en contexto) |
| `axios` | 1.12.1 | ≥1.17.1 | CVSS 8.7 — MitM; el `override` del root está **desactualizado** |
| `mongoose` | 8.12.1 | ≥8.24.1 | NoSQL injection |
| `express` | 4.21.2 | ≥4.22.2 | ReDoS en cadena `path-to-regexp`/`qs` |
| `@langchain/core` | 0.3.62 | ≥1.1.29 | CVSS 8.6 — extracción de secretos |
| `multer` | 2.0.2 | ≥2.1.2 | 5× DoS |
| `undici` | 7.10.0 | ≥7.27.3 | Request smuggling |
| `js-yaml` | 4.1.0 | ≥4.2.1 | Prototype pollution |
| `lodash` | 4.17.21 | ≥4.17.24 | CVSS 8.1 — code injection |
| `form-data` | 4.0.4 | ≥4.0.6 | CRLF injection — `override` root desactualizado |
| `js-cookie` | 3.0.5 | ≥3.0.6 | Prototype hijack |
| `jsonwebtoken` / `jws` | — | jws ≥3.2.3 / ≠4.0.0 | Verificación HMAC incorrecta |
| `@modelcontextprotocol/sdk` | ~1.17 | ≥1.25.4 | Fuga entre clientes |
| `@grpc/grpc-js` | — | >1.13.4 | Caída del servidor |
| `dompurify` | ≤3.4.11 | ≥3.4.12 | Múltiples bypasses de XSS (es la defensa de `Tooltip.tsx`) |
| `postcss` | ≤8.5.17 | ≥8.5.18 | XSS |
| `vite` | 6.3.6 | ≥6.4.3 | Lectura arbitraria de archivos (dev) |
| `@babel/plugin-transform-modules-systemjs` | — | >7.29.0 | Generación de código arbitrario |

### Bloque 2 — Requieren cambio de major (planificar, con pruebas)

| Paquete | Actual | Objetivo | Nota |
|---|---|---|---|
| `nodemailer` | 6.9.15 | 9.0.3 | 8 advisories, incl. inyección SMTP y SSRF. Salto de 3 majors |
| `sharp` | 0.33.5 | 0.35.3 | CVEs de libvips |
| `@langchain/community` | 0.3.47 | 1.1.29 | Arrastra `expr-eval` (prototype pollution) |
| `@librechat/agents` | 2.4.80 | 3.2.21+ | Arrastra `@langchain/*` vulnerables |
| `googleapis` / `@googleapis/youtube` | 126 / 20 | 173 / 33 | 47 y 13 majors de retraso |
| `file-type` | 18.7.0 | 22.0.1 | Bucle infinito en parser ASF |
| `react-router-dom` | 6.22.0 | 6.30.3+ | XSS vía open redirect (parche disponible dentro de v6) |

---

## CONFIGURACIÓN INSEGURA — Resumen

| # | Configuración | Archivo(s) | Severidad |
|---|---|---|---|
| 1 | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDS_KEY`, `CREDS_IV`, `MEILI_MASTER_KEY` con valores de ejemplo públicos, en dev **y producción** | `.env`, `.env.copy.dev`, `.env.copy.master` | CRITICAL |
| 2 | Sin `helmet`: sin CSP, HSTS, X-Frame-Options, nosniff | `api/server/index.js` · `client/nginx.conf` | HIGH |
| 3 | `cors()` sin lista blanca; `ALLOWED_ORIGINS` no definida | `api/server/index.js:78` | HIGH |
| 4 | Imagen de producción sin `USER` → corre como root | `Dockerfile.multi` (etapa `api-build`) | HIGH |
| 5 | `mongod --noauth` en los 3 compose; puerto 27017 publicado en el host | `docker-compose.yml:44-46` y otros | HIGH |
| 6 | `POSTGRES_PASSWORD: mypassword` hardcodeada; puerto 5433 publicado | `rag.yml`, los 3 compose | HIGH |
| 7 | `ALLOW_REGISTRATION=true` + `ALLOW_UNVERIFIED_EMAIL_LOGIN=true` | `.env.copy.master` | MEDIUM |
| 8 | `LOGIN_MAX=20/10min` (relajado sobre el default 7/5min) | `.env` | MEDIUM |
| 9 | `dangerouslySetInnerHTML` sin sanitizar (Banner, MCPConfigDialog) | `client/src/components/…` | MEDIUM |
| 10 | CI/CD sin tests, lint, SCA, SAST ni escaneo de imagen | `ci-docker-build.yml` | MEDIUM |
| 11 | `npm ci` ejecuta scripts de install (como root en `Dockerfile.multi`) | `Dockerfile*` | MEDIUM |
| 12 | Mismos secretos compartidos entre dev y producción | `.env.copy.*` | HIGH |
| 13 | Nginx sirve solo HTTP; todo el bloque SSL/HSTS está comentado | `client/nginx.conf` | MEDIUM † |

† Mitigado si Dokploy/Traefik termina TLS en el borde, como sugieren los comentarios de
`deploy-compose-dokploy.yml:45-51`. Verificar que HSTS se emita efectivamente en el edge.

---

## CONFIGURACIONES CORRECTAS VERIFICADAS

Conviene documentar lo que **no** hay que tocar:

| Control | Estado | Evidencia |
|---|---|---|
| Archivos `.env` fuera de git | ✅ | `.gitignore:75` (`.env*`, con excepción solo de `.env.example`); `git log --all` sin commits |
| Sin secretos reales hardcodeados | ✅ | Escaneo de patrones (`sk-*`, `AIza*`, `ghp_*`, `AKIA*`, claves privadas PEM) sobre archivos versionados: solo fixtures de test |
| `librechat.yaml` sin API keys | ✅ | Escaneo sin coincidencias; usa referencias `${VAR}` |
| Cookies de refresh endurecidas | ✅ | `AuthService.js:389-399,437-458`: `httpOnly: true`, `secure: isProduction`, `sameSite: 'strict'` |
| `express-mongo-sanitize` global | ✅ | `api/server/index.js:77`, antes de todas las rutas |
| Rate limiting con store distribuido | ✅ | 12 limitadores en Redis + `logViolation` + baneo automático |
| `envPrefix` de Vite restringido | ✅ | `vite.config.ts:29` impide filtrar secretos del `.env` compartido al bundle |
| Markdown sin HTML crudo | ✅ | Sin `rehype-raw` ni `allowDangerousHtml` |
| `Tooltip.tsx` sanitizado | ✅ | `DOMPurify` con allowlist explícita |
| Sin JWT en `localStorage` | ✅ | Solo IDs de agente, borradores y timestamps |
| Multer con filtro de tipo y límite | ✅ | `routes/files/multer.js:74-79` + validación de tamaño en `Files/process.js:1016` |
| Nombres de archivo saneados | ✅ | `sanitizeFilename()` + `crypto.randomUUID()` como `file_id` |
| `x-powered-by` deshabilitado | ✅ | `api/server/index.js:51` |
| `trust proxy` configurado | ✅ | `TRUST_PROXY=1`, coherente con un único nginx |
| CI sin secretos en logs | ✅ | Solo `secrets.GITHUB_TOKEN`; acciones fijadas a major |
| `.dockerignore` excluye ocultos | ✅ | Patrón `.*` → `.env` nunca entra en la imagen |

---

## RECOMENDACIONES — Top 5 por impacto/esfuerzo

### 1. Rotar los cinco secretos criptográficos — **impacto máximo, esfuerzo bajo**
Genera valores únicos por entorno y cárgalos desde el gestor de secretos de Dokploy, no desde
`.env.copy.*`. Es un cambio de minutos que cierra un bypass total de autenticación.
**Ojo con el orden:** rotar `CREDS_KEY`/`CREDS_IV` invalida las credenciales cifradas ya guardadas —
planifica el re-cifrado o la invalidación antes de aplicar. Rota también las API keys de proveedores que
estuvieron almacenadas bajo la clave por defecto. Complementa con un `process.exit(1)` en
`checks.js` cuando se detecten valores por defecto en producción.

### 2. Añadir `helmet` con CSP y cerrar CORS — **impacto alto, esfuerzo bajo**
Dos líneas en `api/server/index.js`. Convierte cualquier XSS futuro en un problema contenido en lugar de
en una exfiltración de sesión, y elimina el `Access-Control-Allow-Origin: *`. Al definir la CSP, incluye
`posthog-js`, el widget `elevenlabs-convai`, Sandpack y los blobs de `react-avatar-editor`.

### 3. Ejecutar `npm audit fix` y actualizar los `overrides` del root — **impacto alto, esfuerzo medio**
La mayoría de los 48 advisories CRITICAL/HIGH se resuelven sin cambio de major. Los `overrides` actuales
de `axios` (`1.12.1`) y `form-data` (`^4.0.4`) están **desactualizados y ya no cubren** los advisories
vigentes: súbelos a `1.17.1` y `^4.0.6`. Añade overrides nuevos para `fast-xml-parser` (≥5.6.1) y
`protobufjs` (≥7.6.3). Los overrides de `elliptic` y `katex` siguen siendo válidos y no aparecen en el
audit actual — mantenlos.

### 4. Endurecer el despliegue: root, MongoDB y PostgreSQL — **impacto alto, esfuerzo medio**
Un `USER node` en la etapa `api-build` de `Dockerfile.multi`, autenticación en MongoDB, credenciales de
PostgreSQL desde variables, y retirar la publicación de los puertos 27017 y 5433. Son cambios de
configuración sin impacto en el código de aplicación, y reducen drásticamente el radio de explosión de
cualquier RCE.

### 5. Añadir un job de seguridad al pipeline — **impacto medio, esfuerzo bajo**
`npm audit --audit-level=high`, `npm run lint`, los tests que ya existen, y Trivy sobre la imagen antes
del `push`. Es lo que convierte esta auditoría en un control continuo en lugar de una foto puntual.

---

## Notas de metodología

- **`npm audit` por workspace:** el proyecto usa npm workspaces con un **único `package-lock.json`** en
  la raíz. Ejecutar `npm audit` dentro de `client/`, `api/` o `packages/*` resuelve al mismo lockfile y
  produce el mismo resultado. El audit de la raíz cubre por tanto los seis workspaces; la columna «ruta»
  de las tablas indica el workspace que introduce cada dependencia.
- **Sobre paquetes sin mantenimiento:** confirmado que el proyecto arrastra `@tanstack/react-query@4`
  (v5 disponible, v4 sin soporte activo), `recoil@0.7.7` (proyecto archivado por Meta) y
  `react-virtualized@9.22.6` (sin releases desde 2020). **`recoil` y `jotai` coexisten** en
  `client/package.json` — dos gestores de estado en paralelo, con `recoil` en uso activo (p. ej.
  `Banner.tsx:3`). Migrar `recoil` → `jotai` eliminaría una dependencia abandonada y reduciría el bundle,
  pero es refactorización, no seguridad.
- **React 18 vs 19:** React 18.3.1 no tiene advisories abiertos. La actualización a 19 es deuda técnica,
  no un riesgo de seguridad; la bloquea de facto `@tanstack/react-query@4`.
- **Comandos ejecutados:** `npm audit --audit-level=low --json` y `npm outdated --json` en la raíz.
  Ambos son operaciones de solo lectura. No se ejecutó `npm audit fix`, `npm install` ni ninguna
  modificación de archivos del proyecto.
