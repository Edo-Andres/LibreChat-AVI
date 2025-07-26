#!/bin/sh

echo "🚀 Probando PostHog con LibreChat-AVI..."

# Verificar que las variables de PostHog estén en .env
echo "📋 Verificando configuración en .env..."
if grep -q "POSTHOG_API_KEY" .env; then
    echo "✅ POSTHOG_API_KEY encontrada en .env"
else
    echo "❌ POSTHOG_API_KEY no encontrada en .env"
    echo "💡 Agrega estas líneas a tu .env:"
    echo "POSTHOG_API_KEY=tu_project_api_key_aqui"
    echo "POSTHOG_HOST=https://us.i.posthog.com"
    exit 1
fi

if grep -q "POSTHOG_HOST" .env; then
    echo "✅ POSTHOG_HOST encontrada en .env"
else
    echo "⚠️ POSTHOG_HOST no encontrada, usando default"
fi

echo ""
echo "🔨 Construyendo y ejecutando LibreChat..."

# Detener contenedores existentes
echo "📦 Deteniendo contenedores existentes..."
docker-compose -f deploy-compose-local.yml down

# Build y start
echo "🚀 Iniciando servicios..."
docker-compose -f deploy-compose-local.yml up -d

echo ""
echo "⏳ Esperando que los servicios estén listos..."
sleep 10

# Verificar que los contenedores estén corriendo
echo "📊 Estado de contenedores:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ ¡Listo! LibreChat está disponible en:"
echo "   🌐 http://localhost:3080"
echo ""
echo "🧪 Para probar PostHog:"
echo "   1. Abre http://localhost:3080 en tu navegador"
echo "   2. Abre DevTools (F12) → Console"
echo "   3. Busca mensajes de PostHog:"
echo "      - '🔧 Initializing PostHog with config from API...'"
echo "      - '✅ PostHog initialized successfully from API config'"
echo "   4. Navega por la aplicación (login, enviar mensajes, etc.)"
echo "   5. Ve a tu dashboard de PostHog para ver los eventos"
echo ""
echo "🔍 Para debug, ver logs:"
echo "   docker logs LibreChat-API-local -f" 