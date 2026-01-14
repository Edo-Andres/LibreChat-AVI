#!/bin/bash
set -e

echo "🚀 Iniciando Health Check Audit LibreChat - $(date)"

# Detectar directorio de la API (Docker vs Local)
if [ -d "/app/api" ]; then
    # Entorno Docker
    cd /app/api
else
    # Entorno Local: ir a la carpeta api relativa al script
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
    cd "$SCRIPT_DIR/../api"
fi

# Ejecutar health check completo con notificaciones por email
echo "📧 Ejecutando Health Check con notificaciones..."
npm run health-check-audit

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "✅ Health Check completado exitosamente - $(date)"
    echo "📧 Notificación de éxito enviada por email"
else
    echo "❌ Health Check falló con código: $exit_code - $(date)"
    echo "📧 Notificación de error enviada por email"
fi

echo "🏁 Health Check Audit finalizado - $(date)"
exit $exit_code