#!/bin/sh
# scripts/sync-chats.sh - Daily a Google Sheets (20 cols como Historial, PII enmascarada ***)
# Uso: sh /app/scripts/sync-chats.sh [--mask-pii] [--no-mask]
# Por defecto Daily siempre enmascara (seguro). --no-mask solo para debug.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# Detecta modo contenedor vs local (sigue patron sync-chats-gcs-extended.sh)
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

# Por defecto Daily enmascarado (opcion A). Flag --no-mask desactiva solo para debug.
USE_MASK=1
for arg in "$@"; do
  if [ "$arg" = "--no-mask" ]; then
    USE_MASK=0
  fi
done

echo "Iniciando sincronizacion Daily de chats a Google Sheets..."
echo "API dir: $API_DIR | Modo: $RUN_MODE | Mascara PII: $([ $USE_MASK -eq 1 ] && echo 'ACTIVADA (***)' || echo 'desactivada')"

if [ "$RUN_MODE" = "container" ]; then
  if [ $USE_MASK -eq 1 ]; then
    npm --prefix "$API_DIR" run sync-chats-to-sheets
  else
    npm --prefix "$API_DIR" run sync-chats-to-sheets:raw
  fi
else
  cd "$PROJECT_ROOT"
  if [ $USE_MASK -eq 1 ]; then
    echo "Paso 1/2: Exportando Daily enmascarado (20 cols, *** en userEmail/userName/userPhone)..."
    node config/export-all-chats-extended.js csv api/chats.csv --mask-pii
  else
    echo "Paso 1/2: Exportando Daily SIN mascara (debug)..."
    node config/export-all-chats-extended.js csv api/chats.csv
  fi
  echo "Paso 2/2: Subiendo a Sheets Daily..."
  node config/upload-to-sheets.js
fi

echo "Sincronizacion Daily completada!"