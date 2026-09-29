#!/bin/sh
# scripts/sync-usuarios.sh - Snapshot de usuarios (Mongo -> pestana "usuarios" de Google Sheets)
# Reescribe la pestana completa en cada corrida; PII (email, nombre, telefono) en claro.
# Uso: sh /app/scripts/sync-usuarios.sh   (cron propio en Dokploy)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# Detecta modo contenedor vs local (mismo patron que sync-full-daily.sh)
if [ -d "/app/api" ]; then
  RUN_MODE="container"
  API_DIR="/app/api"
else
  RUN_MODE="local"
  API_DIR="$(cd "$SCRIPT_DIR/../api" >/dev/null 2>&1 && pwd)"
fi

if [ ! -d "$API_DIR" ]; then
  echo "No se encontro el directorio API en /app/api ni en ../api"
  exit 1
fi

echo "Sincronizando usuarios a Google Sheets..."
echo "API dir: $API_DIR | Modo: $RUN_MODE"

if [ "$RUN_MODE" = "container" ]; then
  npm --prefix "$API_DIR" run usuarios-to-sheets
else
  # En local, ejecutar desde raiz para que dotenv tome .env del proyecto.
  cd "$PROJECT_ROOT"
  node config/usuarios-to-sheets.js
fi

echo "Sincronizacion de usuarios completada!"
