# Reporte del caso LAGO: popup de instalacion PWA

## Resumen

Este reporte documenta el caso del popup de instalacion de la PWA en el entorno local de LibreChat-AVI, conocido internamente como caso LAGO. El objetivo fue lograr que la aplicacion mostrara una opcion de instalacion para AVI sin que el usuario tuviera que entrar manualmente al menu de Chrome.

## Situacion previa

Antes de aplicar cambios, el comportamiento observado era el siguiente:

- La aplicacion corria en `http://localhost:3090/`.
- El usuario podia instalar la app solo desde el menu de Chrome: "Transmitir, guardar y compartir" > "Instalar pagina como app".
- No aparecia ningun popup automatico al cargar la pagina.
- El nombre mostrado en el dialogo de instalacion era "LibreChat" o "Asistente Virtual en Infancia", segun la configuracion detectada por el navegador.

## Hipotesis iniciales revisadas

Durante el analisis se evaluaron varias causas posibles:

1. El manifest de la PWA tenia el nombre incorrecto.
2. El service worker no estaba activo en desarrollo.
3. El navegador no estaba recibiendo el evento `beforeinstallprompt`.
4. El icono `apple-touch-icon-180x180.png` tenia un tamano que no coincidia con el declarado en el manifest.
5. Era necesario servir la app por HTTPS para que Chrome la considerara instalable.

## Cambios realizados en el codigo

### 1. Configuracion de Vite y PWA

Archivo modificado: [client/vite.config.ts](../client/vite.config.ts)

Cambios aplicados:

- Se agrego la dependencia y el uso de `vite-plugin-mkcert`.
- Se ajusto la configuracion de la PWA para usar `registerType: 'prompt'`.
- Se habilito `devOptions.enabled = true` para probar la PWA en desarrollo.
- Se elimino del manifest el icono `assets/apple-touch-icon-180x180.png`, porque generaba el error de tamano incorrecto.
- Se mantuvo el nombre de la app como `AVI` en `name` y `short_name`.

### 2. Componente de instalacion

Archivo creado/modificado: [client/src/components/ui/InstallPWAButton.tsx](../client/src/components/ui/InstallPWAButton.tsx)

Cambios aplicados:

- Se creo un componente flotante para mostrar una tarjeta de instalacion propia dentro de la app.
- Se agrego escucha del evento `beforeinstallprompt`.
- Se agrego escucha del evento `appinstalled` para ocultar el aviso cuando la instalacion se completa.
- Se reemplazo el boton simple por un aviso visual mas claro con acciones de instalar y cerrar.

### 3. Montaje global del aviso

Archivo modificado: [client/src/App.jsx](../client/src/App.jsx)

Cambios aplicados:

- Se monto `InstallPWAButton` en el nivel raiz de la app para que aparezca al cargar cualquier pagina.

### 4. Limpieza de import huirfano

Archivo modificado: [client/src/components/Nav/Nav.tsx](../client/src/components/Nav/Nav.tsx)

Cambios aplicados:

- Se elimino un import que quedo sin uso despues de mover el componente de instalacion al nivel raiz.

## Errores encontrados y solucion

### Error 1: El popup no aparecia automaticamente

**Sintoma:** el usuario solo podia instalar desde el menu manual de Chrome.

**Solucion aplicada:** se creo un aviso propio dentro de la aplicacion y se dejo a Chrome la decision final de emitir `beforeinstallprompt`.

**Conclusion tecnica:** el popup nativo de Chrome no se puede forzar completamente desde React. Lo correcto es mostrar una UI propia y usar el evento del navegador cuando este lo entregue.

### Error 2: Icono del manifest con tamano incorrecto

**Sintoma:** Chrome mostro el error:

`Error while trying to use the following icon from the Manifest: ... apple-touch-icon-180x180.png (Resource size is not correct)`

**Solucion aplicada:** se elimino ese icono del manifest para evitar que Chrome rechazara la instalacion por inconsistencia de recursos.

### Error 3: HTTPS no estaba activo en desarrollo

**Sintoma:** la app corria en HTTP y al intentar usar HTTPS aparecia `ERR_SSL_PROTOCOL_ERROR`.

**Solucion aplicada:** se uso `vite-plugin-mkcert` para habilitar un certificado local confiable en el entorno de desarrollo.

**Nota importante:** la configuracion final quedo con HTTPS funcional solo despues de aceptar el aviso de seguridad de Windows para confiar en la CA local de `mkcert`.

### Error 4: El boton decia "Preparando instalacion"

**Sintoma:** el componente mostraba estado de espera y no dejaba instalar.

**Causa real:** el navegador no habia emitido `beforeinstallprompt` en esa sesion.

**Solucion aplicada:** se mantuvo el boton visible como aviso propio, pero la accion real depende de que Chrome haga disponible el prompt.

## Flujo de prueba observado

1. Se levanto la base de datos con Docker.
2. Se ejecuto el frontend de Vite en desarrollo.
3. Se accedio a `https://localhost:3090/`.
4. Windows mostro el aviso de confianza del certificado local de `mkcert`.
5. Chrome permitio luego la instalacion manual desde el menu del navegador.
6. La app ya mostro el nombre `AVI`.

## Resultado final

El caso quedo resuelto de la siguiente manera:

- La aplicacion ya se sirve en HTTPS local.
- La PWA ya no falla por el icono incorrecto.
- El nombre de la app es AVI.
- Existe un aviso automatico propio dentro de la app para guiar al usuario.
- El popup nativo de Chrome sigue dependiendo del navegador y no puede forzarse al 100% desde codigo.

## Conclusiones

La parte controlable desde el proyecto quedo implementada correctamente. Lo que sigue siendo limitacion del navegador es la aparicion automatica del dialogo nativo de instalacion. Por eso la solucion mas robusta es combinar:

- configuracion valida de PWA,
- HTTPS local confiable,
- y un banner propio de instalacion dentro de la app.

## Archivos clave

- [client/vite.config.ts](../client/vite.config.ts)
- [client/src/components/ui/InstallPWAButton.tsx](../client/src/components/ui/InstallPWAButton.tsx)
- [client/src/App.jsx](../client/src/App.jsx)
- [client/src/components/Nav/Nav.tsx](../client/src/components/Nav/Nav.tsx)



### analisis del reporte

Perfecto, con el `vite.config.ts` a la vista ya puedo confirmar la causa raíz. **Encontré el problema principal: tu manifest no cumple los criterios de instalabilidad de Chrome por los iconos.** Vamos al detalle.

## 🔴 Problema 1 (crítico): No tienes un icono 512x512 con `purpose: "any"`

Mira tu bloque de iconos:

```ts
icons: [
  { src: 'assets/favicon-32x32.png', sizes: '32x32', ... },   // irrelevante para instalación
  { src: 'assets/favicon-16x16.png', sizes: '16x16', ... },   // irrelevante para instalación
  { src: 'assets/icon-192x192.png', sizes: '192x192', ... },  // ✅ purpose "any" (implícito)
  { src: 'assets/maskable-icon.png', sizes: '512x512', purpose: 'maskable' }, // ⚠️ SOLO maskable
],
```

Tu único icono de 512px está declarado **exclusivamente** como `maskable`. Esto es un problema conocido: como mínimo el manifest necesita un icono 192px (any) y un 512px (any); el maskable de 512px es adicional. De hecho, la causa más común de que no aparezca el prompt de instalación es la falta del icono 512x512, ya que Chrome requiere ambos iconos de 192px y 512px.

**Solución** — agrega un icono 512 con purpose `any` (o usa el mismo archivo con doble propósito):

```ts
icons: [
  {
    src: 'assets/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: 'assets/maskable-icon.png',  // o idealmente un icon-512x512.png dedicado
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',          // ← clave: que exista un 512 "any"
  },
  {
    src: 'assets/maskable-icon.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
],
```

> Nota: lo ideal es tener dos archivos distintos (el maskable necesita mantener el contenido dentro de la zona segura central del 80%), pero para desbloquear la instalabilidad puedes reutilizar el mismo PNG. Los favicons de 16/32px puedes dejarlos, pero no cuentan para la instalación.

## 🟡 Problema 2: `base: ''` y el `start_url`

No declaras `start_url` ni `scope` en el manifest. En `vite-plugin-pwa`, el `start_url` y el `scope` se configuran automáticamente a partir del `base` de Vite; el plugin asigna `start_url` al base path por defecto. Como tienes `base: ''`, el resultado puede ser un `start_url` vacío o relativo, lo cual es frágil.

**Solución** — decláralos explícitamente para no depender del comportamiento implícito:

```ts
manifest: {
  name: 'AVI',
  short_name: 'AVI',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  // ...
}
```

Verifica después en **DevTools → Application → Manifest** que `start_url` aparezca como `/` y no vacío.

## 🟡 Problema 3: `mkcert` es innecesario para tu caso

Confirmando lo que te comenté antes: para que una PWA sea instalable debe servirse por HTTPS, o desde un entorno de desarrollo local usando localhost o 127.0.0.1, con o sin puerto. Es decir, tu `http://localhost:3090` **ya cumplía** el requisito de origen seguro. El `ERR_SSL_PROTOCOL_ERROR` y el aviso de Windows fueron fricción autoinfligida.

**Recomendación:** quita `mkcert()` del array de plugins para desarrollo local. Solo lo necesitas si pruebas desde otro dispositivo de la red (ej. un móvil apuntando a la IP de tu PC).

## 🟢 Detalles menores

1. **Glob huérfano en workbox**: sigues listando `'assets/apple-touch-icon*.png'` en `globPatterns` aunque eliminaste ese icono del manifest. No rompe nada (el glob simplemente no matchea), pero límpialo por coherencia.

2. **Requisito de interacción del usuario**: aun con todo correcto, Chrome exige que el usuario haya hecho clic o tocado la página al menos una vez, en cualquier momento, incluso en una carga previa, y que la web app no esté ya instalada para disparar `beforeinstallprompt`. Si pruebas recargando sin tocar nada, el evento no llega. Esto explica perfectamente tu "Error 4" intermitente.

3. **Reinicia Vite tras cambiar el config**: necesitas detener y reiniciar el dev server para que VitePWA regenere el manifest con los cambios.

## ✅ Checklist de verificación final

```
1. Aplicar los 3 cambios (iconos, start_url/scope, quitar mkcert)
2. Reiniciar `vite dev`
3. Desinstalar instancias previas en chrome://apps
4. Abrir http://localhost:3090 en ventana normal (no hace falta HTTPS)
5. DevTools → Application → Manifest → revisar sección "Installability"
   → debe estar sin errores
6. Hacer CLIC en cualquier parte de la página
7. Tu InstallPWAButton debería recibir beforeinstallprompt
```

Una vez que el manifest cumpla los criterios, Chrome dispara el evento `beforeinstallprompt` que puedes usar para invitar al usuario a instalar tu PWA — y tu componente `InstallPWAButton`, que ya está bien planteado, dejará de quedarse en "Preparando instalación".

**Mi apuesta:** el bloqueador número uno es el icono 512 solo-maskable. Es el error más silencioso porque el manifest parsea sin warnings visibles, pero Chrome simplemente nunca emite el evento. Corrige eso primero y prueba.