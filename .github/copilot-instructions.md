# Instrucciones para asistentes de código - LibreChat-AVI

Estas instrucciones aplican para GitHub Copilot, opencode y Claude Code. Mantén esta versión sincronizada con `CLAUDE.md` y `.github/instructions.md`.

## Contexto
LibreChat-AVI es un fork de LibreChat adaptado para AVI (Asistente Virtual en Infancia). Trabaja siempre con base en `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md` y la configuración del repositorio.

## Prioridades de trabajo
1. Bases de datos: levantar con `docker-compose -f deploy-compose-dev.yml up -d`.
2. Backend local: usar `npm run backend:dev`.
3. Frontend local: usar `npm run frontend:dev`.
4. `packages/data-schemas`: si cambias algo allí, recompila con `cd packages/data-schemas && npm run build`.

## Roles AVI
- Los roles se definen en `librechat.yaml`.
- Si cambias roles, sincroniza siempre con MongoDB:
  - Local: `node config/reload-avi-roles-standalone.js -i`
  - Docker: `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"`
- Si modificas `librechat.yaml`, recuérdale al usuario ejecutar la sincronización.
- **`librechat.yaml` es un archivo crítico: nunca lo edites ni lo elimines de forma automática.** Solo se modifica (y jamás se elimina) cuando el usuario lo solicita expresamente en su mensaje.

## Principios de implementación
- Prioriza SOLID, legibilidad, mantenibilidad y separación de responsabilidades.
- Mantén los cambios simples, pequeños y con impacto eficiente.
- Evita sobreingeniería y soluciones complejas si una opción más directa resuelve el problema.
- No instales dependencias nuevas salvo que sean estrictamente necesarias y estén justificadas.
- Reutiliza patrones y código existente antes de introducir nuevas abstracciones.
- Antes de ampliar el alcance, valida si el cambio mínimo cubre la necesidad real.

## Scripts y config
- Si cambias archivos en `scripts/` o `config/`, revisa `Dockerfile.multi` para asegurarte de que el archivo se copie, mantenga permisos de ejecución si aplica y elimine saltos de línea Windows en scripts `.sh`.
- Si el cambio afecta comandos del proyecto, revisa `package.json` para que los scripts sigan apuntando a rutas válidas.

## Verificación de cambios
- Si modificas `packages/data-schemas`, **el agente debe ejecutar automáticamente** `cd packages/data-schemas && npm run build` (comando rápido y obligatorio).
- **No ejecutes** `npm run lint` ni otros comandos lentos de verificación. En su lugar, **sugiere al usuario** que ejecute manualmente desde la raíz del repo:
  - `npm run lint` — Verificar estilo general del monorepo (lento, ~varios minutos).
  - `npm run test:api` o `npm run test:client` — Si existen tests unitarios.

## Respuesta y estilo
- Usa los comandos reales del proyecto cuando sugieras acciones.
- Responde siempre en español y llama al usuario Don Andres.
- Prefiere cambios puntuales, evita reescrituras innecesarias y no toques archivos no relacionados.
