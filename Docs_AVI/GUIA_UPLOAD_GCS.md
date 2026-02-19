# Guía de Upload a Google Cloud Storage (GCS)

## 📋 Descripción

Script para subir las exportaciones CSV extendidas de LibreChat a **Google Cloud Storage** (bucket `avi-bkt`).

---

## ⚙️ Configuración Inicial

### 1. Instalar Dependencias

Desde el directorio raíz del proyecto:

```bash
cd api
npm install
```

Esto instalará `@google-cloud/storage` (versión 7.16.0).

### 2. Configurar Permisos en GCS

Tu cuenta de servicio debe tener permisos en el bucket:

1. Ve a [Google Cloud Console - Storage](https://console.cloud.google.com/storage)
2. Selecciona el bucket `avi-bkt`
3. Ve a la pestaña **"Permissions"**
4. Click en **"+ Grant Access"**
5. Agrega el email de tu cuenta de servicio (mismo que usas para Google Sheets):
   - Email: `tu-cuenta@proyecto.iam.gserviceaccount.com`
   - Role: **Storage Object Admin** o **Storage Object Creator**
6. Guarda los cambios

### 3. Variables de Entorno

El script usa la misma variable que Google Sheets (ya configurada):

```bash
GOOGLE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...",...}'
```

No requiere configuración adicional.

---

## 🚀 Uso

### Opción 1: Desde NPM (local)

Exportar y subir a GCS:
```bash
cd api
npm run sync-chats-gcs-extended
```

Solo subir (requiere CSV previo):
```bash
npm run upload-to-gcs-extended
```

### Opción 2: Desde Node Directo

```bash
node config/upload-to-gcs-extended.js
```

### Opción 3: Desde Docker

```bash
docker exec -it librechat-avi-api-1 bash -c "cd /app/api && npm run sync-chats-gcs-extended"
```

O usando el script shell:
```bash
docker exec -it librechat-avi-api-1 /app/scripts/sync-chats-gcs-extended.sh
```

---

## 📁 Estructura de Archivos en GCS

Los archivos se suben con timestamp automático:

```
gs://avi-bkt/
└── chats/
    ├── chats_extended_2026-02-19_143022.csv
    ├── chats_extended_2026-02-19_150045.csv
    └── chats_extended_2026-02-20_090130.csv
```

**Formato del nombre:** `chats_extended_YYYY-MM-DD_HHMMSS.csv`

---

## 🔍 Verificación

### Ver archivos en GCS (CLI)

```bash
gsutil ls gs://avi-bkt/chats/
```

### Descargar un archivo

```bash
gsutil cp gs://avi-bkt/chats/chats_extended_2026-02-19_143022.csv ./
```

### Ver metadata

```bash
gsutil stat gs://avi-bkt/chats/chats_extended_2026-02-19_143022.csv
```

---

## 📊 Flujo Completo

```bash
┌─────────────────────────────────────────────┐
│  npm run sync-chats-gcs-extended            │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│   Exportar   │        │   Subir a    │
│     CSV      │───────▶│     GCS      │
│  (MongoDB)   │        │  (avi-bkt)   │
└──────────────┘        └──────────────┘
   chats_extended.csv   gs://avi-bkt/chats/
                        chats_extended_*.csv
```

---

## 🛡️ Comportamiento

- ✅ **Archivo local:** Se **elimina** después de subir exitosamente
- ✅ **Timestamp:** Cada archivo tiene timestamp único (no sobrescribe)
- ✅ **Error handling:** Si falla el upload, el archivo local se preserva
- ✅ **Metadata:** Incluye información de upload (fecha, source, tipo)

---

## 🆚 Comparación: GCS vs Google Sheets

| Característica | Google Sheets | GCS |
|---|---|---|
| Visualización | ✅ Inmediata en navegador | ❌ Requiere descarga |
| Historial | ❌ Sobrescribe | ✅ Mantiene versiones |
| Tamaño límite | ~10 millones de celdas | ✅ Sin límites prácticos |
| Procesamiento | ✅ Filtros y fórmulas | ❌ Solo almacenamiento |
| Automatización | ❌ Limitada | ✅ BigQuery, Cloud Functions |
| Backup | ⚠️ Manual | ✅ Automático |

---

## 📝 Scripts Creados

| Archivo | Ubicación | Propósito |
|---|---|---|
| `upload-to-gcs-extended.js` | `config/` | Sube CSV a GCS con timestamp |
| `sync-chats-gcs-extended.sh` | `scripts/` | Script shell para Docker |

---

## 🔧 Troubleshooting

### Error: "The caller does not have permission"

**Causa:** Cuenta de servicio sin permisos en el bucket.

**Solución:** 
1. Verifica que agregaste el email correcto en GCS Permissions
2. Asegura que tiene rol `Storage Object Admin` o `Storage Object Creator`

### Error: "Bucket avi-bkt not found"

**Causa:** El bucket no existe o el nombre está incorrecto.

**Solución:**
1. Verifica que el bucket existe: `gsutil ls`
2. Confirma el nombre exacto del bucket en GCS Console

### Error: "GOOGLE_CREDENTIALS_JSON not found"

**Causa:** Variable de entorno no cargada.

**Solución:**
1. Verifica que tu `.env` tiene `GOOGLE_CREDENTIALS_JSON`
2. Ejecuta desde el directorio raíz del proyecto

---

## 📧 Soporte

Para problemas o preguntas:
- Revisa logs del script
- Verifica permisos en GCS Console
- Confirma que la cuenta de servicio es la correcta

---

**Última actualización:** Febrero 2026
**Responsable:** Equipo AVI
