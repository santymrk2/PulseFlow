# Kit base de componentes (F12.2)

Un solo juego de piezas para toda interfaz nueva o rehecha. Están en
`src/frontend/lib/components/ui/` (una carpeta por pieza, con `index.ts`) y se
apoyan en los tokens del tema (`--primary`, `--secondary`, `--text`, …) a través de
`src/frontend/app.css`. Sin hex sueltos.

Página de muestra: en dev, `activePopup.set("kit_demo")` desde la consola
(`components/main/popups/KitDemo.svelte`). Muestra todas las piezas y variantes.

## Medidas

| Qué | Valor |
| --- | --- |
| Alto de control compacto (barras, listas) | 28 px |
| Alto de control normal (formularios) | 32 px |
| Espaciado | 4 / 8 / 12 / 16 / 24 px |
| Separación entre controles de un grupo | 8 px |
| Texto | 13 px normal, 12 px secundario, 11 px títulos de sección |
| Radio | `var(--radius)` en controles; `calc(var(--radius) * 1.5)` en tarjetas y modales |
| Íconos | 16 px en controles, 14 px en listas |

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

Ver `docs/capturas/f12/` (`f12.2-kit.png` tema oscuro, `f12.2-kit-claro.png` tema claro).
