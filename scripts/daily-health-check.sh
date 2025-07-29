#!/bin/bash
set -e

echo "🩺 ===== INICIANDO HEALTH CHECK DIARIO ====="
echo "📅 Fecha: $(date)"
echo "🌐 URL: ${HEALTH_CHECK_URL:-https://avi.corporacionccm.cl}"
echo "🤖 Agente: ${HEALTH_CHECK_AGENT_ID:-agent_nC338LEca541Mt80BSC0i}"
echo "📧 Admin: ${HEALTH_CHECK_ADMIN_EMAIL:-asistente@corporacionccm.cl}"
echo ""

# Cambiar al directorio de la API
cd /app/api

echo "📂 Directorio actual: $(pwd)"
echo "🔄 Ejecutando health check..."
echo ""

# Ejecutar health check
npm run daily-health-check

echo ""
echo "✅ ===== HEALTH CHECK COMPLETADO ====="
echo "🕐 Finalizado: $(date)" 