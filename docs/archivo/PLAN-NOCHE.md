# Plan de noche — 4 agentes en paralelo (F10 + F11)

Para dejar opencode trabajando sin supervisión. Se puede arrancar **mientras el agente
principal todavía termina F10.1–F10.2**:

- **C** y **D** no dependen de F10.1–F10.2: arrancan ya.
- **A** arranca ya; cuando necesite los tipos nuevos los espera (ver "Esperar la base").
- **B** lo hace el **agente principal** en la carpeta original, a continuación de
  F10.2, sin carpeta ni rama nueva.

### Esperar la base (carril A)

Cuando una tarea necesite los tipos de F10.1/F10.2 (por ejemplo `kind`, `screenType`,
`LookScreen`), comprobar si ya están:

```bash
git fetch origin
git show origin/feature/tauri-rust-migration:docs/ROADMAP.md | grep -c '\[x\] \*\*F10.2'
```

- Si da `1`: `git merge origin/feature/tauri-rust-migration` y seguir.
- Si da `0`: avanzar con lo que no los necesite (estructura del modal, lista de
  monitores, estilos). Si ya no queda nada para avanzar, esperar con `sleep 110` y volver
  a comprobar (comandos cortos: no dejar un `sleep` largo). Máximo 2 horas esperando; si
  se cumple, anotarlo en el informe y seguir con F10.5.

## Carriles

| Carril | Carpeta | Rama | Tareas | Archivos que son SUYOS |
| --- | --- | --- | --- | --- |
| **A — Pantallas** | `../PulseFlow-pantallas` | `feature/f10-pantallas` | F10.3 → F10.4 → F10.5 | `components/main/Modal.svelte` (nuevo, lo crea A; B lo usa cuando exista — mientras tanto B crea su modal en `components/looks/` con la misma API y se unifica a la mañana), `components/screens/**`, `settings/Screens.svelte`, `settings/tabs/Outputs.svelte` (sólo leer/mover bloques), `components/output/**` excepto `output/preview/**`, `helpers/sceneGraph.ts` (sólo espejo, F10.5) |
| **B — Looks** | carpeta original `FreeShow` (agente principal) | `feature/tauri-rust-migration` | F10.1 → F10.2 → F10.6 | `components/looks/**`, `settings/tabs/Looks.svelte`, `helpers/looks.ts`, `helpers/historyActions.ts` |
| **C — Barra y menú** | `../PulseFlow-menu` | `feature/f10-menu` | F10.0f → F10.7 → F11.1 | `IPC/tauri.ts`, `commands/servers.rs`, `utils/language.ts`, `main/Top.svelte`, `main/TopButton.svelte`, `main/MenuBar.svelte`, `utils/shortcuts.ts`, `src-tauri/src/lib.rs` (sólo el menú), `src-tauri/src/menu.rs` (nuevo) |
| **D — Interfaz** | `../PulseFlow-ui` | `feature/f11-ui` | F11.2 → F11.3 → F11.4 → F11.5 → F11.6 → F11.8 → F11.10 | `components/drawer/**`, `components/show/**`, el marco de `slide/Slide.svelte`, `output/preview/**`, `main/Popup.svelte`, `main/Tooltip.svelte`, `context/**`, `public/global.css`, la columna izquierda de `MainLayout.svelte` (F11.10) |

Archivos compartidos (todos pueden tocarlos, con cuidado):

- `utils/popup.ts`: **sólo agregar** líneas de registro de popups, nunca reordenar.
- `public/lang/en.json` y `es.json`: cada carril agrega claves **sólo dentro de su
  sección** (`screens` → A, `looks` → B, `menu` → C, `ui` nueva → D). No reformatear el
  archivo.
- `docs/ROADMAP.md`: marcar sólo los checkboxes propios.
- Verificaciones: cada carril escribe en **su** archivo `docs/informes/<carril>.md`
  (`pantallas.md`, `looks.md`, `menu.md`, `ui.md`), nunca en `VERIFICAR.md`.

Quedan para la mañana (un solo agente, después de integrar): **F10.8, F10.9, F11.7,
F11.9** y la integración de las 4 ramas.

## Compartir la app (una instancia a la vez)

Dos instancias de PulseFlow a la vez usan el mismo puerto (1420) y **la misma carpeta
de datos del usuario**: se pisarían los settings. Regla para todos los carriles:

```bash
# tomar el turno (falla si otro agente lo tiene)
mkdir /tmp/pulseflow-app.lock && echo "<carril> $(date)" > /tmp/pulseflow-app.lock/owner
bun run dev:tauri          # probar lo necesario, máximo 10 minutos
# al terminar: cerrar la app y SIEMPRE liberar
rm -rf /tmp/pulseflow-app.lock
```

Si el `mkdir` falla, no esperar: seguir con lo que no necesita la app y reintentar más
tarde. Si el lock tiene más de 20 minutos (`cat /tmp/pulseflow-app.lock/owner`), se
considera abandonado y se puede borrar.

Capturas: `screencapture -x /tmp/<carril>-<tarea>.png` (requiere el permiso de
"Grabación de pantalla" para la terminal; ver "Antes de irte"). Si el modelo puede ver
imágenes, revisarlas; si no, describir qué se esperaba ver en el informe del carril.

## Reglas de la noche (se suman a AGENTS.md)

1. Trabajar sólo en tu carpeta y tu rama. Prohibido `checkout`/`switch`/`stash`/
   `reset --hard`/`push --force`.
2. **Commit y push después de cada tarea** (y a mitad de una tarea larga, con
   `WIP Fx.y:`), para no perder nada si se cortan los tokens.
3. Al terminar **cada** tarea: `git fetch origin && git merge origin/feature/tauri-rust-migration`
   para traer lo que haya cambiado en la base; si hay conflicto en un archivo que no es
   tuyo, quedate con la versión de la base y anotalo en tu informe.
4. Los chequeos de AGENTS.md (test:unit, test:svelte ≤ 58, cargo test si tocaste Rust,
   build) antes de cada push. Si un chequeo empeora y no lo arreglás en 2 intentos:
   revertí ese cambio (`git revert`), anotalo en el informe y seguí con la próxima
   tarea.
5. **Nunca** quedarse esperando una respuesta: si algo necesita una decisión del
   usuario, elegí la opción más conservadora, anotala como "Decisión pendiente" en tu
   informe y seguí.
6. Al terminar todas las tareas del carril: escribir el resumen final en tu informe
   (tareas, commits, decisiones pendientes, qué verificar a mano), agregar al final una
   línea que diga exactamente `TERMINADO`, commitear, pushear y parar.

## Antes de irte (vos, 5 minutos)

1. No hace falta esperar a F10.1/F10.2: el agente principal las termina y sigue con el carril B.
2. Ajustes del Sistema → Privacidad y seguridad → **Grabación de pantalla**: activá la
   app de terminal donde corre opencode (opcional; sin esto no hay capturas).
3. Dejá el monitor externo conectado y la Mac sin suspender
   (`caffeinate -dims &` en una terminal).
4. Prepará las carpetas (desde la carpeta original `FreeShow`):

```bash
git fetch origin && git checkout feature/tauri-rust-migration && git pull
for c in pantallas menu ui; do
  case $c in pantallas) r=feature/f10-pantallas;;
             menu) r=feature/f10-menu;; ui) r=feature/f11-ui;; esac
  git worktree add ../PulseFlow-$c -b $r origin/feature/tauri-rust-migration
  (cd ../PulseFlow-$c && bun install)
done
```

5. Abrí opencode en cada carpeta y pegá el prompt de su carril.

## Prompts

Comunes a los cuatro (pegar primero, después la línea del carril):

```
Leé completos: AGENTS.md, docs/ROADMAP.md (fases F10 y F11),
docs/design/pantallas-y-looks.md y docs/archivo/PLAN-NOCHE.md. Vas a trabajar toda la noche
sin supervisión siguiendo las "Reglas de la noche" de PLAN-NOCHE.md. Estás en el
carril indicado abajo: trabajás SOLO en esta carpeta y en tu rama actual, y sólo
tocás los archivos que la tabla de carriles dice que son tuyos (más los compartidos
con sus reglas). Para usar la app, respetá el lock de "Compartir la app".
```

- **A:** `Carril A — Pantallas. Tareas en orden: F10.3, F10.4, F10.5. Rama feature/f10-pantallas. Informe: docs/informes/pantallas.md.`
- **B:** (agente principal, carpeta original) `Carril B — Looks. Tareas en orden: terminar F10.1 y F10.2, después F10.6. Rama feature/tauri-rust-migration. Informe: docs/informes/looks.md.`
- **C:** `Carril C — Barra y menú. Tareas en orden: F10.0f, F10.7, F11.1. Rama feature/f10-menu. Informe: docs/informes/menu.md.`
- **D:** `Carril D — Interfaz. Tareas en orden: F11.2, F11.3, F11.4, F11.5, F11.6, F11.8, F11.10. Rama feature/f11-ui. Informe: docs/informes/ui.md.`

## Reintento automático (si se corta por el límite del modelo)

opencode no reintenta solo cuando se agota la cuota de un modelo gratis: la sesión se
corta. `scripts/carril.sh` corre el carril con `opencode run` (sin la interfaz) y, si se
corta, espera 10 minutos y arranca **una sesión nueva** que retoma desde los commits, el
ROADMAP y el informe, hasta que el informe termine con `TERMINADO` (máximo 60 intentos).

Desde la carpeta original `FreeShow`, una terminal por carril:

```bash
scripts/carril.sh . docs/informes/looks.md "Carril B — Looks (agente principal). Tareas en orden: terminar F10.1 y F10.2 (migración idempotente + test, startLookBridge al arrancar, applyLook con transitionMs, arreglar settings/tabs/Looks.svelte; svelte-check vuelve a 58; marcar F10.0a-e, F10.1 y F10.2 y pushear porque el carril A lo espera), después F10.6. Rama feature/tauri-rust-migration. Informe: docs/informes/looks.md."
scripts/carril.sh ../PulseFlow-pantallas docs/informes/pantallas.md "Carril A — Pantallas. Tareas en orden: F10.3, F10.4, F10.5. Rama feature/f10-pantallas. Cuando necesites los tipos de F10.1/F10.2, seguí la sección Esperar la base. Informe: docs/informes/pantallas.md."
scripts/carril.sh ../PulseFlow-menu docs/informes/menu.md "Carril C — Barra y menú. Tareas en orden: F10.0f, F10.7, F11.1. Rama feature/f10-menu. Informe: docs/informes/menu.md."
scripts/carril.sh ../PulseFlow-ui docs/informes/ui.md "Carril D — Interfaz. Tareas en orden: F11.2, F11.3, F11.4, F11.5, F11.6, F11.8, F11.10. Rama feature/f11-ui. Informe: docs/informes/ui.md."
```

Opciones: `MODELO=opencode/<otro> ESPERA=900 scripts/carril.sh …`. Con `--auto`, opencode
aprueba solo los permisos que no estén denegados explícitamente. Para cortar un carril:
`Ctrl+C` en su terminal (el trabajo commiteado queda).

## A la mañana

1. Leer los 4 informes (`docs/informes/*.md` en cada rama).
2. B ya está en la rama principal. Integrar el resto en este orden: **A → C → D** sobre
   `feature/tauri-rust-migration`, corriendo todos los chequeos después de cada merge.
   Lo puede hacer un agente con:
   `Integrá origin/feature/f10-pantallas, f10-menu y f11-ui en ese orden en
   feature/tauri-rust-migration, resolviendo conflictos y corriendo todos los chequeos
   después de cada merge. Si un merge rompe algo que no podés arreglar en 2 intentos,
   abortalo (git merge --abort), anotalo y seguí con el siguiente. Push y resumen.`
3. Probar a mano lo que pidan los informes.
4. Un agente: **F10.8 → F10.9 → F11.7 → F11.9**.
