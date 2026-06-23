#!/bin/sh
# scripts/sync-chats-extended.sh
# Sincroniza chats EXTENDIDOS a Google Sheets

echo "🚀 Iniciando sincronización EXTENDIDA de chats a Google Sheets..."

cd /app/api

# Ejecutar el flujo completo con versión extendida
npm run sync-chats-extended

echo "✅ Sincronización extendida completada!"
