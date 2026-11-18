# Ordenar PulseFlow antes de rehacerlo — diseño

Fecha: 2026-11-18. Estado: borrador para aprobar.

## Por qué

La migración de Svelte a React terminó y dejó el proyecto desordenado. El usuario quiere llevar PulseFlow hacia la forma
de trabajar de ProPresenter, empezando por el editor de slides, que hoy "funciona muy mal y es poco intuitivo". Antes
quiere ordenar el proyecto en módulos y sacar lo ineficiente, para que el trabajo siguiente sea más fácil de encarar.

Además, hoy "se rompen muchas cosas" y no hay una lista de cuáles. Sin esa lista no se puede priorizar, ni distinguir
después lo que rompió el refactor de lo que ya estaba roto.

## Objetivos

1. Un **inventario priorizado de lo que está roto**, sacado de recorrer la app de verdad.
2. **Un solo sistema de estilos**: CSS Modules + variables del tema. Tailwind sale del proyecto.
3. **El frontend dividido por funcionalidad**: todo lo de una funcionalidad (UI, lógica, estilos, tests) en una carpeta.
4. **El chequeo de tipos cubre todo el frontend**, no sólo `react/`.

## No-objetivos

- Arreglar los bugs del inventario. Se arreglan después, en el orden que se decida con el usuario.
- Rediseñar el editor de slides. Es la etapa siguiente, con su propio diseño.
- Tocar Rust (`src-tauri/`): ya está separado en `commands/`, `domain/`, `render/` y `server/`.
- Pasar los `style={{…}}` inline (1.190) a clases. Se hace cuando se rehace cada funcionalidad.
- Repartir los 89 popups entre funcionalidades. En esta etapa se mudan juntos.

## Anti-objetivos (fracaso aunque "funcione")

- **Cambiar comportamiento durante la mudanza.** Mover un archivo y arreglarle algo en el mismo commit hace imposible
  saber qué rompió qué. La mudanza es puramente mecánica.
- **Un commit gigante.** Se muda una funcionalidad por commit, cada una verificable por separado.
- **Dejar dos sistemas de estilos conviviendo**, que fue la causa de los bugs de hoy.

## Restricciones

- Sólo bun. Sin dependencias nuevas pesadas. Sólo macOS y Windows.
- Reglas de AGENTS.md: React Compiler (sin `useMemo`/`useCallback`/`memo`), stores con `useStore`, CSS Modules sin
  selectores de elemento y con `styles.x` real (lo controlan `cssModulesScope.test.ts` y `cssModulesClasses.test.ts`).
- Línea base al 2026-11-18 (`main`, commit `173380e5`):
  - `bun run test:unit`: 2837/2838. El error que queda es un worker de vitest que se queda sin memoria
    (`heap out of memory`), y ya pasaba antes.
  - `bun run test:react`: 0 errores (pero sólo mira `src/frontend/react/`).
  - `tsc -p src/frontend/tsconfig.json` sobre todo el frontend: **168 errores**, ocultos porque nadie los chequea.
    Los peores: `utils/receivers.ts` (40) y `components/helpers` (22); el resto, sobre todo en tests.

## Cómo está hoy

```
src/frontend/
  react/        452 componentes .tsx + 347 .module.css (123k líneas). La UI.
  components/   172 .ts, sin un solo componente (45k líneas). Lógica por funcionalidad; el nombre quedó de Svelte.
  utils/ converters/ audio/ IPC/ values/ show/ media/ classes/ lib/   sueltos al mismo nivel.
  stores.ts  main.tsx  app.css  global.d.ts
```

`react/<x>` y `components/<x>` usan **los mismos nombres de funcionalidad** (drawer, edit, show, slide, stage, output,
timeline, settings…). 400 archivos de `react/` importan de `components/`; al revés, ninguno. En `lib/components/` sólo
quedan carpetas vacías de Svelte.

## Enfoques considerados

| Enfoque | Qué es | Por qué sí / por qué no |
|---|---|---|
| **A. Por funcionalidad (elegido)** | `features/<x>/` junta `react/<x>` y `components/<x>`; lo compartido va a `shared/` | El editor de slides queda en una carpeta, que es lo que necesita la etapa siguiente. Los nombres ya coinciden, así que la mudanza es casi mecánica. |
| B. Por capas | `core/`, `domain/`, `ui/` | Más fácil de mover, pero cada funcionalidad queda repartida en tres árboles: encontrar "todo lo del editor" sigue siendo una búsqueda. |
| C. Sólo renombrar | `components/` → `logic/` y nada más | Barato, pero no ordena nada de verdad. |

Estilos: **CSS Modules (elegido)** contra migrar todo a Tailwind. Tailwind se usa en 7 archivos; CSS Modules son 16.700
líneas que ya funcionan y tienen guards. Migrar sería reescribirlas con la app rota y con dos sistemas conviviendo
durante meses. El usuario prefería Tailwind pero delegó la decisión. Si se quiere en el futuro, va como proyecto propio
y completo.

## Diseño

Tres etapas en este orden. Cada una termina con todo en verde y la app levantada y mirada.

### Etapa 0 — Diagnóstico

Recorrer la app levantada (`bun run dev:tauri`) y registrar cada falla.

- **Cobertura mínima:**
  - las páginas Show, Edit y Stage, y Settings con cada una de sus pestañas;
  - cada pestaña del drawer: Media, Audio, Scripture, Calendar, Functions y las que haya;
  - cada popup que se pueda abrir desde la UI;
  - los flujos básicos: crear show, agregar slides, editar texto, mandar a salida, limpiar salida.
- **Cómo:** los errores de la webview ya llegan al log de Tauri como `[webview][WARN]`/`[ERROR]`. Para navegar y medir
  sirve una sonda temporal en `main.tsx` que cambie páginas con los stores (`activePage.set(...)`) y vuelque un resumen
  del layout al log, con capturas de la ventana por `screencapture`. La sonda **no se commitea**.
- **Qué entra al inventario** *(decisión del diseñador)*: errores en el log, layouts rotos o superpuestos, acciones
  que no hacen nada o hacen algo distinto de lo que dicen, y pantallas que no abren. Lo que funciona pero es "poco
  intuitivo" va a una sección aparte, **UX**, que alimenta el rediseño estilo ProPresenter y no cuenta como bug.
- **Si una pantalla bloquea el recorrido** (no abre o cuelga la app), se registra como gravedad "bloquea" y se sigue
  con el resto. La app hoy arranca (verificado el 2026-11-18).
- **No es una compuerta** *(decisión del diseñador)*: la etapa 1 arranca apenas existe el documento. El usuario lo
  revisa en paralelo y con eso se arma el roadmap.
- **Producto:** `docs/diagnostico.md`. Cada falla lleva qué pasa, dónde, cómo reproducirla, su gravedad
  (bloquea / molesta / cosmético) y una captura si suma. Es el insumo del roadmap nuevo, que se arma con el usuario.
- También sirve de **lista de humo**: después de cada mudanza de la etapa 2 se vuelven a mirar esos puntos.

### Etapa 1 — Un solo sistema de estilos

- Pasar los 7 archivos que usan clases de Tailwind a su `.module.css`: `edit/CategoryPicker`, `ui/menu/MenuItem`,
  `ui/menu/MenuSeparator`, `show/left/LeftPanel`, `ui/section-header/SectionHeader`, `show/left/ItemsPanel` y
  `ui/list-row/ListRow`. Verificar que no queden otros con un búsqueda amplia de clases de Tailwind.
- `cn()` (`lib/utils.ts`) pasa a ser `clsx` solo, sin `tailwind-merge`.
- Sacar `tailwindcss`, `@tailwindcss/vite` y `tailwind-merge` de `package.json` y el plugin de `vite.config.mjs`.
- En `src/frontend/app.css` sacar los imports de Tailwind, `@theme` y `@custom-variant`. Conservar las variables
  `--shui-*` sólo si algún CSS las usa; si no, borrarlas.
- Actualizar AGENTS.md: la regla de "clases semánticas de Tailwind" pasa a decir que no se usa Tailwind.
- **Verificación:** la app se ve igual que antes. Comparar capturas de Show, Edit y el drawer contra las de la etapa 0.

### Etapa 2 — División por funcionalidad

Estructura destino:

```
src/frontend/
  app/                     arranque y armazón: main.tsx, App, MainLayout, react/main/ (barra superior, menús, splash…)
    wiring/                la orquestación que conecta funcionalidades (ver "Lógica que cruza funcionalidades")
  features/
    show/ edit/ slide/ stage/ output/ screens/ looks/ drawer/ timeline/ settings/
    popups/ quicksearch/ export/ guide/ actions/ media/ import/
  shared/
    ui/                    el kit (react/ui/) + react/system, helpers, hooks, form, context (menú contextual)
    core/                  stores.ts, lib/store.ts, IPC/, values/, classes/
    utils/                 utils/ y components/helpers/ que use más de una funcionalidad
```

- **Regla de mudanza:** `features/<x>/` recibe `react/<x>/*` en la raíz y `components/<x>/*` en `features/<x>/logic/`.
  Las sueltas se ubican así:
  - `converters/` → `features/import/`
  - `audio/` → `features/drawer/audio/logic/`; si lo usa la salida, a `shared/`
  - `show/slides.ts` → `features/show/logic/`
  - `media/cameraManager.ts` → `features/media/logic/`
- **Qué va a `shared/`:** lo que importan dos o más funcionalidades, según el grafo de imports y no a ojo. Lo que usa una
  sola, va a esa funcionalidad.
- **Carpetas que no son funcionalidades** *(decisión del diseñador)*:

  | Origen | Destino |
  |---|---|
  | `components/helpers/` | `shared/utils/` (lo importan 462 archivos de UI) |
  | `react/helpers/` | `shared/ui/helpers/` |
  | `react/ui/`, `react/system/`, `react/hooks/`, `react/form/` + `components/form/`, `react/context/` + `components/context/` | `shared/ui/` (lo de `components/` en `logic/` de cada una) |
  | `react/main/` + `components/main/` | `app/` |
  | `react/test/` | `shared/test/` |
  | `react/guide/` + `components/guide/` | `app/guide/` |

- **Lógica que cruza funcionalidades** *(decisión del diseñador, sale de la revisión)*: hoy 61 archivos sueltos importan
  de `components/<funcionalidad>`, entre ellos `stores.ts`. No se pueden mandar a `shared/` sin romper la regla. Para
  no cambiar lógica en la mudanza:
  - **Orquestación → `app/wiring/`.** Es lo que arranca, guarda o conecta la app: `utils/startup`, `save`,
    `receivers`, `listeners`, `shortcuts`, `sendData`, `cloudSync`, `updateSettings`, `createData`,
    `remoteController`, `*Talk.ts` e `IPC/responsesMain.ts`. `app/` sí puede depender de `features/`.
  - **`converters/` y `audio/`** van a sus funcionalidades (`import`, `drawer/audio`), así que su dependencia de
    otras funcionalidades deja de ser un problema de `shared/`.
  - **Lo que quede en `shared/` y todavía importe de `features/`** (por ejemplo `stores.ts`, `classes/Show.ts`,
    `utils/common`) entra en una **lista de excepciones del guard**. La lista **sólo puede achicarse**: el test falla
    si aparece una dependencia nueva de `shared/` a `features/`, y también si una excepción deja de hacer falta y no
    se borró. Invertir esas dependencias es trabajo posterior, porque toca lógica.
- **Orden:** primero `shared/` (core, utils y ui), porque todo depende de ahí. Después una funcionalidad por commit,
  de la menos usada a la más usada. Al final, `app/`.
- **Cada commit:** sólo `git mv` y arreglo de imports, sin cambiar lógica. Pasan `test:unit`, el chequeo de tipos y
  los guards de CSS. Se mira en la app la lista de humo de esa funcionalidad.
- **Chequeo de tipos:**
  - `test:react` pasa a `test:types` y cubre todo `src/frontend/`;
  - mientras dure la etapa, hay un número máximo de errores que no puede subir (arranca en 168);
  - los errores de cada funcionalidad se arreglan al mudarla, en un commit **aparte** del `git mv`;
  - al terminar la etapa, 0 errores y se saca el máximo.
- **Guard nuevo:** un test que falle si algo de `shared/` importa de `features/` fuera de la lista de excepciones
  descripta arriba. Lo compartido no depende de una funcionalidad.
- **Commits:** conventional commits en español, como pide AGENTS.md. Por ejemplo `refactor(features/show): mudar show`,
  `fix(features/show): errores de tipos`, `docs: diagnóstico`.
- **Scripts que dependen de rutas:**
  - `scripts/check-react-types.ts` (filtra `src/frontend/react/`)
  - `scripts/qualityBudget.ts` (`src/frontend/react/…module.css`)
  - los dos guards de CSS (`react/**/*.module.css`)
  - `src/frontend/react/tsconfig.json`, `vite.config.mjs`, `index.html` (`/src/frontend/main.tsx`)
  - AGENTS.md (`src/frontend/react/`)

  Se actualizan en el commit donde se mueve lo que miran.
- Se borran las carpetas vacías de `src/frontend/lib/components/`.

## Criterios de éxito

- `docs/diagnostico.md` existe y cubre lo listado en la etapa 0.
- Tailwind no está en `package.json`, `vite.config.mjs` ni `app.css`, y la app se ve igual.
- No existen `src/frontend/react/` ni `src/frontend/components/`. Todo vive en `app/`, `features/` o `shared/`.
- Pasan `test:types` (todo el frontend, 0 errores), `test:unit` (sin empeorar la línea base), `test:budget` y los guards.
- La lista de humo no muestra fallas nuevas respecto del diagnóstico.

## Lo que queda a criterio de quien lo construya

- La herramienta para mover archivos y reescribir imports: un script de bun propio, `git mv` más los errores de `tsc`,
  o una combinación. No se agregan dependencias pesadas.
- Qué funcionalidades chicas se juntan (por ejemplo `guide` dentro de `app/`) si el grafo de imports lo justifica.
- El formato exacto de `docs/diagnostico.md`.
- Ajustar la tabla de "carpetas que no son funcionalidades" si el grafo de imports muestra que algo de ahí lo usa una
  sola funcionalidad.
