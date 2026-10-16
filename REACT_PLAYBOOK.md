# Plan de Migración Frontend: React + Tailwind + shadcn/ui (Shadow Migration)

## Protocolo de Trabajo Autónomo

1. **Flujo de Ejecución Estricto:** Avanza bloque por bloque. Ejecuta los comandos de terminal necesarios usando `bun`, escribe el código y verifica.
2. **Cero Interrupciones:** No te detengas a pedir confirmación. Cuando un bloque esté listo, márcalo con `[x]` y pasa INMEDIATAMENTE al siguiente.
3. **Aislamiento:** Todo el trabajo debe ocurrir en la nueva carpeta `src-react/`. NO modifiques la carpeta `src/` (Svelte) bajo ninguna circunstancia.

---

## BITÁCORA DE EJECUCIÓN

### [x] Bloque 1: Inicialización de Vite y React

- **Objetivo:** Crear el nuevo lienzo en blanco.
- **Acción:**
  1. Usa `bun create vite src-react --template react-ts` para generar el proyecto.
  2. Entra a `src-react/`, elimina el código repetitivo (`App.css`, logos de Vite) y limpia `App.tsx`.
  3. Modifica `src-react/vite.config.ts` para que el servidor corra obligatoriamente en el puerto `3001` (`server: { port: 3001, strictPort: true }`).
  4. En `src-react/package.json`, asegúrate de que el nombre sea `freeshow-react`.

### [x] Bloque 2: Tailwind CSS y shadcn/ui

- **Objetivo:** Instalar el sistema de diseño moderno.
- **Acción:**
  1. Dentro de `src-react/`, instala Tailwind CSS: `bun add -D tailwindcss postcss autoprefixer` y ejecuta `bunx tailwindcss init -p`.
  2. Configura `tailwind.config.js` y `index.css` siguiendo las bases estándar.
  3. Inicializa shadcn/ui ejecutando `bunx --bun shadcn-ui@latest init` (usa estilo "New York", color base "Slate", variables CSS "yes").
  4. Agrega los componentes básicos de layout de shadcn: `bunx --bun shadcn-ui@latest add resizable button scroll-area`.
  5. Fuerza un tema oscuro por defecto inyectando la clase `dark` en el `html` o el `body` principal.
- **Nota (desviación 2026-10-15):** El CLI moderno cambió: `shadcn-ui` está deprecado → se usó `bunx --bun shadcn@latest init -b radix -p nova -y --css-variables`. El nuevo shadcn (v4) assume Tailwind **v4** (genera `@theme inline`, `@custom-variant`, `@utility`, colores en `oklch`, utilidades v4 como `ring-3`/`has-data-*`/`in-*`/`not-*`). Por compatibilidad, el proyecto se migró a **Tailwind v4** (`tailwindcss@4` + `@tailwindcss/vite`, plugin en `vite.config.ts`); se eliminaron `tailwind.config.js` y `postcss.config.js`. `index.css` fue reescrito con `@import "tailwindcss"` + `@custom-variant dark` + mapeo `@theme inline`. Componentes: `resizable` (react-resizable-panels v4 API `Group/Panel/Separator`), `button` (usa `Slot` de `radix-ui`), `scroll-area`. Build/tipo OK. Se pidió "New York/Slate"; el nuevo CLI usa presets (`nova`) y base neutral — equivalente visual.

### [x] Bloque 3: El Puente IPC (Tauri a React)

- **Objetivo:** Conectar React con el backend de Rust que ya existe.
- **Acción:**
  1. Instala el API de Tauri en el nuevo frontend: `bun add @tauri-apps/api`.
  2. Crea la carpeta `src-react/src/IPC/` y `src-react/src/types/`.
  3. Copia el archivo `src/frontend/IPC/tauri.ts` a `src-react/src/IPC/tauri.ts`.
  4. Copia todos los archivos de tipos necesarios desde `src/types/` a `src-react/src/types/` para que `tauri.ts` no tenga errores de TypeScript.
  5. En `src-react/src/main.tsx`, importa y ejecuta `setupTauriApi()` antes de renderizar el `<App />`.
- **Nota (desviación 2026-10-15):** `@tauri-apps/api@2.12.4`. `tauri.ts` no importa tipos locales (usa `any` internamente), así que **no** se copió el árbol `src/types/` todavía: esos archivos dependen de tipos Node/Electron (`music-metadata`, `exif`, `fs`, `json-bible`) que romperían `tsc`. Se copiarán/portarán cuando un bloque los necesite. Se creó `src-react/src/global.d.ts` con la augmentación `Window.api` (extraída de `src/frontend/global.d.ts`, sin las partes Svelte). Se ajustó el tipo del índice `listenerPromises`/`unlisteners` a `| undefined` por el error TS2801 de TS 6. `setupTauriApi()` se invoca en `main.tsx` antes de renderizar. Build/tipo OK.

### [x] Bloque 4: El "App Shell" (Estructura Base Profesional)

- **Objetivo:** Crear la distribución clásica de software de producción (estilo Premiere/Resolume).
- **Acción:**
  1. En `App.tsx`, utiliza el componente `ResizablePanelGroup` de shadcn/ui para crear un diseño de 3 columnas:
     - **Panel Izquierdo (20%):** Biblioteca / Shows (fondo oscuro).
     - **Panel Central (60%):** Área de trabajo principal / Previsualización.
     - **Panel Derecho (20%):** Propiedades / Ajustes rápidos.
  2. Añade un componente superior (`Topbar.tsx`) fijo que actúe como barra de título y menú principal.
  3. Estiliza todo con colores muy oscuros (ej. `bg-zinc-950` para el fondo, `bg-zinc-900` para paneles, bordes `border-zinc-800`), creando un look hiper-profesional y minimalista.
- **Nota (2026-10-15):** `App.tsx` usa `ResizablePanelGroup` (api v4 `orientation`/`Panel defaultSize` string=%) con 3 columnas 20/60/20 (`bg-zinc-900`, `border-zinc-800`), ScrollArea por panel y una tira inferior de miniaturas en el panel central. Se creó `components/Topbar.tsx`: barra superior `h-10` `bg-zinc-900` con `data-tauri-drag-region` (arrastre de ventana), menú (File/Edit/View/Tools/Help) y controles min/max/close enlazados a `@tauri-apps/api/window` (`getCurrentWindow()`, guardado con `isTauri`). Build + `vite dev` (puerto 3001) OK; se verificó que Tailwind genera las utilidades y la variante `.dark`.

### [x] Bloque 5: Gestión de Estado y Datos Reales

- **Objetivo:** Conectar React al backend de Rust para recibir los datos iniciales y mostrarlos.
- **Acción:**
  1. Configurar `zustand` para el estado global (`useAppStore.ts`).
  2. Implementar el handshake `STARTUP` invocando `READY` vía `tauri.ts`.
  3. Escuchar las respuestas de `MAIN` y renderizar la lista real de Shows en el panel izquierdo (`LibraryPanel.tsx`).
- **Nota (2026-10-15):** `zustand@5.0.15`. Creados: `types/Show.ts`, `IPC/channels.ts` (`STARTUP`/`MAIN`/`Main`), `store/useAppStore.ts` (`status`/`shows`/`settings`), `hooks/useStartup.ts` (handshake STARTUP→READY→TYPE, guard anti-StrictMode, timeout 5s→offline; pide `Main.SHOWS`/`Main.SETTINGS`), `components/LibraryPanel.tsx` y `App.tsx` (status dot + contador). Verificado end-to-end con `tauri dev`: el panel izquierdo muestra el show real `Welcome` leído por Rust de `<dataPath>/Shows/Welcome.show`. Build + tipo OK.

### [x] Bloque 6: Motor de Proyección (Pantalla de Audiencia)

- **Objetivo:** Solucionar los bugs históricos de la ventana secundaria de salida (Output) usando ventanas nativas de Tauri.
- **Acción:**
  1. Configurar la creación de una segunda ventana nativa en Rust/Tauri que cargue el frontend de React pero en modo "Output" (pantalla completa, fondo negro, sin bordes).
  2. Crear la vista `OutputView.tsx` en React.
  3. Sincronizar el estado de Zustand entre la ventana principal de Control y la ventana de Audiencia, para que los clics en los slides se reflejen en tiempo real sin desincronización ni consumo excesivo de RAM.
- **Nota (2026-10-15):** Ventana nativa `"output"` creada en Rust (`commands/output.rs`: `OPEN_OUTPUT_WINDOW`/`CLOSE_OUTPUT_WINDOW`/`IS_OUTPUT_WINDOW_OPEN` + `OutputWindowOptions`; registradas en `lib.rs`). Auto-selecciona el monitor secundario (pantalla completa si hay >1 monitor, si no ventana al 62%), sin bordes, fondo negro. `main.tsx` enruta por `getCurrentWindow().label` → `OutputView.tsx` (negro, ESC cierra, F alterna pantalla completa, arrastrable). Sincronización entre ventanas vía **eventos Tauri** (`IPC/projection.ts`: `PROJECTION_STATE` Control→Audiencia, `PROJECTION_MSG` Audiencia→Control; `hooks/useProjectionSync.ts` con `useProjectionBroadcast`/`useProjectionListener`), estado en `store/useProjectionStore.ts`. **Corrección clave en `capabilities/default.json`:** estaba limitada a `windows: ["main"]` (la ventana `output` se quedaba sin permisos → sin `listen`/`emit`); ahora `["main","output"]` + permisos `core:window:allow-close/minimize/toggle-maximize/set-fullscreen/start-dragging` (también arregla los controles y el drag de `Topbar`). Verificado por el usuario: ventana de audiencia abre y sincroniza al instante. Build + oxlint OK.

### [x] Bloque 7: Editor Visual y Drag & Drop

- **Objetivo:** Reconstruir el área de trabajo central con interacciones fluidas.
- **Acción:**
  1. Instalar `@dnd-kit/core` y sus utilidades.
  2. Crear un sistema de cuadrícula (grid) en el panel central para las diapositivas.
  3. Implementar la funcionalidad de arrastrar y soltar (Drag & Drop) para reordenar diapositivas y agregar contenido multimedia desde la librería al editor.
- **Nota (2026-10-15):** `@dnd-kit/core@6.3.1` + `sortable@10`/`utilities@3`/`modifiers@9`. Creados: `types/Show.ts` (tipos completos `Show`/`Layout`/`Slide`/`Item`), `lib/show.ts` (`normalizeShow`, `getLayoutSlideIds`, `moveLayoutSlide`, `parseStyle`), `store/useShowStore.ts` (`openShow`/`applyShow`/`selectSlide`/`reorderSlides` + persistencia debounced vía `SAVE`), `hooks/useShowLoader.ts` (receptor `SHOW` en `MAIN`), `components/SlideThumbnail.tsx` (lienzo 1920×1080 escalado con `ResizeObserver`), `components/SlideGrid.tsx` (`DndContext`+`SortableContext` rect, sensors con umbral 5px), `components/Editor.tsx`. Panel central = Editor; controles de salida movidos al panel derecho. Clic en la biblioteca carga el show (+ botón de recarga). Fix: `vite.config.ts` → `server.host: "127.0.0.1"` (Vite se enlazaba solo a IPv6 `[::1]` y `tauri dev` esperaba IPv4 `127.0.0.1:3001` indefinidamente). Verificado por el usuario: grid renderiza, DnD fluido y el orden persiste. Fixture `Demo.show` (6 slides) creado para la demo.

### [x] Bloque 8: Reproducción Multimedia y Miniaturas (Integración FFmpeg)

- **Objetivo:** Visualización de medios sin bloquear la interfaz.
- **Acción:**
  1. Conectar React con los comandos de Rust para generar miniaturas al vuelo mediante FFmpeg.
  2. Crear un componente `MediaItem.tsx` que cargue la miniatura de forma asíncrona (con un esqueleto de carga de shadcn mientras se procesa).
  3. Asegurar transiciones suaves al enviar un video a la pantalla de Audiencia.

### [x] Bloque 9: Atajos de Teclado, Menús Contextuales y Pulido "Pro"

- **Objetivo:** Lograr una UX de software de producción profesional.
- **Acción:**
  1. Integrar el componente `ContextMenu` de shadcn/ui para habilitar opciones de clic derecho en shows, medios y diapositivas.
  2. Implementar un gestor de atajos de teclado (ej. Barra espaciadora para avanzar, ESC para limpiar pantalla de audiencia) usando listeners globales optimizados en React.

  ### [x] Bloque 10: Biblias, Letras y Editor de Texto Avanzado

- **Objetivo:** Paridad total en la gestión de texto y versículos.
- **Acción:**
  1. Migrar la lógica de importación y búsqueda de Biblias/Letras.
  2. Implementar un editor de texto enriquecido en React (para sombras, contornos, alineación y fuentes personalizadas).
  3. Conectar la salida de texto renderizada al motor del Output.

### [x] Bloque 11: Stage Display y Overlays (Pantallas Secundarias)

- **Objetivo:** Soportar pantallas de retorno para músicos y gráficos superpuestos.
- **Acción:**
  1. Crear la vista `StageView.tsx` optimizada para alto contraste, relojes, temporizadores y notas de la siguiente diapositiva.
  2. Migrar el sistema de Overlays (logos, alertas, tercios inferiores) para que floten por encima del Output principal.

### [x] Bloque 12: Hardware y Red (MIDI, NDI, Blackmagic)

- **Objetivo:** Conectar la UI con los "Final Bosses" de Rust.
- **Acción:**
  1. Crear paneles de configuración para entradas/salidas MIDI.
  2. Añadir la UI para descubrir y seleccionar fuentes NDI en la red.
  3. Integrar los selectores para enviar la señal a tarjetas Blackmagic (DeckLink).

### [x] Bloque 13: Panel de Configuración Global y Sincronización

- **Objetivo:** El centro de mandos de la aplicación.
- **Acción:**
  1. Reconstruir la vista de Settings (General, Atajos, Pantallas, Integraciones).
  2. Conectar la sincronización en la nube (Drive API) y gestión de usuarios/perfiles si aplica.
