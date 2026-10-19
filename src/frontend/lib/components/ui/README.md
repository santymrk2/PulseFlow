# Componentes UI (shadcn-svelte / Tailwind)

Componentes portados de la referencia `docs/design-reference/` (que usa
shadcn-svelte + Tailwind v4) con el CLI de shadcn-svelte. Son **opt-in**: no
reemplazan a los componentes legacy de `src/frontend/components/`.

## Regla de uso

- **Usar estos componentes sólo en pantallas nuevas** (por ejemplo, el editor de
  Looks de F5.3) o en widgets nuevos que no existan aún.
- **No migrar en masa** componentes existentes (`Button.svelte`,
  `MaterialInput`, `CombinedInput`, etc.): los componentes legacy reciben
  `on:*` de sus padres y migrarlos a runes los rompe (ver `AGENTS.md`). Esa
  migración sería una tarea propia del roadmap, con revisión visual.
- La apariencia sale del tema activo: `app.css` ata los tokens `--shui-*` a las
  variables de FreeShow (`--primary`, `--text`, `--secondary`, `--radius`, …),
  así que estos componentes siguen el tema del usuario sin clases `.dark`.

## Componentes disponibles

`button`, `input`, `label`, `select`, `separator`, `skeleton`, `switch`, `tabs`,
`scroll-area` (ver sus `*.svelte` y `index.ts` en cada carpeta).

## Cómo agregar otro

```sh
bunx shadcn-svelte@latest add button
```

El CLI exige un `tsconfig.json` en la raíz (acá no existe; el alias `$lib`
apunta a `src/frontend/lib` desde `vite.config.*` y
`src/frontend/tsconfig.json`). Si el CLI se niega, generar en un scaffold
temporal con un `tsconfig.json` que declare el alias y copiar el resultado a
`src/frontend/lib/components/ui/`.

Alcopiar, revisar dos desvíos conocidos del generado:

1. Los iconos se importan del barrel: `import { Check as CheckIcon } from
"@lucide/svelte"` (el subpath `@lucide/svelte/icons/*` no resuelve tipos).
2. Los tipos auxiliares (`WithElementRef`, `WithoutChild`, …) viven en
   `src/frontend/lib/utils.ts`, no en `$lib/types.ts`.

## Verificación

`bun run test:svelte` no debe empeorar respecto de la línea base de `docs/ROADMAP.md`
(sección F0), y `bunx prettier --config config/formatting/.prettierrc.yaml --check`
sobre los archivos tocados en `src/`.
