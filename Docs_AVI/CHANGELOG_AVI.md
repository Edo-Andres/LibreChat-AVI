# 🗓️ Changelog AVI - Historial de Cambios del Fork

**Proyecto:** LibreChat-AVI - Asistente Virtual en Infancia
**Última actualización:** 21 de agosto de 2026

Este documento registra en español los cambios y features propios del fork AVI (roles, búsqueda, region, sincronizaciones, etc.). **No reemplaza** al `CHANGELOG.md` de la raíz del repo, que es el changelog oficial del upstream de LibreChat (en inglés, generado desde PRs de `danny-avila/LibreChat`).

> Las entradas anteriores al 21 de agosto de 2026 son un **backfill** reconstruido desde `git log`, no un registro hecho en el momento. A partir de esa fecha, cada dev debe agregar su entrada siguiendo la convención al final de este documento.

---

## 📋 Tabla de Contenidos

- [2026-08-20](#2026-08-20)
- [2026-08-18](#2026-08-18)
- [2026-08-17](#2026-08-17)
- [2026-08-15](#2026-08-15)
- [Cómo agregar una entrada](#cómo-agregar-una-entrada)

---

## 2026-08-20

### 🔍 Búsqueda
- Mejora del truncado de mensajes y del manejo de contexto en la tool de búsqueda de conversaciones.
  Commit: `ec065cfe1` · Archivo: `api/server/services/ConversationSearch/searchUserMessages.js`

---

## 2026-08-18

### ✨ Nuevas Features
- **Nueva tool "Búsqueda en conversaciones" (`conversation_search`)**: permite al agente buscar en el historial de chats propios del usuario, integrada con Meilisearch.
  Commit: `323c9f1ee`
  Archivos clave:
  - `api/app/clients/tools/structured/ConversationSearch.js` (nueva clase de la tool)
  - `api/app/clients/tools/manifest.json` (registro en el manifest)
  - `api/app/clients/tools/util/handleTools.js` (wiring en el pipeline de tools)
  - `api/db/indexSync.js` (sincronización de índices)
  - `packages/data-provider/src/config.ts` (config `conversationSearch` en `librechat.yaml`)

---

## 2026-08-17

### 📝 Docs
- Documentación del agente/script para limpiar el conteo de versiones del system prompt AVI.
  Commit: `86bce1fa4` · Archivo: `Docs_AVI/_archive/Clear_versionsCount_agent/README.md`

---

## 2026-08-15

### ✨ Nuevas Features
- **Tracking de región/país** en el registro de usuario (`region_v1`).
  Commit: `84117fb84`
  Archivos clave: `api/server/services/AuthService.js`, `api/strategies/validators.js`, `client/src/components/Auth/Registration.tsx`
- **Sincronización diaria de exportación de chats a Google Sheets**.
  Commit: `635d5c090`
  Archivos clave: `config/export-all-chats.js`, `config/upload-to-sheets.js` · Documentado en [`OPERACIONES.md`](./OPERACIONES.md)

---

## Cómo agregar una entrada

Cuando termines una feature o fix relevante para el equipo AVI:

1. Ubica (o crea) la sección `## YYYY-MM-DD` de hoy, al principio del documento (orden cronológico descendente).
2. Agrega una línea bajo la categoría que corresponda (crea la categoría si no existe ese día):
   - `### ✨ Nuevas Features`
   - `### 🔧 Fixes`
   - `### 📝 Docs`
   - `### ⚙️ Otros cambios`
3. Formato de la línea:
   ```
   - Descripción corta en español de qué cambió y por qué.
     Commit: `<hash corto>` · Archivo(s): `ruta/al/archivo.js`
   ```
4. Si agregaste una entrada nueva de fecha, súmala también a la Tabla de Contenidos.
5. Actualiza la línea **Última actualización** al inicio del documento.
