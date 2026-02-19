#!/bin/bash
# Script para sincronizar chats extendidos a Google Cloud Storage (GCS)
# Uso: ./sync-chats-gcs-extended.sh

set -e

cd /app/api

echo "🚀 Sincronizando chats extendidos a Google Cloud Storage..."
echo "=============================================="

# 1. Exportar chats extendidos
echo "📊 Paso 1/2: Exportando chats extendidos..."
npm run export-chats-extended

# 2. Subir a Google Cloud Storage
echo "☁️ Paso 2/2: Subiendo a GCS (avi-bkt/chats/)..."
npm run upload-to-gcs-extended

echo "✅ Sincronización completada!"
