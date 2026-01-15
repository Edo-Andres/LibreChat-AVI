#!/bin/bash

# Script de limpieza de conversaciones antiguas de LibreChat
# Uso: ./cleanup-chats.sh [--force] [--days N]
# --force: Realiza el borrado real. Sin flag, solo simula.
# --days N: Define la antigüedad en días (por defecto 30).

echo "🚀 Iniciando script de limpieza de chats..."

# --- SOLUCIÓN ROBUSTA PARA DIRECTORIOS ---
# Obtener la ruta real de donde está este script .sh
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Moverse a la raíz del proyecto (un nivel arriba de scripts/)
cd "$SCRIPT_DIR/.."
# ------------------------------------------

JS_PATH="config/cleanup-conversations.js"

# Verificar si existe el archivo
if [ ! -f "$JS_PATH" ]; then
    echo "❌ Error: No se encuentra '$JS_PATH' en $(pwd)"
    echo "Asegúrate de tener el archivo de configuración en la carpeta config/"
    exit 1
fi

# Ejecutar node (ahora sí encontrará el .env porque estamos en la raíz)
node "$JS_PATH" "$@"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "🏁 Proceso finalizado correctamente."
else
    echo "⚠️  El proceso finalizó con errores."
fi

exit $exit_code
