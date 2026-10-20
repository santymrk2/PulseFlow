# Librería de componentes (`lib/components/ui/`)

**Es la única librería de UI de la app** (F14.8). Antes convivían tres: los `Material*`
(`components/inputs/`), el kit shadcn y los `Button`/`TextInput`/… legacy. Se unificaron.
Las medidas, la convención de nombres y el contrato de eventos están en
[`docs/design/kit.md`](../../../../../docs/design/kit.md).

## Reglas

- **Toda interfaz nueva o rehecha usa estas piezas.** Si falta una, se agrega acá (una
  carpeta por pieza, `nombre/nombre.svelte`), no se crea otra en `components/`.
- **Nombres:** `Input` (pelado), `*Field` (con etiqueta y restablecer), `Dropdown`,
  `Stepper`, `Slider`. Nada de prefijos como `Material`.
- **Eventos:** `on:click` / `on:change` con `detail` (más el atributo nativo). No migrar los
  manejadores de los padres a callbacks de forma masiva (ver `AGENTS.md`).
- **Apariencia:** sólo tokens (`--bg`, `--text`, `--border`, `--action`, …). Sin hex ni
  degradés ni sombras fuera de flotantes. El CSS que deba poder sobrescribirse va en
  `@layer components`.
- **Lo que depende del dominio no va acá** (`ShowButton`, `TopButton`, `MediaPicker`,
  `HoverPlay`, `components/form/`).

## Piezas

`button`, `input`, `link`, `hidden-input`, `combined-input`, `dropdown`, `stepper`,
`slider`, `zoom-control`, `choice-grid`; campos: `text-field`, `number-field`,
`textarea-field`, `select-field`, `popup-field`, `file-field`, `folder-field`,
`time-field`, `date-field`, `radial-field`, `color-field`, `colors-field`, `font-field`,
`toggle-field`, `checkbox-field`, `segmented-field`, `toggle-group-field`;
distribución: `input-row`, `floating-bar`, `tabs`, `list`, `h-rule`, `title`,
`dynamic-list`, `capsule`, `list-row`, `section-header`, `menu`.

## Verificación

`bun run test:svelte` no debe empeorar respecto de la línea base de `docs/ROADMAP.md`
(sección F0), y `bunx prettier --config config/formatting/.prettierrc.yaml --check`
sobre los archivos tocados en `src/`.
