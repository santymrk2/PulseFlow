# Plan de noche — 4 agentes en paralelo (F10 + F11)

Para dejar opencode trabajando sin supervisión. Requiere que **F10.1 y F10.2 estén
terminadas y pusheadas** en `feature/tauri-rust-migration` (son la base de todo).

## Carriles

| Carril | Carpeta | Rama | Tareas | Archivos que son SUYOS |
| --- | --- | --- | --- | --- |
| **A — Pantallas** | `../PulseFlow-pantallas` | `feature/f10-pantallas` | F10.3 → F10.4 → F10.5 | `components/main/Modal.svelte` (nuevo, lo crea A; B lo usa cuando exista — mientras tanto B crea su modal en `components/looks/` con la misma API y se unifica a la mañana), `components/screens/**`, `settings/Screens.svelte`, `settings/tabs/Outputs.svelte` (sólo leer/mover bloques), `components/output/**` excepto `output/preview/**`, `helpers/sceneGraph.ts` (sólo espejo, F10.5) |
| **B — Looks** | `../PulseFlow-looks` | `feature/f10-looks` | F10.6 | `components/looks/**`, `settings/tabs/Looks.svelte`, `helpers/looks.ts`, `helpers/historyActions.ts` |
| **C — Barra y menú** | `../PulseFlow-menu` | `feature/f10-menu` | F10.0f → F10.7 → F11.1 | `IPC/tauri.ts`, `commands/servers.rs`, `utils/language.ts`, `main/Top.svelte`, `main/TopButton.svelte`, `main/MenuBar.svelte`, `utils/shortcuts.ts`, `src-tauri/src/lib.rs` (sólo el menú), `src-tauri/src/menu.rs` (nuevo) |
| **D — Interfaz** | `../PulseFlow-ui` | `feature/f11-ui` | F11.2 → F11.3 → F11.4 → F11.5 → F11.6 → F11.8 | `components/drawer/**`, `components/show/**`, el marco de `slide/Slide.svelte`, `output/preview/**`, `main/Popup.svelte`, `main/Tooltip.svelte`, `context/**`, `public/global.css` |

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
   (tareas, commits, decisiones pendientes, qué verificar a mano) y parar.

## Antes de irte (vos, 5 minutos)

1. Confirmá que F10.1 y F10.2 están pusheadas (`git log origin/feature/tauri-rust-migration`).
2. Ajustes del Sistema → Privacidad y seguridad → **Grabación de pantalla**: activá la
   app de terminal donde corre opencode (opcional; sin esto no hay capturas).
3. Dejá el monitor externo conectado y la Mac sin suspender
   (`caffeinate -dims &` en una terminal).
4. Prepará las carpetas (desde la carpeta original `FreeShow`):

```bash
git fetch origin && git checkout feature/tauri-rust-migration && git pull
for c in pantallas looks menu ui; do
  case $c in pantallas) r=feature/f10-pantallas;; looks) r=feature/f10-looks;;
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
docs/design/pantallas-y-looks.md y docs/PLAN-NOCHE.md. Vas a trabajar toda la noche
sin supervisión siguiendo las "Reglas de la noche" de PLAN-NOCHE.md. Estás en el
carril indicado abajo: trabajás SOLO en esta carpeta y en tu rama actual, y sólo
tocás los archivos que la tabla de carriles dice que son tuyos (más los compartidos
con sus reglas). Para usar la app, respetá el lock de "Compartir la app".
```

- **A:** `Carril A — Pantallas. Tareas en orden: F10.3, F10.4, F10.5. Rama feature/f10-pantallas. Informe: docs/informes/pantallas.md.`
- **B:** `Carril B — Looks. Tarea: F10.6 completa. Rama feature/f10-looks. Informe: docs/informes/looks.md.`
- **C:** `Carril C — Barra y menú. Tareas en orden: F10.0f, F10.7, F11.1. Rama feature/f10-menu. Informe: docs/informes/menu.md.`
- **D:** `Carril D — Interfaz. Tareas en orden: F11.2, F11.3, F11.4, F11.5, F11.6, F11.8. Rama feature/f11-ui. Informe: docs/informes/ui.md.`

## A la mañana

1. Leer los 4 informes (`docs/informes/*.md` en cada rama).
2. Integrar en este orden (menos conflictos): **B → A → C → D** sobre
   `feature/tauri-rust-migration`, corriendo todos los chequeos después de cada merge.
   Lo puede hacer un agente con:
   `Integrá origin/feature/f10-looks, f10-pantallas, f10-menu y f11-ui en ese orden en
   feature/tauri-rust-migration, resolviendo conflictos y corriendo todos los chequeos
   después de cada merge. Si un merge rompe algo que no podés arreglar en 2 intentos,
   abortalo (git merge --abort), anotalo y seguí con el siguiente. Push y resumen.`
3. Probar a mano lo que pidan los informes.
4. Un agente: **F10.8 → F10.9 → F11.7 → F11.9**.
