# Plan F12 — Coherencia visual

Objetivo: que la app se vea como **una sola cosa**. Hoy conviven tres maneras de hacer
interfaz (el CSS heredado de FreeShow con `Material*`, los componentes shadcn-svelte de
`src/frontend/lib/components/ui/` y HTML suelto con estilos propios que agregaron los
agentes) y eso se nota: modales donde no entra el contenido, cosas encimadas, una barra
superior con tres estilos y textos mitad en inglés y mitad en español fijo.

**Hacé las tareas en orden, de a una.** Cada tarea dice qué archivos tocar, qué cambiar,
cómo verificar y qué mensaje de commit usar. Modelo recomendado: uno que pueda **ver
imágenes** (las capturas son parte de la verificación).

Referencias de diseño (sólo para mirar, no importar nada):
`docs/design-reference/` (estilo shadcn) y `docs/design/pantallas-y-looks.md`
(medidas de los modales y layout tipo ProPresenter).

## Reglas (leelas antes de empezar)

1. Leé `AGENTS.md`. Usá **sólo bun** (nunca npm/npx).
2. Tocá sólo los archivos que nombra la tarea (más `public/lang/en.json` y `es.json`
   para traducciones, agregando claves sin reformatear el archivo). Si necesitás tocar
   otro, anotalo en el informe y explicá por qué.
3. **Ninguna función se pierde.** Si movés o reemplazás un control, verificá en la app
   que sigue haciendo lo mismo y listalo en el mensaje del commit.
4. **No migres componentes legacy a runes.** Los componentes del kit (F12.2) son nuevos
   y pueden ser runes; desde un padre legacy se les pasa `onclick={...}` (prop), nunca
   `on:click`. Los componentes viejos que reciben `on:*` se quedan como están.
5. Colores sólo con variables del tema (`--primary`, `--primary-darker`,
   `--primary-lighter`, `--secondary`, `--text`, `--border-color`, `--radius`, …) o con
   las clases de Tailwind que ya apuntan a ellas (`bg-background`, `bg-card`,
   `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, …; ver
   `src/frontend/app.css`). Nada de hex sueltos.
6. **Antes de cada commit**:
   ```bash
   bun run test:unit          # todos pasan
   bun run test:svelte        # ERRORS no puede pasar de 56
   bun run build              # "built in"
   bunx prettier --config config/formatting/.prettierrc.yaml --check <archivos tocados en src/>
   ```
   Si tocaste Rust: `cd src-tauri && cargo check && cargo test --lib`.
7. Un commit por tarea con el mensaje indicado, después
   `git push -u origin feature/tauri-rust-migration`.
8. Si una tarea no se puede hacer como está escrita después de 2 intentos: deshacé sólo
   esa tarea (`git checkout -- <archivos>`), anotalo en `docs/informes/f12.md` y seguí.
9. Nunca te quedes esperando una respuesta: elegí la opción más conservadora, anotala
   como "Decisión pendiente" en el informe y seguí.

## Cómo sacar capturas en la sesión en la nube

La sesión corre en Linux. No es una plataforma soportada, pero sirve para **ver** la
interfaz (la salida a pantallas externas no se prueba acá).

```bash
# una sola vez
apt-get install -y xvfb xdotool imagemagick mesa-vulkan-drivers   # si faltan
cd src-tauri && cargo build && cd ..

# levantar (en segundo plano)
Xvfb :99 -screen 0 1920x1080x24 &
bun run dev &                                  # vite en :1420
DISPLAY=:99 src-tauri/target/debug/pulseflow > /tmp/pf.log 2>&1 &

# ajustar tamaño de la ventana principal y capturar
DISPLAY=:99 xdotool search --name '^PulseFlow$' windowsize 1280 800 windowmove 0 0
DISPLAY=:99 import -window root docs/capturas/f12/<nombre>.png

# clics: DISPLAY=:99 xdotool mousemove X Y click 1 ; teclas: xdotool key Escape
# cerrar: pkill -x pulseflow ; pkill -x Xvfb   (NO usar pkill -f: mata tu propia shell)
```

El aviso `update_live_menu not found` en el log es esperable en Linux (el menú nativo es
de macOS). Las capturas van a `docs/capturas/f12/` en PNG, recortadas a la ventana si
podés (`import -window root -crop 1280x800+0+0`). Mirá cada captura antes de dar la
tarea por terminada.

Tamaños a probar: **1280×800** (laptop chica, el caso difícil) y **1920×1080**.

---

## F12.0 — Preparación y capturas "antes"

```bash
git pull origin feature/tauri-rust-migration
bun install
bun run test:unit && bun run test:svelte; bun run build
```

Creá `docs/informes/f12.md` con el título `# Informe F12` y los resultados. Sacá las
capturas "antes" a 1280×800: `antes-show.png` (pantalla principal con un proyecto y un
show abiertos; si no hay datos, creá un show de prueba con 3 diapositivas),
`antes-pantallas.png` (clic derecho en el botón Audiencia → modal de pantallas),
`antes-looks.png` (modal de Looks: menú Ver → Looks en `MenuBar`, o
`activePopup.set("looks")`), `antes-settings.png`.

Commit (con F12.1): no hay commit propio.

---

## F12.1 — Modales de verdad (causa de "no entra todo")

**Problema:** `components/main/Popup.svelte` mete **todo** popup dentro de su tarjeta
vieja (`.popup` con `padding: 20px var(--navigation-width)`, `.card`, cabecera propia,
`.scroll` y `.body` con márgenes). `screen_config` y `looks` son modales completos con
su propia cabecera, así que quedan con doble cabecera, achicados (~525 px en vez de
960) y con el contenido desbordando.

Además hay **dos bases de modal**: `components/main/Modal.svelte` (la usa
`screens/ScreenConfig.svelte`) y `components/looks/Modal.svelte` (la usa
`looks/LooksWindow.svelte`).

**Archivos:** `components/main/Popup.svelte`, `components/main/Modal.svelte`,
`components/looks/Modal.svelte` (se borra), `components/looks/LooksWindow.svelte`.

1. En `Popup.svelte`, una lista `const FULL_MODALS = ["looks", "screen_config"]`. Si
   `popupId` está en esa lista, renderizar **sólo** `<svelte:component this={popups[popupId]} />`
   (sin `.popup`, `.card`, cabecera ni `.scroll`). El resto de los popups queda igual.
2. Unificar en `main/Modal.svelte` lo mejor de los dos:
   - props: `title`, `width` (960), `height` (620), `closable` (true),
     `lockOutsideClick` (true: clic en el fondo NO cierra);
   - tamaño `width: min({width}px, 100vw - 32px)`, `height: min({height}px, 100vh - 32px)`;
     en Windows restar `MENU_BAR_HEIGHT` (de `utils/common`) al alto disponible;
   - estructura: cabecera fija de 44 px (título 14 px semibold a la izquierda, ✕ a la
     derecha), cuerpo `flex: 1; min-height: 0; display: flex; overflow: hidden`
     (cada modal decide qué parte scrollea), slot opcional `footer` fijo de 52 px con
     borde superior;
   - fondo `rgb(0 0 0 / 0.6)`, tarjeta `--primary`, borde 1 px `--border-color`,
     radio `calc(var(--radius) * 1.5)`, sombra grande; transiciones `fade`/`scale` y
     `optimizedMode` como en el modal de looks;
   - Esc: cierra el modal y hace `stopPropagation` + `preventDefault` en captura, para
     que **no** llegue a `utils/shortcuts.ts` (que limpia la salida con Esc);
   - foco: al abrir, foco en la tarjeta (`tabindex="-1"`).
3. `LooksWindow.svelte` pasa a usar `../main/Modal.svelte` (720×480 según la
   especificación; si el contenido no entra, 760×520 como hoy). Borrar
   `looks/Modal.svelte` (`grep -rn "looks/Modal" src/` tiene que dar vacío).

*Aceptación (capturas `f12.1-pantallas-1280.png`, `f12.1-looks-1280.png` y las mismas a
1920):* el modal de pantallas mide 960×620 a 1920×1080 y ocupa la ventana menos 16 px
por lado a 1280×800; una sola cabecera; nada se sale de la tarjeta; Esc cierra el modal
y **no** limpia la salida (probarlo con algo en pantalla); clic afuera no cierra.

Commit: `F12.1: modales de pantalla completa fuera de la tarjeta de Popup; una sola base de modal`

---

## F12.2 — Kit base de componentes

Un solo juego de piezas para todo lo que se toque de acá en adelante. Se arma con lo
que **ya está instalado** (Tailwind v4 + shadcn-svelte en
`src/frontend/lib/components/ui/`: `button`, `input`, `label`, `select`, `separator`,
`skeleton`, `switch`, `tabs`, `scroll-area`). No agregar dependencias.

**Archivos nuevos** en `src/frontend/lib/components/ui/` (una carpeta por pieza, con
`index.ts` como las existentes) y `docs/design/kit.md`.

1. **Medidas** (anotarlas en `docs/design/kit.md` y respetarlas en todo F12):
   - alto de control: 28 px compacto (barras, listas), 32 px normal (formularios);
   - espaciado: 4 / 8 / 12 / 16 / 24 px; separación entre controles de un grupo 8 px;
   - texto: 13 px normal, 12 px secundario, 11 px títulos de sección;
   - radio: `var(--radius)` en controles, `calc(var(--radius) * 1.5)` en tarjetas/modales;
   - íconos: 16 px en controles, 14 px en listas.
2. Ajustar `button`: tamaños `sm` (28 px), `default` (32 px), `icon` (28×28) e
   `icon-sm` (24×24); variantes `default` (acento `--secondary`), `secondary`
   (`--primary-lighter`), `ghost`, `outline`, `destructive`, y una `live` (fondo rojo
   `--disconnected` cuando está activo) para Audiencia/Stage.
3. Piezas nuevas:
   - `section-header`: título de sección 11 px, mayúsculas, `letter-spacing: .06em`,
     `text-muted-foreground`, alto 28 px, padding horizontal 12 px; slot opcional a la
     derecha para acciones (ej. "+").
   - `list-row`: fila de 28 px, ícono 14 px + texto alineados **a la izquierda**, texto
     con `truncate`, estado `active` (fondo `--primary-lighter`, barra izquierda de 2 px
     `--secondary`), hover suave; slot a la derecha para un contador o acción.
   - `capsule`: grupo de botones de la barra superior: fondo `--primary-darker`, borde
     1 px `--border-color`, radio completo, alto 32 px, botones internos `ghost` de
     28 px con ícono + etiqueta 12 px.
   - `field`: fila etiqueta + control (etiqueta 12 px a la izquierda de ancho fijo
     configurable, control a la derecha que ocupa el resto); variante apilada.
   - `menu` (desplegable simple): lista flotante con `--primary-darker`, ítems de
     28 px, separador. Si `select` ya cubre el caso, reutilizarlo y documentarlo.
4. `docs/design/kit.md`: para cada pieza, qué es, props, un ejemplo de uso desde un
   componente legacy (`onclick={...}`) y una captura. Actualizar
   `src/frontend/lib/components/ui/README.md`: la regla pasa a ser "**toda interfaz
   nueva o rehecha usa el kit**; los componentes legacy se reemplazan pantalla por
   pantalla dentro de las tareas F12, nunca en masa".
5. Página de muestra para la verificación: en modo dev, un popup `kit_demo`
   (registrado en `utils/popup.ts`, abrible desde la consola con
   `activePopup.set("kit_demo")`) que muestre todas las piezas con todas sus
   variantes, en `components/main/popups/KitDemo.svelte`. Usa la base de F12.1.

*Aceptación:* captura `f12.2-kit.png` con todas las piezas; se ven bien en el tema
oscuro por defecto y en uno claro (cambiar tema en Settings → Theme y capturar
`f12.2-kit-claro.png`).

Commit: `F12.2: kit base de componentes (botón, cápsula, encabezado de sección, fila, campo, menú)`

---

## F12.3 — Modal de pantallas rehecho

**Archivos:** `components/screens/ScreenConfig.svelte`, `ScreenList.svelte`,
`ScreenDetail.svelte`, `SystemDisplays.svelte`, `DisplayLayout.svelte`,
`ScreenOutputOptions.svelte` (sólo maquetación; la lógica no se toca).

Layout (ver `docs/design/pantallas-y-looks.md`):

```
┌ Configuración de pantallas ─────────────────────────────── ✕ ┐
│ PANTALLAS        │ [Nombre de la pantalla      ] 1920×1080 ● │
│ ▸ Audiencia   ●  │ [General][Hardware][Envío][Stage]          │
│   Stage          │ ┌──────────────────────────────────────┐   │
│   NDI 1          │ │ contenido de la pestaña (scroll)     │   │
│ ──────────────── │ │                                      │   │
│ MONITORES        │ └──────────────────────────────────────┘   │
│ [dibujo]         │                                            │
│ + Agregar ▾      │                                            │
└──────────────────┴────────────────────────────────────────────┘
```

1. Columna izquierda de **240 px** fija, con scroll propio: `section-header`
   "Pantallas" + `list-row` por pantalla (punto verde si está en vivo), separador,
   `section-header` "Monitores" + `DisplayLayout`, y abajo el botón "Agregar" con su
   menú (pantalla / stage / NDI…, lo que ya existe).
2. `DisplayLayout` **escala al ancho de su contenedor**: usar un `ResizeObserver` (o
   `bind:clientWidth`) y calcular la escala con la función de `displayLayout.ts`
   (agregar un parámetro de ancho disponible si hace falta, con test en
   `displayLayout.test.ts`). Nunca puede salirse del panel.
3. Cabecera del detalle en **una sola línea**: input de nombre (`input` del kit, flex 1,
   `min-width: 0`), resolución con `white-space: nowrap` en texto secundario, estado.
   Nada se corta con "…" salvo el nombre largo.
4. Pestañas con `tabs` del kit; las etiquetas son cortas y traducidas
   (`screen_config.tab_*`). Si no entran, la tira de pestañas scrollea horizontal
   (sin cortar letras a la mitad).
5. Contenido de cada pestaña: `field` del kit en dos columnas cuando el ancho >= 640 px,
   una columna si no. Scroll vertical sólo en el área de contenido.
6. Reemplazar dentro de estos archivos los `MaterialButton`/`MaterialToggleSwitch`/
   `MaterialDropdown`/`MaterialNumberInput` por las piezas del kit **sólo cuando la pieza
   equivalente exista** y el reemplazo no cambie el comportamiento; si un control legacy
   no tiene equivalente (ej. selector de color), dejarlo.

*Aceptación (capturas por pestaña a 1280×800 y 1920×1080, `f12.3-*.png`):* nada se
sale ni se superpone; ningún texto cortado salvo nombres largos; los monitores entran;
siguen funcionando: elegir pantalla, renombrar, cambiar monitor destino, tipo, mirror,
stage layout, opciones de envío, agregar y borrar pantalla (listar cada una en el
commit).

Commit: `F12.3: modal de pantallas con el kit; monitores escalan al panel y nada se corta`

---

## F12.4 — Modal de Looks con el kit

**Archivos:** `components/looks/LooksWindow.svelte`, `LookGrid.svelte`,
`LookAdvanced.svelte`.

Mismo esquema que F12.3: lista de looks a la izquierda (240 px, `list-row`, look activo
marcado, "+ Nuevo look" abajo), a la derecha la grilla pantalla × capa del look elegido
con `field`/`select`/`switch` del kit, y pie del modal (slot `footer` de F12.1) con
"Aplicar" (botón `default`) y "Duplicar"/"Borrar" (`ghost`).

*Aceptación (capturas `f12.4-*.png` en los dos tamaños):* nada cortado ni encimado;
siguen funcionando crear, renombrar, duplicar, borrar, editar la grilla, aplicar, la
transición y las opciones avanzadas.

Commit: `F12.4: modal de Looks con el kit`

---

## F12.5 — Barra superior unificada

**Archivo:** `components/main/Top.svelte` (y `TopButton.svelte` sólo si hace falta).

Hoy: cápsulas con `.cap-btn` propios, un `MaterialDropdown` para el Look en otro
estilo, botones redondos aparte para Audiencia/Stage y `TopButton` con otro estilo más
para Dibujo/Configuración.

1. Todos los grupos usan `capsule` del kit, con el mismo alto (32 px) y los mismos
   botones internos. Orden (ver la especificación): **Buscar · Texto · Tema** |
   **Show · Edit · Biblia · ⋯** | espacio arrastrable | **Media · Look ▾ · Live** |
   **Audiencia · Stage** (variante `live`, roja cuando está activa; clic derecho sigue
   abriendo el modal de pantallas) | **Dibujo · Configuración · punto de sin guardar**.
2. **Look ▾** es un botón de la cápsula con el nombre del look activo
   (`truncate`, máx. 140 px). Abre el `menu` del kit con: la lista de looks (check en
   el activo; clic = `applyLook`), separador, **"Editar looks…"**
   (`activePopup.set("looks")`). Si no hay looks, el menú muestra sólo "Editar looks…".
3. El menú "⋯" usa también el `menu` del kit (hoy es `.more-menu` propio); cerrar al
   hacer clic afuera y con Esc.
4. El botón suelto que se ve arriba a la izquierda en `antes-show.png`: identificarlo
   (candidatos: el bloque `.users` de usuarios conectados o el `<span>` del ancho de
   navegación). Si tiene función, darle el mismo estilo y ubicarlo en la última
   cápsula; si es un resto sin función (demostrarlo con `grep`), quitarlo.
5. `TopButton` activo: el resaltado tiene que corresponder a la página actual
   (`activePage`); en Configuración no debe quedar "Show" marcado.
6. Todo `data-tauri-drag-region` que existe hoy se mantiene (la ventana se tiene que
   poder arrastrar desde los espacios vacíos de la barra).

*Aceptación (capturas `f12.5-top-1280.png`, `f12.5-top-1920.png`, `f12.5-look-menu.png`):*
una sola apariencia en toda la barra; a 1280 px no se superpone nada (si no entra, las
etiquetas de la cápsula izquierda se ocultan y quedan sólo íconos con tooltip);
"Editar looks…" abre el modal; siguen funcionando todos los botones (listarlos).

Commit: `F12.5: barra superior con el kit; menú de Look con "Editar looks…"`

---

## F12.6 — Columna izquierda

**Archivos:** `src/frontend/MainLayout.svelte` (columna izquierda),
`components/show/Projects.svelte`, `components/show/ProjectContentList.svelte` (sólo
cabecera/estilo).

1. Títulos `BIBLIOTECA`, `PLAYLIST`, `N ÍTEMS`, `MEDIA` (hoy en español fijo) pasan a
   `section-header` con claves nuevas `ui.library`, `ui.playlist`, `ui.items`
   (con `{count}`), `ui.media` en `en.json` y `es.json`.
2. Categorías de la biblioteca: `cat.name` puede ser una clave de traducción
   (`category.presentation`, `category.song`): mostrar
   `cat.name?.includes(".") ? translateText(cat.name) : cat.name || id` (mismo criterio
   que `drawer/audio/Audio.svelte`). Filas con `list-row`, alineadas a la izquierda.
3. Quitar el encabezado duplicado: `Projects.svelte` dibuja su propio título
   ("Projects") además del `PLAYLIST` de `MainLayout`. Queda uno solo (`ui.playlist`),
   con las acciones de Projects (nuevo proyecto/carpeta) en el slot derecho del
   `section-header`.
4. La fila "Media" usa `list-row` con texto traducido.

*Aceptación (captura `f12.6-izquierda.png`):* ningún texto con forma de clave
(`algo.algo`), todo alineado a la izquierda, un solo título por sección; siguen
funcionando abrir categoría, crear/abrir/renombrar proyecto, carpetas, arrastrar ítems,
menú contextual y abrir Media.

Commit: `F12.6: columna izquierda con encabezados y filas del kit, traducida`

---

## F12.7 — Panel derecho: tira vertical de limpiar

**Archivos:** `components/output/preview/Preview.svelte`, `ClearButtons.svelte`,
`MultiOutputs.svelte`.

F11.6b quedó marcada pero los puntos 1 y 2 no se ven aplicados en la app. Hacerlos:

1. `ClearButtons` como **tira vertical de 32 px** a la derecha de la vista previa: un
   botón `icon` por capa (fondo, diapositiva, overlays, audio, timer…, las que ya
   existen), resaltado con `--secondary` si la capa tiene contenido, tooltip con el
   nombre y atajo.
2. **"Limpiar todo"**: botón circular ⓧ de 28 px superpuesto en la esquina superior
   derecha de la vista previa, visible sólo si hay algo en pantalla.
3. Debajo de la vista previa, en **una línea**: selector de pantalla de `MultiOutputs`
   ("Pantalla 1 ▾" con `select`/`menu` del kit).

*Aceptación (captura `f12.7-derecha.png` con algo en pantalla y otra vacía):* la tira
y la ⓧ no tapan la vista previa; cada botón limpia su capa; Esc sigue limpiando todo.

Commit: `F12.7: panel derecho con tira vertical de limpiar y ⓧ de limpiar todo`

---

## F12.8 — Textos fijos y la pestaña marcada en Configuración

**Archivos:** los que aparezcan en la búsqueda (sólo para cambiar el texto por
`translateText(...)`/`<T>` y agregar la clave).

1. Buscar textos fijos visibles:
   ```bash
   grep -rnE '>[^<{]*[áéíóúñÁÉÍÓÚÑ¿¡][^<{]*<|"[A-ZÁÉÍÓÚ][a-záéíóúñ]+ [a-záéíóúñ]+…?"' src/frontend --include=*.svelte
   grep -rn 'translate: false' src/frontend/components/main/MenuBar.svelte
   ```
   Casos ya conocidos: `settings/Settings.svelte` ("Configurar pantallas…", y el título
   "CONFIGURACIÓN" si está fijo), `main/MenuBar.svelte` (`screens_config` con
   `translate: false`), los títulos de F12.6.
2. Cada texto pasa a una clave en la sección que corresponda (`screens`, `looks`,
   `menu`, `ui`) en `en.json` **y** `es.json`. No reordenar ni reformatear los JSON.
3. En `Settings.svelte`, el botón "Configurar pantallas…" usa `button` del kit.

*Aceptación:* con el idioma en inglés no queda ningún texto en español en Show,
Settings, la barra superior, el menú ni los modales (capturas `f12.8-en.png`,
`f12.8-es.png`); y al revés.

Commit: `F12.8: textos fijos a traducciones`

---

## F12.9 — Pantalla de inicio y título

**Archivos:** los que dibujan el título grande "PulseFlow" en azul que aparece al abrir
la app (candidatos: `components/main/Splash.svelte`,
`components/main/ProfileSelector.svelte`; confirmarlo con una captura).

Reemplazar el título de texto azul por el logo (`public/icon.png` o
`docs/brand/logo-pulseflow.png` copiado a `public/`) de 48 px + "PulseFlow" en
`--text` 18 px semibold, centrado, con los accesos que ya tenga esa pantalla usando
`button` del kit.

*Aceptación:* captura `f12.9-inicio.png`; los accesos siguen funcionando.

Commit: `F12.9: pantalla de inicio con el logo y el kit`

---

## F12.10 — Repaso final con capturas

Recorrer, a 1280×800 y 1920×1080: Show (con y sin proyecto), Edit, Stage, Draw,
Settings (cada pestaña), cajón inferior (cada pestaña), modal de pantallas (cada
pestaña), modal de Looks, menú contextual de una diapositiva, menú de Look, menú ⋯ y
los popups más usados (nuevo show, importar).

Para cada pantalla anotar en `docs/VERIFICAR-F12.md` una línea con el nombre de la
captura y uno de: **ok**, **arreglado en este commit** (qué), o **pendiente** (qué y por
qué no se arregló). Se arreglan acá sólo cosas chicas: textos cortados, desbordes,
alineaciones, un color hardcodeado. Lo grande queda como pendiente.

Esta tarea reemplaza a **F11.9**: marcar las dos.

Commit: `F12.10: repaso visual completo con capturas`

---

## F12.11 — Marcar el roadmap e informe

Marcar en `docs/ROADMAP.md` los checkboxes de F12 que quedaron hechos (con fecha y una
línea de qué se hizo) y completar `docs/informes/f12.md`: una línea por tarea
(hecha / salteada y por qué), decisiones pendientes y qué tiene que probar el usuario
en su Mac (al menos: modales a pantalla chica, Esc en modales con la audiencia
encendida, arrastrar la ventana desde la barra). Al final una línea que diga
exactamente `TERMINADO`.

Commit: `docs: informe F12`

---

## Qué NO está en este plan

- Migrar a Tailwind/kit **todo** el frontend: sólo las pantallas de F12. El resto se
  hace después, una pantalla por tarea.
- Cambiar lógica (salidas, looks, proyectos): F12 es maquetación y estilo.
- Quitar el puente de estilos (F10.9): es otra tarea.

## Cómo lanzarlo

En una sesión de Claude Code en la nube sobre este repositorio y la rama
`feature/tauri-rust-migration`, con este mensaje:

```
Leé AGENTS.md y docs/PLAN-F12.md completos. Ejecutá las tareas F12.0 a F12.11 en
orden, una por vez, siguiendo las reglas del plan: chequeos antes de cada commit,
capturas de la app según "Cómo sacar capturas" (miralas antes de dar una tarea por
terminada), commit con el mensaje indicado y push a feature/tauri-rust-migration
después de cada tarea. Ninguna función se puede perder. Si una tarea no se puede hacer
como está escrita, deshacé sólo esa tarea, anotalo en docs/informes/f12.md y seguí.
Al terminar, completá el informe.
```
