# Kit base de componentes (F12.2)

Un solo juego de piezas para toda interfaz nueva o rehecha. Están en
`src/frontend/lib/components/ui/` (una carpeta por pieza, con `index.ts`) y se
apoyan en los tokens del tema (`--primary`, `--secondary`, `--text`, …) a través de
`src/frontend/app.css`. Sin hex sueltos.

Página de muestra: en dev, `activePopup.set("kit_demo")` desde la consola
(`components/main/popups/KitDemo.svelte`). Muestra todas las piezas y variantes.

## Especificación visual (F14.1)

**Es la especificación de destino.** Los tokens se aplican en F14.2; hasta entonces,
las secciones de cada pieza (más abajo) describen la implementación actual.

Diseño utilitario y elegante, inspirado en las herramientas para desarrolladores. La
tipografía es clara, se usa una escala de grises con contrastes definidos y los
espacios se delimitan con bordes finos, no con fondos. Sólo hay **tema oscuro** y es
**monocromo**: el contenido y la funcionalidad son lo único que se destaca.

### Reglas

1. **La acción principal es clara sobre oscuro** (`--action` / `--action-text`). No hay
   color de marca ni de acento.
2. **El color es sólo semántico:** `--danger` (EN VIVO, destructivo, error),
   `--success` (conectado), `--warning` (aviso). Nada más tiene color. Las excepciones
   son contenido del usuario: colores de grupos, de slides y de etiquetas, y las vistas
   previas.
3. **Un solo fondo de aplicación** (`--bg`). Las zonas se separan con bordes de 1 px
   (`--border`). Paneles, barras, columnas y filas no llevan un fondo propio.
4. **Hay superficie elevada sólo en flotantes**: menús, popovers, tooltips y modales usan
   `--bg-elevated` + `--border` + `--shadow-float`. Es el único caso con sombra.
5. **Sin degradés, sin botones flotantes (FAB), sin cápsulas de radio completo, sin
   labels flotantes estilo Material.**
6. **Íconos en `--text-muted`.** El ícono activo, seleccionado o con hover pasa a
   `--text`. Un ícono nunca tiene color, salvo los semánticos de la regla 2.
7. **Números en mono:** timers, timecodes, relojes, contadores, coordenadas y los inputs
   numéricos usan `--font-mono` con `font-variant-numeric: tabular-nums`.
8. **Sin hex sueltos en componentes:** todo sale de los tokens de esta sección.

### Escala de grises

Neutra, sin tinte. Sirve de referencia para derivar los tokens; los componentes usan
los tokens semánticos, nunca `--gray-*` directo.

| Token | Hex | Token | Hex |
| --- | --- | --- | --- |
| `--gray-50` | `#fafafa` | `--gray-600` | `#5c5c5c` |
| `--gray-100` | `#ededed` | `--gray-700` | `#3d3d3d` |
| `--gray-200` | `#d4d4d4` | `--gray-800` | `#262626` |
| `--gray-300` | `#a1a1a1` | `--gray-850` | `#1f1f1f` |
| `--gray-400` | `#8f8f8f` | `--gray-900` | `#141414` |
| `--gray-500` | `#737373` | `--gray-950` | `#0a0a0a` |

### Tokens semánticos

Los contrastes se calcularon con la fórmula WCAG 2.x contra `--bg` y `--bg-elevated`.

| Token | Valor | Uso | Contraste (bg / elevado) |
| --- | --- | --- | --- |
| `--bg` | `#0a0a0a` (950) | Fondo único de la app | — |
| `--bg-elevated` | `#141414` (900) | Menús, popovers, modales | — |
| `--bg-hover` | `rgb(255 255 255 / 0.05)` | Hover de filas y botones fantasma | — |
| `--bg-active` | `rgb(255 255 255 / 0.08)` | Presionado; pestaña o botón activo | — |
| `--bg-selected` | `rgb(255 255 255 / 0.10)` | Fila o ítem seleccionado; selección de texto | — |
| `--border` | `rgb(255 255 255 / 0.08)` | Separadores, bordes de panel y de control | — |
| `--border-strong` | `rgb(255 255 255 / 0.16)` | Hover de controles con borde; bordes de flotantes | — |
| `--text` | `#ededed` (100) | Texto principal, íconos activos | 16.9 / 15.7 |
| `--text-muted` | `#a1a1a1` (300) | Texto secundario, íconos en reposo, labels | 7.7 / 7.1 |
| `--text-subtle` | `#8f8f8f` (400) | Placeholders, metadatos, títulos de sección | 6.1 / 5.7 |
| `--text-disabled` | `#5c5c5c` (600) | Deshabilitado (no necesita AA) | 3.0 / 2.8 |
| `--action` | `#ededed` (100) | Fondo del botón principal | — |
| `--action-hover` | `#ffffff` | Hover del botón principal | — |
| `--action-text` | `#0a0a0a` (950) | Texto sobre `--action` | 16.9 |
| `--danger` | `#e5484d` | EN VIVO, destructivo, error | 5.1 / 4.7 |
| `--success` | `#46a758` | Conectado, OK | 6.5 / 6.1 |
| `--warning` | `#ffb224` | Aviso | 11.0 / 10.2 |
| `--ring` | `rgb(255 255 255 / 0.40)` | Contorno de foco | — |
| `--shadow-float` | `0 8px 24px rgb(0 0 0 / 0.5)` | Sólo flotantes | — |
| `--backdrop` | `rgb(0 0 0 / 0.6)` | Fondo detrás de un modal | — |

El texto blanco sobre `--danger` da 3.9:1 y no pasa AA. Por eso el estado EN VIVO
**no** es un botón rojo relleno, sino texto `--danger` + borde
`rgb(229 72 77 / 0.5)` + un punto de 6 px `--danger` sobre `--bg`. Un botón
destructivo usa la misma forma, sin el punto.

### Correspondencia con los tokens actuales (para F14.2)

El frontend heredado usa los nombres de FreeShow. En F14.2 se les asigna el valor
nuevo, para no tocar los ~900 usos; los nombres nuevos se agregan al lado.

| Token actual | Pasa a | Nota |
| --- | --- | --- |
| `--primary` | `--bg` | |
| `--primary-darker` | `#0f0f0f` en F14.2, `--bg` en F14.4 | Hoy delimita columnas con fondo; se iguala cuando ya haya bordes |
| `--primary-darkest` | `#0d0d0d` en F14.2, `--bg` en F14.4 | Ídem (inputs, pozos) |
| `--primary-lighter` | `--gray-850` | Superficies sólidas de hover/activo heredadas |
| `--secondary` | `--action` | El "acento" azul pasa a la acción clara |
| `--secondary-text` | `--action-text` | |
| `--secondary-opacity` | `--bg-selected` | |
| `--accent` | `--text-muted` | Era índigo `#818cf8` |
| `--text` | `--text` (`#ededed`) | Antes `#fafafa` |
| `--textInvert` | `--action-text` | |
| `--hover` / `--focus` | `--bg-hover` / `--bg-active` | |
| `--border-color` | `--border` | |
| `--connected` / `--disconnected` | `--success` / `--danger` | |
| `--radius` | `6px` | Antes `0.625rem` |
| `--shui-popover`, `--shui-card` | `--bg-elevated` | Los flotantes del kit |
| `--shui-ring` | `--ring` | |

Revisar en F14.2 los usos de `--secondary` como **color de texto o de ícono** (no de
fondo): con la acción clara quedan en `--text`, que es lo que pide la regla 6. Si alguno
lo usaba como fondo de algo que no es la acción principal (por ejemplo una barra de
progreso), pasa a `--text-muted`.

### Tipografía

Familias: `--font-family` Geist Variable y `--font-mono` Geist Mono Variable
(`@fontsource-variable/geist-mono`, cargada en `main.ts`). Tamaño base de la app: 13 px. Pesos: 400 normal, 500 énfasis y
controles, 600 títulos. Nunca 700 o más.

| Token | Tamaño / interlineado | Uso |
| --- | --- | --- |
| `--text-2xs` | 11 / 16 px | Títulos de sección (mayúsculas, `letter-spacing: 0.04em`, `--text-subtle`), badges, atajos |
| `--text-xs` | 12 / 16 px | Texto secundario, metadatos, ayudas bajo un campo |
| `--text-sm` | 13 / 20 px | **Base**: listas, controles, formularios, menús |
| `--text-md` | 15 / 22 px | Títulos de panel y de modal |
| `--text-lg` | 20 / 28 px | Títulos de página (Configuración → pestaña), pantalla de inicio |

Fuera de la interfaz (relojes grandes del cajón, contadores para escenario) se permite
un tamaño mayor, siempre en mono, `--text`, peso 400.

### Espaciado y medidas

| Qué | Valor |
| --- | --- |
| Escala de espaciado | 4 / 8 / 12 / 16 / 24 / 32 px |
| Separación entre controles de un grupo | 8 px |
| Relleno de panel | 12 px (16 px en modales) |
| Alto de control | 24 px mini · 28 px compacto (barras, listas) · 32 px normal (formularios) |
| Alto de fila de lista | 28 px |
| Alto de encabezado de sección | 28 px |
| Alto de barra superior | 40 px |
| Radio | 4 px (badges, `kbd`, chips: `--radius-chip`) · 6 px (controles: `--radius`) · 8 px (modales y popovers: `--radius-modal`) |
| Borde | 1 px siempre. 2 px sólo en la barra de selección de `list-row` y en el indicador de pestaña activa |
| Íconos | 16 px en controles, 14 px en listas y controles mini. Piezas nuevas del kit: Lucide (`@lucide/svelte`), trazo 1.5. El set heredado (`components/helpers/Icon.svelte`, rellenos, usado en 188 archivos) se mantiene: unificarlo no es parte de F14 |

### Estados

| Estado | Botón fantasma / fila | Control con borde | Botón principal |
| --- | --- | --- | --- |
| Reposo | Sin fondo, texto `--text-muted` | Borde `--border`, sin fondo | `--action` / `--action-text` |
| Hover | `--bg-hover`, texto `--text` | Borde `--border-strong` | `--action-hover` |
| Presionado / activo | `--bg-active`, texto `--text` | Borde `--border-strong` + `--bg-active` | `--action-hover` |
| Seleccionado | `--bg-selected` + barra 2 px `--text` a la izquierda (filas) | — | — |
| Foco (`:focus-visible`) | `outline: 1px solid var(--ring); outline-offset: 1px` | Ídem | Ídem |
| Deshabilitado | Texto `--text-disabled`, sin hover, `cursor: default` | Ídem | `opacity: 0.4` |

Las pestañas activas llevan texto `--text` + indicador de 2 px `--text` abajo; las
inactivas, `--text-muted` sin indicador. Los toggles (switch) prendidos van en
`--action` con el círculo en `--action-text`, y apagados en borde `--border-strong` con
el círculo en `--text-muted`.

### Movimiento

Sólo transiciones de color, fondo y borde: 120 ms `ease-out`. Los flotantes aparecen
con opacidad en 100 ms, sin escala ni rebote. Nada se mueve en la salida al vivo por
culpa de la interfaz.

### Prohibido (checklist de revisión)

- Hex, `rgb()` o `hsl()` en un componente (salvo contenido del usuario, con comentario).
- `linear-gradient` / `radial-gradient` en la interfaz.
- `box-shadow` fuera de flotantes.
- `border-radius: 999px` / `50%` en botones (sí en avatares y puntos de estado).
- Un fondo distinto de `--bg` para separar paneles, columnas o filas.
- Íconos de color, o texto en `--action` sobre `--bg` como si fuera un link.
- Tamaños de texto fuera de la escala, o `em`/`rem` sueltos en componentes nuevos.

## Uso desde componentes legacy

Los componentes legacy (`Button.svelte`, `MaterialButton`, …) usan `on:click` y no
pasan a runes. Las piezas del kit son runes y reciben el evento como prop
`onclick={...}`. Desde un padre legacy:

```svelte
<script lang="ts">
    import Button from "../../lib/components/ui/button/button.svelte"
    let open = false
</script>

<Button variant="outline" size="sm" onclick={() => (open = !open)}>Abrir</Button>
```

## `button`

Variantes: `default` (acento `--secondary`), `secondary` (`--primary-lighter`),
`ghost`, `outline`, `destructive`, `live` (rojo `--disconnected` mientras
`aria-pressed="true"`: Audiencia y Stage).

Tamaños: `sm` (28 px), `default` (32 px), `icon` (28×28), `icon-sm` (24×24).

```svelte
<Button variant="live" aria-pressed={audienceOn} onclick={toggleAudience}>Audiencia</Button>
```

## `section-header`

Título de sección: 11 px, mayúsculas, alto 28 px, `text-muted-foreground`. Slot
`actions` a la derecha (ej. "+").

```svelte
<SectionHeader>
    Pantallas
    {#snippet actions()}
        <Button variant="ghost" size="icon-sm" title="Agregar" onclick={addScreen}>+</Button>
    {/snippet}
</SectionHeader>
```

## `list-row`

Fila de 28 px, ícono (14 px) y texto a la izquierda, texto con `truncate`. `active`
pinta el fondo `--primary-lighter` y una barra de 2 px `--secondary` a la izquierda.
Slot `trailing` a la derecha (contador, acción).

```svelte
<ListRow active onclick={() => select(id)}>
    {name}
    {#snippet trailing()}{count}{/snippet}
</ListRow>
```

## `capsule`

Grupo de botones de la barra superior: alto 32 px, borde 1 px, radio completo,
fondo `--primary-darker`. Dentro, botones `ghost` de `sm` o `icon-sm`.

```svelte
<Capsule>
    <Button variant="ghost" size="sm" onclick={openSearch}>Buscar</Button>
    <Button variant="ghost" size="sm" onclick={openText}>Texto</Button>
</Capsule>
```

## `field`

Etiqueta + control. Por defecto la etiqueta va a la izquierda con ancho fijo
(`labelWidth`, 140 px) y el control ocupa el resto. `stacked` la pone arriba.

```svelte
<Field label="Nombre">
    <input class="input" bind:value={name} />
</Field>
```

## `menu`

Desplegable simple: `Menu` (contenedor), `MenuItem` (28 px, `checked` muestra una
marca), `MenuSeparator`. El contenedor del disparador lleva `position: relative` y el
menú se abre debajo. Se cierra con clic afuera o Esc (en captura, para que Esc no
llegue a `utils/shortcuts.ts`).

```svelte
<div class="anchor">
    <Button variant="outline" size="sm" onclick={() => (open = !open)}>Look ▾</Button>
    <Menu {open} onclose={() => (open = false)}>
        {#each looks as look}
            <MenuItem checked={look.id === activeId} onclick={() => applyLook(look.id)}>{look.name}</MenuItem>
        {/each}
        <MenuSeparator />
        <MenuItem onclick={openLooks}>Editar looks…</MenuItem>
    </Menu>
</div>
```

`select` ya existía (`ui/select/`) y cubre los desplegables con valor; `menu` es para
acciones y listas de elegir (look activo, "Editar looks…").

## Capturas

Ver `docs/capturas/f12/` (`f12.2-kit.png`, anterior a F14). Desde F12.12 el tema es
fijo y desde F14 sólo hay tema oscuro: las capturas antes/después del lavado de cara van
en `docs/capturas/f14/`.
