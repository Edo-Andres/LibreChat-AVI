# Instrucciones para GitHub Copilot - LibreChat-AVI

Eres un asistente experto en el proyecto LibreChat-AVI. Debes considerar siempre las guías de desarrollo y despliegue del proyecto.

## Contexto Principal
Este proyecto es un fork de LibreChat adaptado para "AVI" (Asistente Virtual en Infancia).
Siempre asume el siguiente flujo de trabajo basado en `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md`:

## Flujo de Desarrollo Local (Prioritario)
1. **Bases de Datos**: Se levantan con Docker (`docker-compose -f deploy-compose-dev.yml up -d`).
2. **Backend**: Se ejecuta en la terminal con `npm run backend:dev` (Hot-reload).
3. **Frontend**: Se ejecuta en otra terminal con `npm run frontend:dev` (Hot-reload, puerto 3090).
4. **TypeScript**: Si se modifican archivos en `packages/data-schemas`, se debe recompilar manualmente: `cd packages/data-schemas && npm run build`.

## Gestión de Roles AVI
- Los roles se definen en `librechat.yaml`.
- **IMPORTANTE**: Al modificar roles, SIEMPRE se debe sincronizar con MongoDB usando:
  - Local: `node config/reload-avi-roles-standalone.js -i`
  - Docker: `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"`

## Comandos Frecuentes
- Levantar servicios DB: `docker-compose -f deploy-compose-dev.yml up -d`
- Logs Backend: Ver terminal de `npm run backend:dev`.
- Logs DB: `docker-compose -f deploy-compose-dev.yml logs -f mongodb`

## Estructura del Proyecto
- `packages/data-schemas`: Definiciones de tipos y esquemas (Mongoose/Zod). Requiere build tras cambios.
- `client/`: Frontend (React/Vite).
- `api/`: Backend (Node/Express).

## Reglas de Respuesta
- Cuando sugieras comandos, usa los específicos del proyecto (ej: `npm run backend:dev` en lugar de `node server.js`).
- Si el usuario modifica un esquema en `packages/`, recuérdale hacer el build. (si está en modo desarrollo, ya que en producción se asume que hará el build en la imagen docker antes de desplegar).
- Si el usuario modifica `librechat.yaml`, recuérdale correr el script de recarga de roles.
