#!/bin/sh
# Script para sincronizar chats extendidos a Google Cloud Storage (GCS)
# Uso: ./sync-chats-gcs-extended.sh

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

cd "$API_DIR"

echo "Sincronizando chats extendidos a Google Cloud Storage..."
echo "=============================================="
echo "API dir: $API_DIR"
echo "Modo: $RUN_MODE"

if [ "$RUN_MODE" = "container" ]; then
  # En contenedor se conserva el flujo npm original.
  echo "Paso 1/2: Exportando chats extendidos..."
  npm run export-chats-extended

  echo "Paso 2/2: Subiendo a GCS..."
  npm run upload-to-gcs-extended
else
  # En local, ejecutar desde raiz para que dotenv tome .env del proyecto.
  cd "$PROJECT_ROOT"

  echo "Paso 1/2: Exportando chats extendidos..."
  node config/export-all-chats-extended.js csv api/chats_extended.csv

  echo "Paso 2/2: Subiendo a GCS..."
  node config/upload-to-gcs-extended.js
fi

echo "Sincronizacion completada"
