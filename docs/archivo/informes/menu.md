# Informe — Barra y menú (lane C, worktree PulseFlow-menu)

Agente: lane C. Rama: `feature/f10-menu`. Worktree:
`/Users/santiagomercadocarbone/Documents/Develops/PulseFlow-menu`.
Tareas asignadas: F10.0f → F10.7 → F11.1 (en ese orden).

---

## F10.0f — IPC sin ruido ✅

**Qué hice**

1. **Canales de servidor (`REMOTE`, `STAGE`, `CONTROLLER`, `OUTPUT_STREAM`)**: en
   `src-tauri/src/commands/servers.rs` agregué el comando `SERVER_SEND`
   (`ServerSendData { channel, message }`, con espejo TS en
   `src/types/IPC/ServerSend.ts` y test de (de)serialización). Valida el canal contra
   `SERVER_ROOMS`, y si el servidor no está corriendo hace *no-op* (antes: "Command
   not found" en cada envío). En `src/frontend/IPC/tauri.ts`, `send()` enruta esos
   4 canales a `invoke("SERVER_SEND", …)` antes del `await` de listeners (los
   mensajes diferidos ya no se pierden esperando el registro de listeners).
2. **Avisos únicos**: los `console.warn` por comando OUTPUT/POSTPONED descartado y por
   canales sin IPC ahora son silenciosos salvo con
   `localStorage.pulseflowIpcDebug = "1"` (una sola vez por nombre de comando).
3. **`LOADED`** (`updateSettings.ts`): eliminado — era el handshake del webview
   Electron; el servidor de control recibe los mensajes por websocket.
4. **`LANGUAGE`** (`language.ts`): eliminados el send de handshake y el reenvío
   `OUTPUT(["LANGUAGE"])` con `setTimeout(…, 3000)` (éste era el warning que aparecía
   a los 3 s en la terminal). El idioma al cliente web remoto va por el canal
   `REMOTE` (remoteTalk).

**Verificación**

- `cargo check` limpio · `cargo test --lib`: 73/73 (4 nuevas).
- `bun run test:unit`: 66/66 (3 nuevas en `tauri.test.ts`).
- `bun run test:svelte`: 60 errores = baseline de la rama (los 2 extra sobre los 58
  originales son de `DisplayLayout.svelte`, de la lane A, ya en el base commit;
  ninguno en archivos míos).
- `bun run build`: OK.
- **App real** (`bun run dev:tauri`, ~4 min): **0 líneas `WARN`/`webview`** en la
  terminal. Antes del cambio, a los 3 segundos aparecía
  `[webview] WARN: [tauri] invoke() failed Command LANGUAGE not found`.
  *Pendiente manual:* abrir un show con 10 slides y confirmar en un cliente web
  remoto que recibe los cambios (no hay forma de hacerlo headless; `screencapture`
  falla por falta del permiso de grabación de pantalla en este entorno).

**Decisión / nota**

- Tocqué `updateSettings.ts` (sacar `LOADED`) aunque es archivo de la lane B
  (F10.1). Es un borrado de una línea, sin lógica; si hay conflicto al mergear,
  prevalece la versión sin `LOADED`.

---

## F10.7 — Menú "Pantallas", atajos y selector de look ✅

**Qué hice**

1. **Menú nativo macOS** (`src-tauri/src/menu.rs`, nuevo, `#![cfg(target_os =
   "macos")]`): submenu "Pantallas" con

   | Ítem | id del evento | Acelerador |
   | --- | --- | --- |
   | Mostrar pantallas de audiencia | `screens.toggle_audience` | ⌘1 |
   | Mostrar pantallas de stage | `screens.toggle_stage` | ⌘2 |
   | Configurar pantallas… | `screens.configure` | ⌘⇧1 |
   | Gestionar looks… | `screens.looks` | ⌘⇧L |
   | En vivo ▸ (looks) | `screens.look.<id>` | — |

   El submenu "En vivo" se rellena a demanda con el comando `update_live_menu`
   (`Vec<LiveMenuItem { id, name, active }>`, con tests de (de)serialización); el
   frontend lo empuja cuando cambian `$looks` / `$activeLook`. Cada ítem emite
   `menu-action` con su id al webview (`app.emit`). El menú se instala en `setup`
   (`lib.rs`) sólo en macOS.

2. **Frontend** (`utils/shortcuts.ts`): `initMenuActions()` (llamada desde
   `main.ts`) escucha `menu-action` y despacha:

   - `screens.toggle_audience` → `toggleOutputs(getAllNormalOutputs())`
   - `screens.toggle_stage` → `toggleOutputs(getAllStageOutputs())`
   - `screens.configure` → `activePopup.set("choose_screen")`
   - `screens.looks` → `activePopup.set("looks")`
   - `screens.look.<id>` → `applyLook(id)`

   Redefiní "audiencia" y "stage" con los helpers `getAllNormalOutputs` /
   `getAllStageOutputs` (filtrando por `stageOutput`) para no duplicar la lógica de
   grupos que ya vive en `helpers/output.ts`.

3. **Selector en la barra** (`Top.svelte`): dropdown compacto "Look: X" junto al
   botón de salida (`MaterialDropdown` con `label="Look"`, `value={$activeLook}`,
   opciones desde `$looks`, `on:change → applyLook`). Sólo aparece si hay looks.

4. **Windows** (`MenuBar.svelte`): menú "Pantallas" en la barra de menú con los
   mismos ítems (definidos localmente en el componente, porque
   `components/context/contextMenus.ts` está fuera del alcance del carril), más el
   submenu "En vivo" con los looks del store. Los atajos no se registran en Windows:
   Ctrl+1/Ctrl+2 siguen cambiando de pestaña del drawer.

5. **Clave nueva** `titlebar.screens` en `public/lang/en.json` (sección `menu`) y
   `public/lang/es.json`.

**Verificación**

- `cargo check` limpio · `cargo test --lib`: 76/76.
- `bun run test:unit`: 81/81 (tras mergear el carril B).
- `bun run test:svelte`: 57 errores = baseline mejorada de la rama; **0 en mis
  archivos** (sólo warnings de a11y heredados).
- `bun run build`: OK.
- **App real** (`bun run dev:tauri` dos veces, ~4 min c/u): compila y corre sin
  errores ni panic; el menú se instala sin excepción (`install()` devuelve `Ok`).
  *No se pudo capturar pantalla* de la barra de menú del sistema (la terminal no tiene
  permiso de grabación de pantalla) ni consultarla por accesibilidad (System Events
  pide permiso interactivo). Por eso la aceptación "el menú aparece en la barra" queda
  verificada **indirectamente** (sin panic + API de Tauri `set_menu`), no visualmente.

**Decisiones y notas**

- **Conflicto ⌘1/⌘2 con el drawer:** en macOS el acelerador del menú nativo captura
  la tecla antes de que llegue al webview, así que el bloque de `shortcuts.ts` que
  cambia pestañas con Ctrl/Cmd+dígito no los ve. En Windows no hay aceleradores en
  estos ítems, así que Ctrl+1/Ctrl+2 se mantienen como cambio de pestaña (documentado
  en un comentario en `shortcuts.ts`). No dupliqué atajos.
- **Archivos fuera de la lista del carril** (soporte, mínimos):
  `src/frontend/main.ts` (una llamada a `initMenuActions()`),
  `public/lang/en.json` / `es.json` (una clave dentro de `menu`, permitido por el
  plan), y `src/types/Main.ts` (aunque al mergear el carril B ya había agregado
  `looks`, no necesité tocar `Popups`). Sin cambios en `contextMenus.ts` ni en
  `App.svelte`.
- Un conflicto de merge en `src/types/Main.ts` (el carril B agregó `| "looks"`) se
  resolvió conservando ambos; commit de merge `db562b3f`.

## F11.1 — Barra superior como ProPresenter ✅

**Qué hice**

Reorganicé `main/Top.svelte` en los 5 grupos capsulares de la tabla "Barra superior"
(`docs/design/pantallas-y-looks.md`), reubicando accesos que ya existían:

- **Izquierda 1** `Buscar · Texto · Tema`: QuickSearch (`quickSearchActive`), toggle de
  formato de texto (`editMode`), drawer de templates.
- **Izquierda 2** `Show · Edit · Biblia · ⋯`: `TopButton` show/edit + Biblia abre el
  drawer de scripture + menú ⋯ con Editor de stage (`activePage="stage"`), Editor de
  temas (drawer templates) y Editor de overlays (drawer overlays).
- **Derecha 1** `Media · Look · Live`: toggle del cajón de medios, selector compacto
  "Look" (`MaterialDropdown` → `applyLook`), botón Live abre Ajustes → display.
- **Derecha 2** `Audiencia · Stage`: botones redondos que togglean cada grupo de salidas
  (`toggleOutputs` sobre `getAllNormalOutputs`/`getAllStageOutputs`), rojos cuando hay
  salidas en vivo (derivado de `outputState`); clic derecho → `choose_screen`.
- **Estado**: se mantiene `StatusIndicator` flotante (App.svelte) + punto de "sin guardar".

Se eliminó el botón único de salida y las pestañas sueltas; draw/settings/macTitleSpace/
users/unsaved-dot se conservan.

**Verificación**

- `bun run test:unit`: 86/86.
- `bun run test:svelte`: 56 = baseline (0 en mis archivos, sólo warnings de a11y heredados).
- `bun run build`: OK.
- **App real** (`bun run dev:tauri`, ~4 min): sin errores ni panic; barra reorganizada
  compila. *Verificación visual* del layout no posible por falta de permiso de captura
  de pantalla en este entorno (igual que F10.7).

**Notas**

- `public/lang/en.json` y `es.json`: claves nuevas dentro de `menu` (search, text,
  theme, bible, more, stage_editor, theme_editor, overlay_editor, media, live, audience).
- `TopButton.svelte` sin cambios (sigue en modo legacy con `export let`).
- Clic derecho en Audiencia/Stage abre `choose_screen` (popup legacy), como indica la
  spec hasta que exista la ventana "Configuración de pantallas" (lane E).
