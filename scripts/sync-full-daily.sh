#!/bin/sh
# scripts/sync-full-daily.sh - Historial acumulativo Full Daily (GCS base + Mongo -> Google Sheets)
# Solo agrega filas nuevas (clave conversationId+messageId) a la pestana FullDaily; PII enmascarada (***) por defecto.
# Uso: sh /app/scripts/sync-full-daily.sh [--no-mask]   (cron propio en Dokploy)
# --no-mask: PII en claro. Las filas ya existentes no cambian: vaciar la pestana antes para resembrar.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# Detecta modo contenedor vs local (mismo patron que sync-chats.sh)
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

USE_MASK=1
for arg in "$@"; do
  if [ "$arg" = "--no-mask" ]; then
    USE_MASK=0
  fi
done

# El CSV temporal contiene datos de chat: se elimina siempre, incluso si un paso falla.
TMP_CSV="$API_DIR/chats_full_daily.csv"
trap 'rm -f "$TMP_CSV"' EXIT

echo "Iniciando Full Daily (GCS base + Mongo -> Sheets FullDaily)..."
echo "API dir: $API_DIR | Modo: $RUN_MODE | Mascara PII: $([ $USE_MASK -eq 1 ] && echo 'ACTIVADA (***)' || echo 'desactivada')"

if [ "$RUN_MODE" = "container" ]; then
  if [ $USE_MASK -eq 1 ]; then
    echo "Paso 1/2: Exportando Mongo enmascarado..."
    npm --prefix "$API_DIR" run export-chats-full-daily
    echo "Paso 2/2: Agregando filas nuevas a Sheets..."
    npm --prefix "$API_DIR" run full-daily-to-sheets
  else
    echo "Paso 1/2: Exportando Mongo SIN mascara..."
    npm --prefix "$API_DIR" run export-chats-full-daily:raw
    echo "Paso 2/2: Agregando filas nuevas a Sheets (sin mascara)..."
    npm --prefix "$API_DIR" run full-daily-to-sheets -- --no-mask
  fi
else
  # En local, ejecutar desde raiz para que dotenv tome .env del proyecto.
  cd "$PROJECT_ROOT"
  if [ $USE_MASK -eq 1 ]; then
    echo "Paso 1/2: Exportando Mongo enmascarado..."
    node config/export-all-chats-extended.js csv api/chats_full_daily.csv --mask-pii
    echo "Paso 2/2: Agregando filas nuevas a Sheets..."
    node config/full-daily-to-sheets.js
  else
    echo "Paso 1/2: Exportando Mongo SIN mascara..."
    node config/export-all-chats-extended.js csv api/chats_full_daily.csv
    echo "Paso 2/2: Agregando filas nuevas a Sheets (sin mascara)..."
    node config/full-daily-to-sheets.js --no-mask
  fi
fi

echo "Full Daily completado!"
