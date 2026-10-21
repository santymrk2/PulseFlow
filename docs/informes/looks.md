# Informe — Carril B (Looks): F10.1, F10.2 y F10.6

Rama: `feature/tauri-rust-migration`. Worktree: `brave-wolf`.
Commits de este carril (todos pusheados a `origin/feature/tauri-rust-migration`):

| Commit | Tarea |
| --- | --- |
| `2c7e3f89` | **F10.1** modelo de datos y migración idempotente de looks |
| `8ecbcd1b` | **F10.2** puente Look → render activo al arrancar |
| `f23c50e5` | docs: marcar F10.0a–e, F10.1 y F10.2 en el roadmap |
| `df01772a` | **F10.6** modal "Looks" |
| `43405e4b` | docs: marcar F10.6 en el roadmap |

## Qué se hizo

### F10.1 — Modelo de datos y migración idempotente
- Tipos nuevos en `src/types/Save.ts`: `SaveListSyncedSettings` con `looks`,
  `activeLook` y `stylesLegacyBackup`.
- `src/frontend/utils/save.ts`: `getSyncedSettings()` / `saveList` persisten los
  campos nuevos.
- La migración corre **dentro de los handlers de `updateSettings.ts`** (los
  `SYNCED_SETTINGS` se cargan antes que `SETTINGS`), no como paso suelto:
  - Genera un look por cada salida con `kind: "audience"` (los `outputs` viejos
    pasan a `kind: "audience"`).
  - Crea las pantallas del look con el formato `LookScreen`.
  - Vacía los `outputs` de "stage" de la lista de pantallas del look.
  - Copia los estilos viejos que **no** son `__look__*` a `stylesLegacyBackup`
    (una sola vez → idempotente).
- `src/frontend/components/helpers/looks.ts`: lógica de migración.
- `src/frontend/components/helpers/looks.migration.test.ts`: **15 tests** con un
  fixture que cumple la aceptación (2 salidas + 1 stage + 3 estilos + 2 looks).
  Verifican la migración, la idempotencia (correrla dos veces no duplica) y el
  puente de F10.2.

### F10.2 — Puente Look → render
- `src/frontend/utils/startup.ts`: `startLookBridge()` se llama en
  `startupMain()`; mantiene sincronizado el look en vivo con el render.
- `src/frontend/components/helpers/historyActions.ts`: `handleApplyLook` en el
  formato nuevo (se quitó `applyLookStyles`).
- `src/frontend/components/settings/tabs/Looks.svelte` reescrita al formato
  `LookScreen` (svelte-check quedó en 57 errores, base 58).

### F10.6 — Modal "Looks"
- `src/frontend/components/looks/`: `Modal.svelte` (base con la misma API que el
  modal de pantallas), `LooksWindow.svelte`, `LookGrid.svelte`,
  `LookAdvanced.svelte`.
- `settings/tabs/Looks.svelte` queda como botón que abre el modal (hasta F10.8).
- Popup `looks` registrado en `utils/popup.ts` y `types/Main.ts`.
- Cambios de look en el historial: updater `settings_look` en `historyHelpers.ts`.
- Claves nuevas en `public/lang/en.json` y `es.json` (sección `looks`).

## Verificación

| Chequeo | Resultado |
| --- | --- |
| `bun run test:unit` | 78/78 ✔ |
| `bun run test:svelte` | 57 errores (base 58) ✔ |
| prettier (archivos tocados en `src/`) | OK ✔ |
| `bun run build` | OK ✔ |
| `cargo check` / `cargo test --lib` | no aplica (no se tocó Rust) |

Verificación funcional en la app corriendo:
- El modal renderiza (título, "En vivo: Default", presets Default + Sólo letras,
  grilla Principal con Presentación/tema + filas Slide/Media/Overlays,
  "Más opciones", slider de transición "1.0 s", "Poner en vivo").
- La casilla Media edita el borrador; Guardar se habilita sólo si hay cambios y
  persiste `$looks.default.screens.out1.layers.media` → `false`.
- Puente end-to-end: `applyLook('letras')` deja
  `styles['__look__out1'].layers = ["slide","overlays"]` (Media apagado) contra
  el Default `["background","slide","overlays"]`.

**Limitación del entorno (importante):** no se pudo hacer la verificación visual
real con `RENDER_SNAPSHOT`. En el entorno del agente `screencapture -x` falla
("could not create image from display", sin permiso de Grabación de pantalla),
osascript por accesibilidad se cuelga, y el panel de navegador en
`localhost:1420` renderiza vacío sin la IPC de Tauri. La evidencia anterior se
obtuvo inyectando los stores en el panel y leyendo las capas del look. **La
aceptación de F10.6 (y la de F10.2 con dos looks mostrando escenas distintas)
queda pendiente de una pasada manual del usuario** con `RENDER_SNAPSHOT` (ver
`docs/VERIFICAR.md`).

## Decisiones pendientes (tomadas en modo conservador)

1. **Settings → Looks queda como botón** que abre el modal, en vez de eliminar
   la pestaña; se limpia en F10.8.
2. **`Modal.svelte` base vive en `components/looks/`** porque
   `components/main/Modal.svelte` todavía no existe (lo crea el carril A para
   F10.3). Al integrar, unificar con ese archivo.
3. **Renombrar look usa `prompt()`** por ahora; no hay diálogo de entrada en el
   sistema de popups de este carril.
4. **`stylesLegacyBackup` guarda sólo estilos que no son `__look__*`**, y se
   escribe una sola vez (idempotente).
5. **La transición se guarda en milisegundos** (`Transition.duration`); el
   `transitionMs` de la celda mapea a `duration` cuando la celda no define una
   transición propia.
6. **`stageOutput` se conserva** al agregar `kind: "stage"` / `stageLayout`
   (~44 archivos todavía lo leen); las celdas de stage se sacan de las pantallas
   del look.

## Notas técnicas

- El reemplazo de un ítem completo en el historial necesita
  `newData: { data }` **sin** `key`; con `key` escribía `a[id][key]` y quedaba
  como no-op silencioso (bug corregido durante la verificación).
- Los datos de FreeShow locales reales
  (`~/Library/Application Support/freeshow/`) están en formato viejo (1 salida
  "VENTANA", sin estilos ni looks), así que el fixture del test se construyó a
  medida para cumplir la aceptación.
