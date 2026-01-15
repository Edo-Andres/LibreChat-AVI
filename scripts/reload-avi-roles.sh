#!/bin/sh
# Script para recargar configuración de AVI Roles dinámicamente
# Se ejecuta dentro del contenedor LibreChat-API
# Uso: ./scripts/reload-avi-roles.sh [--interactive]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INTERACTIVE=false
if [ "$1" = "--interactive" ] || [ "$1" = "-i" ]; then
  INTERACTIVE=true
fi

echo "🔄 Recargando configuración AVI Roles - $(date '+%Y-%m-%d %H:%M:%S')"

# Verificar que Node.js está disponible
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: node no está disponible"
  exit 1
fi

# Verificar que el archivo de configuración existe
if [ ! -f "$APP_ROOT/config/avi-roles-config.js" ]; then
  echo "❌ Error: No se encuentra config/avi-roles-config.js"
  exit 1
fi

# Crear script temporal de Node.js para ejecutar la migración
TEMP_SCRIPT="$APP_ROOT/config/.temp-migrate-avi-roles.js"

cat > "$TEMP_SCRIPT" << 'EOF'
/**
 * Script temporal para ejecutar migración de AVI Roles
 * Generado automáticamente por reload-avi-roles.sh
 */

const path = require('path');

// Configurar variables de entorno PRIMERO
const dotenvPath = path.resolve(__dirname, '..', '.env');
try {
  require('dotenv').config({ path: dotenvPath });
} catch (e) {
  // dotenv no es requerido si las variables ya están en el entorno
}

// Configurar module-alias ANTES de cualquier otro require que use ~
const apiRoot = path.resolve(__dirname, '..', 'api');
require('module-alias')({ base: apiRoot });

// AHORA sí cargar mongoose y otros módulos
const mongoose = require('mongoose');

// Obtener URI de MongoDB desde variables de entorno
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/LibreChat';

async function run() {
  const interactive = process.argv.includes('--interactive');
  
  try {
    console.log('✅ Conectando a MongoDB:', MONGO_URI.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(MONGO_URI);
    
    console.log('✅ Conectado a MongoDB\n');

    // Cargar modelos (ahora ~ está configurado)
    require('../api/models');
    
    // Cargar el módulo de migración
    const { migrateAviRoles } = require('./avi-roles-config');
    
    // Ejecutar migración
    const result = await migrateAviRoles(interactive);
    
    if (result.success) {
      console.log('\n✅ Configuración actualizada exitosamente');
      process.exit(0);
    } else {
      console.log('\n❌ Migración no completada:', result.reason);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    console.error(error.stack);
    process.exit(1);
    
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
  }
}

run();
EOF

# Ejecutar el script de Node.js
cd "$APP_ROOT"

if [ "$INTERACTIVE" = true ]; then
  node "$TEMP_SCRIPT" --interactive
else
  node "$TEMP_SCRIPT"
fi

EXIT_CODE=$?

# Limpiar script temporal
rm -f "$TEMP_SCRIPT"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Recarga de configuración completada - $(date '+%Y-%m-%d %H:%M:%S')"
else
  echo "❌ Recarga de configuración falló - $(date '+%Y-%m-%d %H:%M:%S')"
fi

exit $EXIT_CODE
