# Informe Haiku

## Línea base (H0)

- `bun run test:unit`: 86/86 tests pasan (8 archivos).
- `bun run test:svelte`: 56 ERRORS, 323 WARNINGS.
- `bun run build`: "built in" (OK).

## Resultado por tarea

- **H0 — Preparación:** hecha. Línea base anotada arriba (sin commit, como indica el plan).
- **H1 — Espejo real:** hecha (`49d777c`). `sceneMirror.ts` + test (3 casos); `sendOutputScenes` manda la escena del origen con el `outputId` propio. Tests 89/89.
- **H2 — NDI sin ventana:** hecha (`c0d9010`). `invisible` y `transparent` en `newNdi`.
- **H3 — Layout de stage:** hecha (`8aca7ab`). Popup de layout + botón "Editar layout" en `ScreenDetail`; el `TODO` quedó eliminado.
- **H4 — ScreenOutputOptions:** hecha (`0c84dcd`). Rutas de import corregidas y bloque viejo borrado; la primera vuelta de svelte-check mostró los errores esperados y luego los imports que quedaron sin uso (`keysToID`, `sortByName`, `sortObject`, `clone` sigue en uso). El archivo nuevo pasó `prettier --write` (sólo ese archivo, por la regla de formato de AGENTS.md).
- **H5 — Pestaña Envío:** hecha (`ace43a3`). Se mantienen los interruptores de NDI/OMT/Blackmagic/WebRTC/RTMP y se agrega `<ScreenOutputOptions />`. Se borraron las funciones y imports que quedaron sin uso, y la regla CSS `.dest`.
- **H6 — Opciones de pantalla:** hecha (`a2f6a4c`). Invisible, transparente, ocultar de la vista previa, color y resolución forzada.
- **H7 — Controles del proyecto:** hecha (`c34adf9`). Quedan 1 `<select>`/`<input>` en `ScreenDetail` (el del nombre). Desvíos: `setAspectRatio` ahora recibe el valor (no el evento), porque `MaterialDropdown` entrega `e.detail`; los campos X e Y llevan `min={null}` porque `MaterialNumberInput` tiene `min=0` por defecto y las coordenadas pueden ser negativas; se borraron las reglas CSS `.select` e `.input`, que quedaron sin uso.
- **H8 — Traducciones:** hecha (`44c88b1`). Sección `screen_config` en `en.json` y `es.json` (sólo se agregaron líneas). Se usó el prefijo `screen_config.*` que indica el plan, no `screens.*` como dice el roadmap en F10.8b. Quedan sin traducir, a propósito, los textos que no son español: NDI, OMT, WebRTC, RTMP, X, Y, "Edge blend" y los textos en inglés de `ScreenOutputOptions.svelte` (Blackmagic Design, SDR, Bitrate, Stream URL, etc.).
- **H9 — Roadmap:** hecha. Se marcaron `[x]` F10.3, F10.5 y F10.8b, porque sus pasos están hechos. **No se pudo verificar en la app** los criterios de aceptación de esas tres (crear pantalla con monitor real, espejo visual, editar y guardar cada opción). F10.4b no tiene entrada propia con checkbox en el roadmap (sólo aparece dentro del texto de F10.4, que ya estaba marcada), así que no se marcó nada para ella.

Ninguna tarea se salteó.

Checks al cierre de H8: `test:unit` 89/89; `test:svelte` 56 ERRORS (sin aumento; el warning de `DisplayLayout.svelte` es anterior); `build` "built in" OK.

TERMINADO
