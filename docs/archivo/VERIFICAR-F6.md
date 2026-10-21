# Verificación UI - Fase 6 (Diseño)

Este archivo registra pasos de verificación que requieren ver la interfaz.
No marcar checkboxes del ROADMAP. Solo anotar pasos exactos y resultados.

---

## F6.2 — Tema por defecto "PulseFlow"

Qué cambió (verificado con tests, sin GUI): el tema `default` de
`defaultThemes.ts` ahora tiene los valores del tema `.dark` de la referencia
(`docs/design-reference/index.css`) mapeados por valor según la tabla de F6.1
(`#0a0a0a` fondo, `#171717` superficies, `#262626` acentos, `#fafafa` texto,
`#1447e6` acento, `0.625rem` radio) y fuente **Geist Variable**
(`@fontsource-variable/geist`, importada en `main.ts`). `public/global.css`
tiene los mismos defaults. Las instalaciones existentes migran solas
(`updateSettings.ts`: si el tema guardado `default` todavía tiene el primario
heredado `#18181b`, se reemplaza por el nuevo — mismo patrón que la migración
pre-1.4.9). La pestaña de temas se llama ahora "PulseFlow"
(clave `themes.PulseFlow` agregada a los 31 archivos de `public/lang/`).

### Pasos (macOS, con la app corriendo)

1. Levantar la app en un puerto libre (el 5173 puede estar en uso por otro
   agente): `bun run dev -- --port 5174` en una terminal, y en otra
   `bun run tauri dev` sólo si se quiere probar el binario nativo; con el
   dev server alcanza (abrir `http://localhost:5174` en el webview de Tauri o
   en el navegador pierde los comandos de salida, pero el tema se ve igual).
   - "Antes" (opcional, para el lado izquierdo de la comparación): levantar el
     commit base en un worktree aparte, sin tocar esta carpeta:
     `git worktree add /tmp/pulseflow-antes e387f24f` y correr ahí
     `bun install && bun run dev -- --port 5175`.
2. **Show:** abrir un proyecto con una canción, seleccionar una slide (que
   quede en vivo en el preview). Capturar la ventana completa →
   `docs/design-reference/screenshots/f6-2-show-despues.png`.
3. **Edit:** pestaña "Edit" (una slide seleccionada). Capturar →
   `f6-2-edit-despues.png`.
4. **Settings:** pestaña "Settings" (cualquier subpestaña, ideal "General").
   Capturar → `f6-2-settings-despues.png`. Abrir además
   Settings → **Theme** y capturar la fila de pestañas de temas
   (debe verse "PulseFlow" en la última pestaña) → `f6-2-theme-tab.png`.
5. **Stage:** pestaña "Stage" con un layout de stage seleccionado. Capturar →
   `f6-2-stage-despues.png`.
6. Si se siguió el paso 1 alternativo, repetir 2–5 en el worktree "antes" con
   nombres `f6-2-show-antes.png`, `f6-2-edit-antes.png`,
   `f6-2-settings-antes.png`, `f6-2-stage-antes.png`.

### Qué mirar en las capturas

- Fondo de paneles casi negro (`#0a0a0a`), paneles/secundarios `#171717`,
  hover/acentos `#262626`, texto `#fafafa`.
- El acento (botones activos, títulos `h1..h6`, foco) es azul índigo `#1447e6`
  (antes era `#6366f1` / violeta `#8b5cf6`).
- La tipografía de toda la UI es **Geist** (no system-ui): se distingue por la
  "g" y las terminaciones de las letras; verificar también que no haya un
  flash largo de fallback (la fuente se sirve empaquetada, sin CDN).
- Ningún texto queda ilegible (contraste de `#fafafa` sobre `#0a0a0a`).
- Cambiar de tema en Settings → Theme ("Dark", "Light") y volver a
  "PulseFlow": la UI debe restaurar los valores anteriores (la migración no
  rompe el cambio manual de tema).

### Resultado

(acompletar al ejecutar los pasos; adjuntar las capturas en
`docs/design-reference/screenshots/`)

---

## F6.3 — Radios, bordes y espaciados globales

Qué cambió (verificado con tests, sin GUI): los componentes base usan ahora las
variables globales en lugar de valores hardcodeados, con la misma convención de
F6.1 (`var(--radius, <valor anterior>)`, `var(--border-color, var(--primary-lighter))`),
de modo que el valor por defecto es **idéntico al anterior** y el radio/borde se
puede ajustar en un solo lugar:

- Radios de superficie → `var(--radius, …)` en: todos los inputs `Material*`
  (carpetas, número, archivo, checkbox, color, multi-choice, radio, tiempo,
  texto, textarea, dropdown, popup-button, toggle-switch), `NumberInput`,
  `Slider`, `Dropdown`, y en los contenedores base `Popup.svelte` (tarjeta y
  botones de cierre), `Preview.svelte` (sección de preview) y el campo de
  búsqueda del `Drawer`. Los radios internos/small shapes (2–3 px, pildas de
  20/22 px, círculos 50%, esquinas `0`) quedaron intactos a propósito.
  `4px 4px 0 0` se tradujo a las propiedades lógicas
  `border-start-start-radius` / `border-start-end-radius`.
- Bordes estáticos → `var(--border-color, var(--primary-lighter))` en los
  mismos componentes base (listas desplegables, checkbox, paletas de color,
  tooltips, tarjeta del popup, header del popup, separador `.border` del Drawer,
  sección del preview, subrayado de `CombinedInput`). Los bordes de
  **estado/selección** (`!important`, `var(--secondary)`, `--color`) no se
  tocaron: son feedback, no separadores.

### Pasos (verificación visual)

1. Con la app corriendo (ver F6.2, paso 1), abrir cualquier pantalla con varios
   inputs Material (Settings → Outputs, por ejemplo).
2. Comprobar que inputs, dropdowns abiertos, checkboxes y popups (abrir
   Settings → Themes → editar, o un popup de "Add" cualquiera) conservan la
   forma redondeada previa y que los bordes de separación siguen visibles.
3. **Control global:** en `public/global.css` cambiar temporalmente
   `--radius: 0.625rem` por `--radius: 0rem` (y volver): todo lo anterior debe
   redondearse/aplanarse de una sola vez; idem con `--border-color` (p. ej.
   `rgba(255, 255, 255, 0.4)`) para ver los bordes destacarse.
4. Anotar el resultado abajo.

### Resultado

(acompletar al ejecutar los pasos)

---

## F6.4 — Layout de paneles

Qué cambió (verificado con tests, sin GUI), comparando la referencia
(`Topbar.tsx`, `LibraryPanel.tsx`, `RightPanel.tsx`, `Drawer.tsx`) con
`MainLayout.svelte` y `components/main/Top.svelte`:

- **Topbar:** altura 40px → **48px** (referencia `h-12`); el `box-shadow`
  inferior se reemplazó por un separador real
  `border-bottom: 1px solid var(--border-color, …)` (referencia `border-b`).
  La altura vieja estaba duplicada en dos lugares que también se actualizaron:
  `Drawer.svelte` (`topHeight`, para el alto máximo del drawer) y
  `Resizeable.svelte` (altura disponible del panel central).
- **Separadores del panel derecho:** los `.border` pasan de 2px a **1px** con
  inset de 12px (referencia `Divider: h-px mx-3 bg-border`); en modo fila
  (panel derecho ancho) el inset es vertical.
- **Drawer:** el asa de redimensionar superior (`.top::after`) usa ahora
  `var(--border-color, …)` en vez de `--primary-lighter` (referencia
  `bg-border`).
- Sin mover funcionalidad: no se tocó markup ni lógica, sólo estilos.

### Pasos (verificación visual)

1. Con la app corriendo (F6.2, paso 1), abrir la app en una ventana normal.
2. **Topbar:** debe verse 8px más alta, con una línea fina inferior (sin
   sombra difusa). Comprobar que los botones de página (Show/Edit/Stage) y el
   de output siguen centrados y clicables, y que el indicador rojo de "unsaved"
   (si no guardó) cubre toda la altura.
3. **Panel derecho:** con una slide seleccionada, los separadores entre
   "preview" y las secciones de herramientas deben ser finos (1px) y con
   margen lateral; si el panel derecho es ancho (modo fila), el separador
   vertical también.
4. **Drawer:** arrastrar el borde superior del drawer para redimensionarlo al
   máximo: no debe quedar tapada la topbar (48px). El asa superior debe verse
   como una línea fina de color borde.
5. **Márgenes:** en Settings (una pestaña con scroll), el panel central debe
   ocupar exactamente el alto restante (no debe aparecer scroll vertical de la
   ventana por el cambio de altura de la topbar).
6. Anotar el resultado abajo.

### Resultado

(acompletar al ejecutar los pasos)

---

## F6.5 — Componentes shadcn-svelte

Qué cambió (verificado con tests, sin GUI): se generaron con el CLI de
shadcn-svelte y se instalaron en `src/frontend/lib/components/ui/` los
componentes `input`, `label`, `select`, `separator`, `skeleton`, `switch`,
`tabs` y `scroll-area` (además del `button` preexistente), con el alias `$lib`
→ `src/frontend/lib`. Detalles:

- `src/frontend/lib/utils.ts` ahora exporta también los tipos auxiliares que el
  CLI espera (`WithElementRef`, `WithoutChild`, …).
- Los tokens `--shui-*` de `src/frontend/app.css` se ataron a las variables del
  tema de FreeShow (`--primary`, `--text`, `--secondary`, `--border-color`,
  `--radius`, `--disconnected`…): los componentes siguen el tema activo sin
  bloque `.dark` y sin duplicar la paleta.
- `button.svelte` quedó tipado con `WithElementRef<HTMLButtonAttributes, …>`,
  lo que **corrige un error preexistente** de svelte-check (59 → 58 errores).
- Regla de uso documentada en `src/frontend/lib/components/ui/README.md`:
  **sólo pantallas nuevas** (p. ej. Looks, F5.3); no reemplazar componentes
  existentes en masa.
- Actualizada la sección "Idea a futuro" de `docs/design-reference/README.md`.

### Pasos (verificación visual)

Hoy ningún componente nuevo está renderizado en una pantalla (son opt-in para
pantallas nuevas), así que la verificación se reduce a comprobar que **no hay
regresión** y a dejar constancia:

1. Con la app corriendo (F6.2, paso 1), recorrer Show / Edit / Settings / Stage:
   no debe cambiar absolutamente nada respecto de F6.4 (mismos colores,
   bordes, radios; en particular, ningún fondo blanco o texto negro de
   shadcn clásico aparece en ninguna parte).
2. Verificar que el tema "PulseFlow" sigue aplicado (misma comprobación que el
   paso 5 de F6.2).
3. Cuando F5.3 (Looks) use estos componentes, verificar ahí su apariencia
   (botones, inputs, tabs, switch) contra `docs/design-reference/`.
4. Anotar el resultado abajo.

### Resultado

(acompletar al ejecutar los pasos)
