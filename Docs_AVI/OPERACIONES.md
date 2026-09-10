# ­ƒöº Operaciones y Mantenimiento - LibreChat-AVI

**Validado contra c├│digo:** Junio 2026 (rama `dev`)
**Proyecto:** LibreChat-AVI - Asistente Virtual en Infancia

---

## ­ƒôï Tabla de Contenidos

1. [Resumen de Scripts](#resumen-de-scripts)
2. [Backup Programado a GCS](#backup-programado-a-gcs)
3. [Sincronizaci├│n a Google Sheets](#sincronizaci├│n-a-google-sheets)
4. [Health Check Audit](#health-check-audit)
5. [Conversation Suggestions](#conversation-suggestions)
6. [Invitaciones Masivas](#invitaciones-masivas)
7. [Limpieza de Chats Antiguos](#limpieza-de-chats-antiguos)
8. [Variables de Entorno](#variables-de-entorno)
9. [Cron Jobs en Dokploy](#cron-jobs-en-dokploy)

---

## Resumen de Scripts

Los scripts operativos viven en `scripts/` (wrappers shell) y `config/` (l├│gica Node). En producci├│n, `Dockerfile.multi` los copia al contenedor y se ejecutan v├¡a cron jobs de Dokploy.

| Script | Prop├│sito | Trigger |
|---|---|---|
| `scripts/backup-chats-gcs` | Orquestador unificado: cleanup ÔåÆ GCS ÔåÆ verify/email | Cron Dokploy (diario) |
| `scripts/health-check.sh` | Audit de endpoints + email de alerta | Cron Dokploy (`0 */6 * * *`) |
| `scripts/sync-chats.sh` | Export b├ísico ÔåÆ Google Sheets | Manual |
| `scripts/sync-chats-extended.sh` | Export extendido ÔåÆ Google Sheets | Manual |
| `scripts/sync-chats-gcs-extended.sh` | Export extendido ÔåÆ GCS | V├¡a orquestador |
| `scripts/gcs-to-sheets-historial.sh` | Consolida CSVs de GCS ÔåÆ Sheets | Manual |
| `scripts/cleanup-chats.sh` | Elimina chats antiguos | V├¡a orquestador |
| `enviar-invitaciones.sh` | Invitaciones masivas por email | Manual |

Wiring npm: `api/package.json:19-32` define los scripts que los wrappers invocan.

---

## Backup Programado a GCS

### Orquestador unificado ÔÇö `scripts/backup-chats-gcs`

**Archivo:** `scripts/backup-chats-gcs` (82 l├¡neas, archivo ├║nico ÔÇö no es directorio).

Flujo de 3 pasos:

1. **Cleanup** (`:30`): `sh "$SCRIPT_DIR/cleanup-chats.sh" "$@"` ÔÇö elimina conversaciones con `updatedAt` anterior al cutoff.
2. **Sync GCS** (`:41`): `sh "$SCRIPT_DIR/sync-chats-gcs-extended.sh"` ÔÇö exporta CSV extendido y sube a GCS.
3. **Verify + Email** (`:68`/`:71`): `node "$PROJECT_ROOT/config/verify-gcs-chats-extended.js"` ÔÇö verifica que el archivo exista en GCS y env├¡a email de ├®xito o error.

**Uso:**
```bash
sh /app/scripts/backup-chats-gcs --force --days 15
# Sin args: defaults a --force --days 15
```

- `--force`: eliminaci├│n real (sin esto, cleanup es dry-run).
- `--days N`: retenci├│n de chats en MongoDB (default 30; el cron usa 15).

> Si cualquier paso falla, los siguientes se marcan como error y `verify-gcs-chats-extended.js` env├¡a un email de error con el detalle.

### Subida a GCS ÔÇö `config/upload-to-gcs-extended.js`

- **Bucket:** `avi-bkt` (**hardcoded** `:7`, no se lee de env var).
- **Carpeta:** `chats/` (`:8`).
- **Filename:** `chats_extended_YYYY-MM-DD_HHMMSS.csv` (hora local `:37-40`).
- **Env var requerida:** `GOOGLE_CREDENTIALS_JSON` (JSON string de la service account).
- Lee `api/chats_extended.csv` y lo sube con `contentType: text/csv`.

> **GCS no auto-elimina objetos.** La retenci├│n de 15 d├¡as aplica solo a conversaciones en MongoDB. Los archivos en GCS se acumulan sin limpieza autom├ítica.

### Verificaci├│n ÔÇö `config/verify-gcs-chats-extended.js`

- Verifica que exista un archivo con `_YYYY-MM-DD_` (fecha UTC `:62`) en el bucket.
- Bucket: `GCS_BUCKET_NAME` (default `avi-bkt`, `:57`), path `GCS_BUCKET_PATH` (default `chats/`, `:58`).
- Env├¡a email v├¡a `EmailNotifier` con `notificationType: 'gcs-backup-verify'` (`:160`).
- **Asuntos:** ├®xito ÔåÆ `Ô£à Respaldo programado OK: limpieza + exportacion a GCS`; error ÔåÆ `ÔØî Respaldo programado fallido: cleanup/sync GCS`.
- **Destinatarios:** ├®xito ÔåÆ primer admin; error ÔåÆ primeros 2 admins (`slice(0,2)` `:24-27`).
- **Exit codes:** 0 encontrado, 2 no encontrado, 1 error.

### Historial consolidado ÔÇö `config/gcs-to-sheets-historial.js`

- Descarga **todos** los CSVs de `gs://avi-bkt/chats/`, los mergea, deduplica por `conversationId::messageId` (`:157-183`), ordena por `messageCreatedAtEpoch` desc (`:225-237`).
- Sube a Google Sheets, tab `Historial` (`:9`).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON`, `GOOGLE_SHEETS_ID` (default `1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U`), `GCS_BUCKET_NAME` (default `avi-bkt`), `GCS_BUCKET_PATH` (default `chats/`), `GCS_HISTORIAL_FILE_PREFIX` (default `chats_extended_`).
- Wrapper: `scripts/gcs-to-sheets-historial.sh` (dual container/local).

---

## Sincronizaci├│n a Google Sheets

### Sync b├ísico ÔÇö `scripts/sync-chats.sh`

- Exporta `api/chats.csv` **con el mismo esquema que Historial** (20 cols) via `config/export-all-chats-extended.js --mask-pii` y sube a Sheets tab `Daily` (`config/upload-to-sheets.js:10`).
- **Spreadsheet:** `1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U` (override via `GOOGLE_SHEETS_ID`), tab `Daily`.
- **Columnas Daily (20, identicas a Historial):** `userId,userEmail,userName,userPhone,userAgeRange,userRegion,userParticipationConsent,userAviRole,userAviSubrole,userCreatedAt,conversationId,conversationTitle,conversationCreatedAt,conversationUpdatedAt,sender,text,isCreatedByUser,messageId,messageCreatedAt,messageCreatedAtEpoch,feedback` - con `userEmail/userName/userPhone = "***"` (enmascaradas).
- **Comando:** `sh /app/scripts/sync-chats.sh` (por defecto enmascara) o `sh /app/scripts/sync-chats.sh --mask-pii` explicito; `sh /app/scripts/sync-chats.sh --no-mask` solo debug sin mascara.
- **NPM:** `api/package.json:export-chats-daily = node ../config/export-all-chats-extended.js csv ../api/chats.csv --mask-pii`, `sync-chats-to-sheets = export-chats-daily && upload-to-sheets`, `sync-chats-to-sheets:raw` (sin mascara).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON` (req), `GOOGLE_SHEETS_ID` (opt, override del default).
- Borra el CSV local tras subir (`config/upload-to-sheets.js:106-115`). El CSV no se sube a GCS.

### Sync extendido ÔÇö `scripts/sync-chats-extended.sh`

- Exporta `api/chats_extended.csv` (con datos de usuario, AVI roles, mensajes, feedback) y sube a Sheets.
- **Spreadsheet:** mismo ID, tab `Hoja 1` (**hardcoded** en `config/upload-to-sheets-extended.js:8-9`, **NO** lee `GOOGLE_SHEETS_ID`).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON` (req).

### Columnas del CSV extendido

`config/export-all-chats-extended.js:214-236`:

```
userId, userEmail, userName, userPhone, userParticipationConsent,
userAviRole, userAviSubrole, userCreatedAt,
conversationId, conversationTitle, conversationCreatedAt, conversationUpdatedAt,
sender, text, isCreatedByUser, messageId, messageCreatedAt,
messageCreatedAtEpoch, feedback
```

- `userAviRole` / `userAviSubrole` se populan desde `aviRol_id`/`aviSubrol_id` (`:105-108`).
- Fechas en zona `America/Santiago` (env `TZ`, `:57`).
- CLI: `node config/export-all-chats-extended.js [csv|json] [outputFile] [--mask-pii]` (default `csv` -> `chats_extended.csv`; Daily usa `csv ../api/chats.csv --mask-pii`).

> **Diferencia entre los dos uploaders:** el b├ísico respeta `GOOGLE_SHEETS_ID` como override; el extendido lo tiene hardcoded. Si necesitas cambiar el spreadsheet del extendido, hay que editar `config/upload-to-sheets-extended.js:8`.
> **Nota Daily vs Historial:** Daily usa mismo esquema 20 cols que Historial pero con *** en PII y sin subida a GCS. Historial consolida todos los CSV de GCS con dedupe/sort.

---

## Health Check Audit

### Script ÔÇö `scripts/health-check.sh`

Dual-mode: detecta `/app/api` (Docker) o usa `../api` (local). Ejecuta `npm run health-check-audit` ÔåÆ `config/health-check/health-check-with-email.js`.

### Qu├® audita ÔÇö `config/health-check/health-check-with-email.js` (412 l├¡neas)

1. `GET /api/config` y `/api/banner` (config y banner cargan).
2. `POST /api/auth/login` con `HEALTH_CHECK_EMAIL` / `HEALTH_CHECK_PASSWORD` (login OK).
3. `GET /api/user` y `/api/agents` (datos esenciales cargan).
4. `POST /api/agents/chat` con payload de test `"mensaje test diario, responde test ok"` (`:187-200`).
5. Valida la respuesta contra ~20 patrones de error (`:278-299`).

### Alertas por email

- **├ëxito** ÔåÆ email al **primer** admin ├║nicamente (`:244`).
- **Error** ÔåÆ email a **todos** los admins (`:264`).
- Asunto ├®xito: reporta endpoints verificados.
- Asunto error: incluye detalles del fallo.

### Configuraci├│n ÔÇö `config/health-check/load-config.js`

Env vars requeridas: `HEALTH_CHECK_URL`, `HEALTH_CHECK_EMAIL`, `HEALTH_CHECK_PASSWORD`, `HEALTH_CHECK_AGENT_ID`.
Env var de destinatarios: `HEALTH_CHECK_ADMIN_EMAIL` (coma-separado, `:8-28`).
- `adminEmailSuccess` = primer email (`:24`).
- `adminEmailError` = todos joinados (`:25`).

### SMTP ÔÇö `config/services/email-notifier.js` (349 l├¡neas)

| Env var | Default | Descripci├│n |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | Host SMTP |
| `EMAIL_PORT` | `587` | Puerto |
| `EMAIL_ENCRYPTION` | ÔÇö | `ssl` ÔåÆ `secure: true` |
| `EMAIL_USERNAME` | ÔÇö | Usuario |
| `EMAIL_PASSWORD` | ÔÇö | Password |
| `EMAIL_FROM` | ÔÇö | Remitente |
| `EMAIL_FROM_NAME` | ÔÇö | Nombre remitente |
| `EMAIL_SERVICE` | ÔÇö | `gmail` ÔåÆ handling especial |
| `EMAIL_ALLOW_SELFSIGNED` | ÔÇö | `true` ÔåÆ certs self-signed |

Soporta 2 notification types: `health-check` (default) y `gcs-backup-verify` (`:62-64`, `:149-151`).

---

## Conversation Suggestions

### Configuraci├│n en `librechat.yaml`

```yaml
conversationSuggestions:
  enabled: true
  defaultInitialSuggestions:
    - "┬┐C├│mo puedo construir confianza con un ni├▒o/a que me rechaza o me ignora?"
    - "┬┐C├│mo puedo cuidarme yo para poder seguir cuidando bien?"
    - "┬┐C├│mo debo reaccionar cuando el ni├▒o/a tiene una crisis o pierde el control?"
    - "┬┐Qu├® es el trauma complejo y c├│mo afecta a los ni├▒os/as?"
  fastModel: "gemini-2.5-flash-lite"
```

- `defaultInitialSuggestions`: m├íx 4 entradas (Zod `max(4)`, `config.ts:836-838`).
- `fastModel`: modelo para generar follow-ups (default `gemini-1.5-flash`, `generateFollowUp.js:84`).

### Carga de sugerencias iniciales

Ruta: `GET /api/suggestions/initial` ÔåÆ `api/server/routes/suggestions.js:15-47`.

**Prioridad:**
```
aviSubrol.initial_suggestions  ÔåÆ  aviRol.initial_suggestions  ÔåÆ  config.conversationSuggestions.defaultInitialSuggestions
```

- `initial_suggestions` por rol/subrol se lee de **MongoDB** (no de YAML ÔÇö ver `AVI_ROLES.md`).
- Cliente: `client/src/components/Chat/Input/InitialSuggestions.tsx` (query con `staleTime` 5 min, fallback al default del config).

### Follow-up suggestions

`POST /api/suggestions/follow-up` ÔåÆ `api/server/services/Suggestions/generateFollowUp.js`. Usa `fastModel` del config. Genera sugerencias contextuales tras cada respuesta del agente.

### C├│mo editar

| Tipo | D├│nde | Requiere |
|---|---|---|
| Default global | `librechat.yaml` ÔåÆ `conversationSuggestions.defaultInitialSuggestions` | Stop + redeploy Dokploy |
| Por rol/subrol | MongoDB (`avirols`/`avisubrols` ÔåÆ `initial_suggestions`, m├íx 4) | Edici├│n directa (no requiere reload) |
| `fastModel` | `librechat.yaml` | Stop + redeploy |

> `instructionSuggestion` es un campo legacy que **no tiene efecto** en el c├│digo actual (no est├í en el schema Zod). Ver `AVI_ROLES.md` para detalle.

---

## Invitaciones Masivas

### Script ÔÇö `enviar-invitaciones.sh` (en la ra├¡z del repo)

```sh
#!/bin/sh
for email in $(cat emails.txt); do
    echo "Enviando invitacion a: $email"
    npm run invite-user "$email"
done
echo "Listo! Todas las invitaciones enviadas."
```

- Itera `emails.txt` (un email por l├¡nea) y ejecuta `npm run invite-user <email>` (`api/package.json:15`).
- En el contenedor: vive en `/app/enviar-invitaciones.sh` (copiado por `Dockerfile.multi:76-77`, CRLF stripped + ejecutable).

### Proceso (en producci├│n/staging)

```bash
# 1. Acceder al contenedor
docker exec -it LibreChat-API /bin/sh

# 2. Ir a /app (el contenedor inicia en /app/api)
cd ..

# 3. Verificar archivos
ls
# Deber├¡as ver: emails.txt, enviar-invitaciones.sh

# 4. Limpiar y editar lista (un email por l├¡nea)
> emails.txt
vi emails.txt
#   i ÔåÆ modo edici├│n
#   Esc ÔåÆ salir edici├│n
#   :x ÔåÆ guardar y salir

# 5. Ejecutar
sh ./enviar-invitaciones.sh

# 6. Salir
exit
```

**Requisitos:**
- Contenedor `LibreChat-API` corriendo.
- Variables `EMAIL_*` (SMTP) configuradas en `.env`.
- Archivos con line endings LF (no CRLF).

> `emails.txt` viene con placeholders (`usuario1@email.com`, etc.). Sobreescribir antes de usar.

---

## Limpieza de Chats Antiguos

### Script ÔÇö `scripts/cleanup-chats.sh` + `config/cleanup-conversations.js`

**Uso:**
```bash
sh /app/scripts/cleanup-chats.sh --force --days 15
```

- `--force`: eliminaci├│n real. **Sin este flag es dry-run** (solo reporta).
- `--days N`: elimina chats con `updatedAt <= hoy - N d├¡as` (default 30).
- Elimina: messages (`:96`), tool calls (`:100`), conversations (`:104`).
- Usa `createModels(mongoose)` de `@librechat/data-schemas`.

> Normalmente no se ejecuta solo ÔÇö lo invoca el orquestador `backup-chats-gcs`.

---

## Variables de Entorno

### GCS / Sheets

| Var | Requerida | Default | Usada por |
|---|---|---|---|
| `GOOGLE_CREDENTIALS_JSON` | Ô£à | ÔÇö | Todos los scripts GCS/Sheets |
| `GOOGLE_SHEETS_ID` | ÔÇö | `1Johw_...` | upload-to-sheets (b├ísico), gcs-to-sheets-historial |
| `GCS_BUCKET_NAME` | ÔÇö | `avi-bkt` | verify-gcs, gcs-to-sheets-historial |
| `GCS_BUCKET_PATH` | ÔÇö | `chats/` | verify-gcs, gcs-to-sheets-historial |
| `GCS_HISTORIAL_FILE_PREFIX` | ÔÇö | `chats_extended_` | gcs-to-sheets-historial |

> `upload-to-gcs-extended.js` tiene el bucket **hardcoded** `avi-bkt` ÔÇö no lee `GCS_BUCKET_NAME`.

### Health Check

| Var | Requerida | Descripci├│n |
|---|---|---|
| `HEALTH_CHECK_URL` | Ô£à | URL base (ej: `https://avi.corporacionccm.cl`) |
| `HEALTH_CHECK_EMAIL` | Ô£à | Email de login de test |
| `HEALTH_CHECK_PASSWORD` | Ô£à | Password de login de test |
| `HEALTH_CHECK_AGENT_ID` | Ô£à | ID del agente a testear |
| `HEALTH_CHECK_ADMIN_EMAIL` | Ô£à | Admins (coma-separado) |

### SMTP (Email)

`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_ENCRYPTION`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_SERVICE`, `EMAIL_ALLOW_SELFSIGNED` (ver Health Check Audit para defaults).

### Mongo

`MONGO_URI` (default `mongodb://mongodb:27017/LibreChat` en scripts Docker).

---

## Cron Jobs en Dokploy

Los cron jobs se configuran **en la UI de Dokploy**, no en el repo. Referencia:

| Job | Cron | Comando | Retenci├│n |
|---|---|---|---|
| **Health Check** | `0 */6 * * *` (cada 6h) | `sh /app/scripts/health-check.sh` | ÔÇö |
| **Backup GCS** | (diario, definir) | `sh /app/scripts/backup-chats-gcs --force --days 15` | 15 d├¡as en MongoDB; GCS sin auto-limpieza |

> Antes de activar el cron de backup GCS, desactivar cualquier cron previo standalone de cleanup para evitar doble ejecuci├│n.

---

## ­ƒôÜ Documentaci├│n Relacionada

- `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md` - Deploy, entornos y desarrollo local
- `Docs_AVI/AVI_ROLES.md` - Sistema de roles, campos, variables y recarga din├ímica
- `Docs_AVI/README.md` - ├ìndice de documentaci├│n

---

**Validada contra c├│digo:** rama `dev`, Junio 2026
**Mantenida por:** Equipo de Desarrollo AVI
