#!/bin/sh
# Script independiente para cargar Historial desde CSV en GCS a Google Sheets
# Uso: ./gcs-to-sheets-historial.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# Prioriza ruta de contenedor; si no existe, usa ruta local del repo.
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

echo "Sincronizando Historial desde GCS a Google Sheets..."
echo "=============================================="
echo "API dir: $API_DIR"
echo "Modo: $RUN_MODE"

if [ "$RUN_MODE" = "container" ]; then
  cd "$API_DIR"
  npm run gcs-to-sheets-historial
else
  # En local, ejecutar desde raiz para que dotenv tome .env del proyecto.
  cd "$PROJECT_ROOT"
  node config/gcs-to-sheets-historial.js
fi

echo "Sincronizacion Historial completada"
