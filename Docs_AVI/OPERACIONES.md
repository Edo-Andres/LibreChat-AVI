# 🔧 Operaciones y Mantenimiento - LibreChat-AVI

**Validado contra código:** Junio 2026 (rama `dev`)
**Proyecto:** LibreChat-AVI - Asistente Virtual en Infancia

---

## 📋 Tabla de Contenidos

1. [Resumen de Scripts](#resumen-de-scripts)
2. [Backup Programado a GCS](#backup-programado-a-gcs)
3. [Sincronización a Google Sheets](#sincronización-a-google-sheets)
4. [Health Check Audit](#health-check-audit)
5. [Conversation Suggestions](#conversation-suggestions)
6. [Invitaciones Masivas](#invitaciones-masivas)
7. [Limpieza de Chats Antiguos](#limpieza-de-chats-antiguos)
8. [Variables de Entorno](#variables-de-entorno)
9. [Cron Jobs en Dokploy](#cron-jobs-en-dokploy)

---

## Resumen de Scripts

Los scripts operativos viven en `scripts/` (wrappers shell) y `config/` (lógica Node). En producción, `Dockerfile.multi` los copia al contenedor y se ejecutan vía cron jobs de Dokploy.

| Script | Propósito | Trigger |
|---|---|---|
| `scripts/backup-chats-gcs` | Orquestador unificado: cleanup → GCS → verify/email | Cron Dokploy (diario) |
| `scripts/health-check.sh` | Audit de endpoints + email de alerta | Cron Dokploy (`0 */6 * * *`) |
| `scripts/sync-chats.sh` | Export básico → Google Sheets | Manual |
| `scripts/sync-chats-extended.sh` | Export extendido → Google Sheets | Manual |
| `scripts/sync-chats-gcs-extended.sh` | Export extendido → GCS | Vía orquestador |
| `scripts/gcs-to-sheets-historial.sh` | Consolida CSVs de GCS → Sheets | Manual |
| `scripts/cleanup-chats.sh` | Elimina chats antiguos | Vía orquestador |
| `enviar-invitaciones.sh` | Invitaciones masivas por email | Manual |

Wiring npm: `api/package.json:19-32` define los scripts que los wrappers invocan.

---

## Backup Programado a GCS

### Orquestador unificado — `scripts/backup-chats-gcs`

**Archivo:** `scripts/backup-chats-gcs` (82 líneas, archivo único — no es directorio).

Flujo de 3 pasos:

1. **Cleanup** (`:30`): `sh "$SCRIPT_DIR/cleanup-chats.sh" "$@"` — elimina conversaciones con `updatedAt` anterior al cutoff.
2. **Sync GCS** (`:41`): `sh "$SCRIPT_DIR/sync-chats-gcs-extended.sh"` — exporta CSV extendido y sube a GCS.
3. **Verify + Email** (`:68`/`:71`): `node "$PROJECT_ROOT/config/verify-gcs-chats-extended.js"` — verifica que el archivo exista en GCS y envía email de éxito o error.

**Uso:**
```bash
sh /app/scripts/backup-chats-gcs --force --days 15
# Sin args: defaults a --force --days 15
```

- `--force`: eliminación real (sin esto, cleanup es dry-run).
- `--days N`: retención de chats en MongoDB (default 30; el cron usa 15).

> Si cualquier paso falla, los siguientes se marcan como error y `verify-gcs-chats-extended.js` envía un email de error con el detalle.

### Subida a GCS — `config/upload-to-gcs-extended.js`

- **Bucket:** `avi-bkt` (**hardcoded** `:7`, no se lee de env var).
- **Carpeta:** `chats/` (`:8`).
- **Filename:** `chats_extended_YYYY-MM-DD_HHMMSS.csv` (hora local `:37-40`).
- **Env var requerida:** `GOOGLE_CREDENTIALS_JSON` (JSON string de la service account).
- Lee `api/chats_extended.csv` y lo sube con `contentType: text/csv`.

> **GCS no auto-elimina objetos.** La retención de 15 días aplica solo a conversaciones en MongoDB. Los archivos en GCS se acumulan sin limpieza automática.

### Verificación — `config/verify-gcs-chats-extended.js`

- Verifica que exista un archivo con `_YYYY-MM-DD_` (fecha UTC `:62`) en el bucket.
- Bucket: `GCS_BUCKET_NAME` (default `avi-bkt`, `:57`), path `GCS_BUCKET_PATH` (default `chats/`, `:58`).
- Envía email vía `EmailNotifier` con `notificationType: 'gcs-backup-verify'` (`:160`).
- **Asuntos:** éxito → `✅ Respaldo programado OK: limpieza + exportacion a GCS`; error → `❌ Respaldo programado fallido: cleanup/sync GCS`.
- **Destinatarios:** éxito → primer admin; error → primeros 2 admins (`slice(0,2)` `:24-27`).
- **Exit codes:** 0 encontrado, 2 no encontrado, 1 error.

### Historial consolidado — `config/gcs-to-sheets-historial.js`

- Descarga **todos** los CSVs de `gs://avi-bkt/chats/`, los mergea, deduplica por `conversationId::messageId` (`:157-183`), ordena por `messageCreatedAtEpoch` desc (`:225-237`).
- Sube a Google Sheets, tab `Historial` (`:9`).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON`, `GOOGLE_SHEETS_ID` (default `1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U`), `GCS_BUCKET_NAME` (default `avi-bkt`), `GCS_BUCKET_PATH` (default `chats/`), `GCS_HISTORIAL_FILE_PREFIX` (default `chats_extended_`).
- Wrapper: `scripts/gcs-to-sheets-historial.sh` (dual container/local).

---

## Sincronización a Google Sheets

### Sync básico — `scripts/sync-chats.sh`

- Exporta `api/chats.csv` (básico) y sube a Sheets.
- **Spreadsheet:** `1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U`, tab `Hoja 1` (`config/upload-to-sheets.js:8-9`).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON` (req), `GOOGLE_SHEETS_ID` (opt, override del default).
- Borra el CSV local tras subir (`:106-115`).

### Sync extendido — `scripts/sync-chats-extended.sh`

- Exporta `api/chats_extended.csv` (con datos de usuario, AVI roles, mensajes, feedback) y sube a Sheets.
- **Spreadsheet:** mismo ID, tab `Hoja 1` (**hardcoded** en `config/upload-to-sheets-extended.js:8-9`, **NO** lee `GOOGLE_SHEETS_ID`).
- **Env vars:** `GOOGLE_CREDENTIALS_JSON` (req).

### Columnas del CSV extendido

`config/export-all-chats-extended.js:206-226`:

```
userId, userEmail, userName, userPhone, userParticipationConsent,
userAviRole, userAviSubrole, userCreatedAt,
conversationId, conversationTitle, conversationCreatedAt, conversationUpdatedAt,
sender, text, isCreatedByUser, messageId, messageCreatedAt,
messageCreatedAtEpoch, feedback
```

- `userAviRole` / `userAviSubrole` se populan desde `aviRol_id`/`aviSubrol_id` (`:105-108`).
- Fechas en zona `America/Santiago` (env `TZ`, `:57`).
- CLI: `node config/export-all-chats-extended.js [csv|json] [outputFile]` (default `csv` → `chats_extended.csv`).

> **Diferencia entre los dos uploaders:** el básico respeta `GOOGLE_SHEETS_ID` como override; el extendido lo tiene hardcoded. Si necesitas cambiar el spreadsheet del extendido, hay que editar `config/upload-to-sheets-extended.js:8`.

---

## Health Check Audit

### Script — `scripts/health-check.sh`

Dual-mode: detecta `/app/api` (Docker) o usa `../api` (local). Ejecuta `npm run health-check-audit` → `config/health-check/health-check-with-email.js`.

### Qué audita — `config/health-check/health-check-with-email.js` (412 líneas)

1. `GET /api/config` y `/api/banner` (config y banner cargan).
2. `POST /api/auth/login` con `HEALTH_CHECK_EMAIL` / `HEALTH_CHECK_PASSWORD` (login OK).
3. `GET /api/user` y `/api/agents` (datos esenciales cargan).
4. `POST /api/agents/chat` con payload de test `"mensaje test diario, responde test ok"` (`:187-200`).
5. Valida la respuesta contra ~20 patrones de error (`:278-299`).

### Alertas por email

- **Éxito** → email al **primer** admin únicamente (`:244`).
- **Error** → email a **todos** los admins (`:264`).
- Asunto éxito: reporta endpoints verificados.
- Asunto error: incluye detalles del fallo.

### Configuración — `config/health-check/load-config.js`

Env vars requeridas: `HEALTH_CHECK_URL`, `HEALTH_CHECK_EMAIL`, `HEALTH_CHECK_PASSWORD`, `HEALTH_CHECK_AGENT_ID`.
Env var de destinatarios: `HEALTH_CHECK_ADMIN_EMAIL` (coma-separado, `:8-28`).
- `adminEmailSuccess` = primer email (`:24`).
- `adminEmailError` = todos joinados (`:25`).

### SMTP — `config/services/email-notifier.js` (349 líneas)

| Env var | Default | Descripción |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | Host SMTP |
| `EMAIL_PORT` | `587` | Puerto |
| `EMAIL_ENCRYPTION` | — | `ssl` → `secure: true` |
| `EMAIL_USERNAME` | — | Usuario |
| `EMAIL_PASSWORD` | — | Password |
| `EMAIL_FROM` | — | Remitente |
| `EMAIL_FROM_NAME` | — | Nombre remitente |
| `EMAIL_SERVICE` | — | `gmail` → handling especial |
| `EMAIL_ALLOW_SELFSIGNED` | — | `true` → certs self-signed |

Soporta 2 notification types: `health-check` (default) y `gcs-backup-verify` (`:62-64`, `:149-151`).

---

## Conversation Suggestions

### Configuración en `librechat.yaml`

```yaml
conversationSuggestions:
  enabled: true
  defaultInitialSuggestions:
    - "¿Cómo puedo construir confianza con un niño/a que me rechaza o me ignora?"
    - "¿Cómo puedo cuidarme yo para poder seguir cuidando bien?"
    - "¿Cómo debo reaccionar cuando el niño/a tiene una crisis o pierde el control?"
    - "¿Qué es el trauma complejo y cómo afecta a los niños/as?"
  fastModel: "gemini-2.5-flash-lite"
```

- `defaultInitialSuggestions`: máx 4 entradas (Zod `max(4)`, `config.ts:836-838`).
- `fastModel`: modelo para generar follow-ups (default `gemini-1.5-flash`, `generateFollowUp.js:84`).

### Carga de sugerencias iniciales

Ruta: `GET /api/suggestions/initial` → `api/server/routes/suggestions.js:15-47`.

**Prioridad:**
```
aviSubrol.initial_suggestions  →  aviRol.initial_suggestions  →  config.conversationSuggestions.defaultInitialSuggestions
```

- `initial_suggestions` por rol/subrol se lee de **MongoDB** (no de YAML — ver `AVI_ROLES.md`).
- Cliente: `client/src/components/Chat/Input/InitialSuggestions.tsx` (query con `staleTime` 5 min, fallback al default del config).

### Follow-up suggestions

`POST /api/suggestions/follow-up` → `api/server/services/Suggestions/generateFollowUp.js`. Usa `fastModel` del config. Genera sugerencias contextuales tras cada respuesta del agente.

### Cómo editar

| Tipo | Dónde | Requiere |
|---|---|---|
| Default global | `librechat.yaml` → `conversationSuggestions.defaultInitialSuggestions` | Stop + redeploy Dokploy |
| Por rol/subrol | MongoDB (`avirols`/`avisubrols` → `initial_suggestions`, máx 4) | Edición directa (no requiere reload) |
| `fastModel` | `librechat.yaml` | Stop + redeploy |

> `instructionSuggestion` es un campo legacy que **no tiene efecto** en el código actual (no está en el schema Zod). Ver `AVI_ROLES.md` para detalle.

---

## Invitaciones Masivas

### Script — `enviar-invitaciones.sh` (en la raíz del repo)

```sh
#!/bin/sh
for email in $(cat emails.txt); do
    echo "Enviando invitacion a: $email"
    npm run invite-user "$email"
done
echo "Listo! Todas las invitaciones enviadas."
```

- Itera `emails.txt` (un email por línea) y ejecuta `npm run invite-user <email>` (`api/package.json:15`).
- En el contenedor: vive en `/app/enviar-invitaciones.sh` (copiado por `Dockerfile.multi:76-77`, CRLF stripped + ejecutable).

### Proceso (en producción/staging)

```bash
# 1. Acceder al contenedor
docker exec -it LibreChat-API /bin/sh

# 2. Ir a /app (el contenedor inicia en /app/api)
cd ..

# 3. Verificar archivos
ls
# Deberías ver: emails.txt, enviar-invitaciones.sh

# 4. Limpiar y editar lista (un email por línea)
> emails.txt
vi emails.txt
#   i → modo edición
#   Esc → salir edición
#   :x → guardar y salir

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

### Script — `scripts/cleanup-chats.sh` + `config/cleanup-conversations.js`

**Uso:**
```bash
sh /app/scripts/cleanup-chats.sh --force --days 15
```

- `--force`: eliminación real. **Sin este flag es dry-run** (solo reporta).
- `--days N`: elimina chats con `updatedAt <= hoy - N días` (default 30).
- Elimina: messages (`:96`), tool calls (`:100`), conversations (`:104`).
- Usa `createModels(mongoose)` de `@librechat/data-schemas`.

> Normalmente no se ejecuta solo — lo invoca el orquestador `backup-chats-gcs`.

---

## Variables de Entorno

### GCS / Sheets

| Var | Requerida | Default | Usada por |
|---|---|---|---|
| `GOOGLE_CREDENTIALS_JSON` | ✅ | — | Todos los scripts GCS/Sheets |
| `GOOGLE_SHEETS_ID` | — | `1Johw_...` | upload-to-sheets (básico), gcs-to-sheets-historial |
| `GCS_BUCKET_NAME` | — | `avi-bkt` | verify-gcs, gcs-to-sheets-historial |
| `GCS_BUCKET_PATH` | — | `chats/` | verify-gcs, gcs-to-sheets-historial |
| `GCS_HISTORIAL_FILE_PREFIX` | — | `chats_extended_` | gcs-to-sheets-historial |

> `upload-to-gcs-extended.js` tiene el bucket **hardcoded** `avi-bkt` — no lee `GCS_BUCKET_NAME`.

### Health Check

| Var | Requerida | Descripción |
|---|---|---|
| `HEALTH_CHECK_URL` | ✅ | URL base (ej: `https://avi.corporacionccm.cl`) |
| `HEALTH_CHECK_EMAIL` | ✅ | Email de login de test |
| `HEALTH_CHECK_PASSWORD` | ✅ | Password de login de test |
| `HEALTH_CHECK_AGENT_ID` | ✅ | ID del agente a testear |
| `HEALTH_CHECK_ADMIN_EMAIL` | ✅ | Admins (coma-separado) |

### SMTP (Email)

`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_ENCRYPTION`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_SERVICE`, `EMAIL_ALLOW_SELFSIGNED` (ver Health Check Audit para defaults).

### Mongo

`MONGO_URI` (default `mongodb://mongodb:27017/LibreChat` en scripts Docker).

---

## Cron Jobs en Dokploy

Los cron jobs se configuran **en la UI de Dokploy**, no en el repo. Referencia:

| Job | Cron | Comando | Retención |
|---|---|---|---|
| **Health Check** | `0 */6 * * *` (cada 6h) | `sh /app/scripts/health-check.sh` | — |
| **Backup GCS** | (diario, definir) | `sh /app/scripts/backup-chats-gcs --force --days 15` | 15 días en MongoDB; GCS sin auto-limpieza |

> Antes de activar el cron de backup GCS, desactivar cualquier cron previo standalone de cleanup para evitar doble ejecución.

---

## 📚 Documentación Relacionada

- `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md` - Deploy, entornos y desarrollo local
- `Docs_AVI/AVI_ROLES.md` - Sistema de roles, campos, variables y recarga dinámica
- `Docs_AVI/README.md` - Índice de documentación

---

**Validada contra código:** rama `dev`, Junio 2026
**Mantenida por:** Equipo de Desarrollo AVI
