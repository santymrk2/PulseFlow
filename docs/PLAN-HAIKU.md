# Plan para Haiku — terminar el modal de pantallas (F10.4b + F10.8b)

Tareas chicas y mecánicas para un modelo rápido. **Hacelas en orden, de a una.** Cada
tarea dice qué archivo tocar, qué cambiar (con el código cuando hace falta), cómo
verificar y qué mensaje de commit usar.

Contexto mínimo: PulseFlow es FreeShow migrado a Tauri. Las "pantallas" (salidas) se
configuran en un modal nuevo: `src/frontend/components/screens/` (`ScreenConfig.svelte`
= el modal con la lista, `ScreenDetail.svelte` = el panel de la pantalla elegida). Al
quitar la pestaña vieja *Settings → Outputs* se perdieron opciones; acá se recuperan.

## Reglas (leelas antes de empezar)

1. Leé `AGENTS.md`. Usá **sólo bun** (nunca npm/npx).
2. No toques archivos que la tarea no nombre. No reformatees archivos enteros.
3. **Antes de cada commit** corré los 3 chequeos y anotá los números:
   ```bash
   bun run test:unit          # todos tienen que pasar
   bun run test:svelte        # el número de ERRORS no puede pasar de 56
   bun run build              # tiene que decir "built in"
   ```
   Si `test:svelte` sube de 56, mirá los errores del archivo que tocaste
   (`bun run test:svelte 2>&1 | grep ScreenDetail`) y arreglalos antes de commitear.
   El error más común es *"'X' is declared but its value is never read"*: borrá la
   declaración `X` (import, variable o función) que quedó sin usar.
4. Un commit por tarea, con el mensaje exacto que dice la tarea, y después
   `git push origin feature/tauri-rust-migration`.
5. Si una tarea no se puede hacer como está escrita (un texto a buscar no existe, un
   chequeo no pasa después de 2 intentos): **no inventes**. Hacé `git checkout -- <archivo>`
   de lo que tocaste en esa tarea, anotá el problema en `docs/informes/haiku.md` y pasá
   a la siguiente.
6. Al terminar todas: escribí en `docs/informes/haiku.md` una línea por tarea
   (hecha / salteada y por qué), agregá al final una línea que diga exactamente
   `TERMINADO`, commit `docs: informe de Haiku` y push.

---

## H0 — Preparación

```bash
git pull origin feature/tauri-rust-migration
bun install
bun run test:unit && bun run test:svelte; bun run build
```

Creá `docs/informes/haiku.md` con el título `# Informe Haiku` y los 3 resultados.
No hay commit en esta tarea (se commitea con H1).

---

## H1 — Espejo real

**Archivo:** `src/frontend/components/helpers/sceneGraph.ts`, función `sendOutputScenes`.

Hoy cada salida manda su propia escena. Una salida con `screenType: "mirror"` tiene que
mandar la escena de la salida `mirrorOf`, con su propio `outputId`.

**Paso 1 — función nueva en un archivo propio** (así el test no carga todo el frontend):
`src/frontend/components/helpers/sceneMirror.ts`

```ts
import type { Output } from "../../../types/Output"

/** Una pantalla en modo espejo muestra la escena de la pantalla que replica. */
export function getSceneSourceId(id: string, outputsData: { [id: string]: Output }): string {
    const output = outputsData[id]
    const mirrorOf = output?.mirrorOf
    if (output?.screenType === "mirror" && mirrorOf && mirrorOf !== id && outputsData[mirrorOf]) return mirrorOf
    return id
}
```

**Paso 2 — usarla en `sceneGraph.ts`.** Agregá arriba
`import { getSceneSourceId } from "./sceneMirror"` y reemplazá este bloque:

```ts
    ids.forEach((id) => {
        try {
            const scene = outputsData[id].stageOutput ? buildStageScene(id, outputsData[id], outputsData) : buildSceneGraph(id, outputsData[id])
            send(OUTPUT, ["RENDER_SCENE"], scene)
```

por:

```ts
    ids.forEach((id) => {
        try {
            const sourceId = getSceneSourceId(id, outputsData)
            const source = outputsData[sourceId]
            const scene = source.stageOutput ? buildStageScene(sourceId, source, outputsData) : buildSceneGraph(sourceId, source)
            send(OUTPUT, ["RENDER_SCENE"], { ...scene, outputId: id })
```

**Paso 3 — test nuevo:** `src/frontend/components/helpers/sceneMirror.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { getSceneSourceId } from "./sceneMirror"

describe("getSceneSourceId", () => {
    const outs: any = {
        a: { name: "A", enabled: true },
        b: { name: "B", enabled: true, screenType: "mirror", mirrorOf: "a" },
        c: { name: "C", enabled: true, screenType: "mirror", mirrorOf: "zzz" },
        d: { name: "D", enabled: true, screenType: "single", mirrorOf: "a" }
    }
    it("espejo válido usa la escena de origen", () => expect(getSceneSourceId("b", outs)).toBe("a"))
    it("espejo a una salida inexistente usa la propia", () => expect(getSceneSourceId("c", outs)).toBe("c"))
    it("sin modo espejo usa la propia", () => expect(getSceneSourceId("d", outs)).toBe("d"))
})
```

**Commit:** `F10.8b: espejo real — la pantalla espejo recibe la escena de su origen`

---

## H2 — "Nueva salida NDI" sin ventana

**Archivo:** `src/frontend/components/screens/ScreenConfig.svelte`, función `newNdi`.

Dentro de `outputs.update`, después de `a[id].ndi = true`, agregá:

```ts
                a[id].invisible = true
                a[id].transparent = true
```

(Así funcionaba la versión vieja: una salida NDI no abre ventana y tiene fondo
transparente.)

**Commit:** `F10.8b: nueva salida NDI sin ventana y transparente`

---

## H3 — Layout de stage en el modal

**Archivo:** `src/frontend/components/screens/ScreenDetail.svelte`.

Hoy, en el bloque `{:else}` de `{#if !isStage}`, hay un `<select>` de "Layout" **sin
opciones** y un botón "Editar layout" con un `TODO`. Reemplazá **todo** ese
`<div class="row">…</div>` (desde `<div class="label">Layout</div>` hasta el cierre del
botón "Editar layout") por:

```svelte
    <div class="row">
        <MaterialPopupButton label="stage.stage_layout" value={stageId} name={$stageShows[stageId]?.name} icon="stage" popupId="select_stage_layout" on:change={(e) => setStageLayout(e.detail)} />
        {#if $stageShows[stageId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStage} />
        {/if}
    </div>
```

En el `<script>` agregá:

```ts
    import MaterialPopupButton from "../inputs/MaterialPopupButton.svelte"
    // el import de stores hoy es: import { outputs } from "../../stores"
    // dejalo así: import { activePage, activePopup, activeStage, outputs, stageShows } from "../../stores"

    $: stageId = currentOutput.stageLayout || currentOutput.stageOutput || ""
    function setStageLayout(id: string) {
        outputs.update((a) => {
            if (a[outputId]) {
                a[outputId].stageLayout = id
                a[outputId].stageOutput = id
            }
            return a
        })
    }
    function editStage() {
        activeStage.set({ id: stageId, items: [] })
        activePage.set("stage")
        activePopup.set(null)
    }
```

`MaterialButton` ya está importado en ese archivo.

**Verificación extra:** `grep -n "TODO" src/frontend/components/screens/ScreenDetail.svelte`
no debe mostrar nada.

**Commit:** `F10.8b: elegir y editar el layout de una pantalla de stage desde el modal`

---

## H4 — Recuperar las opciones avanzadas de envío (archivo nuevo)

Se restaura el archivo viejo como componente y se le sacan las partes que ya resuelve
el modal.

**Paso 1 — crear el archivo desde el historial de git:**

```bash
git show 8f233a0^:src/frontend/components/settings/tabs/Outputs.svelte > src/frontend/components/screens/ScreenOutputOptions.svelte
```

**Paso 2 — arreglar las rutas de import** (el archivo viejo estaba un nivel más abajo):

```bash
F=src/frontend/components/screens/ScreenOutputOptions.svelte
sed -i.bak -e 's#"\.\./\.\./\.\./\.\./types/#"@@TYPES@@/#g' \
           -e 's#"\.\./\.\./\.\./#"../../#g' \
           -e 's#"\.\./\.\./helpers/#"../helpers/#g' \
           -e 's#"\.\./\.\./input/#"../input/#g' \
           -e 's#"\.\./\.\./inputs/#"../inputs/#g' \
           -e 's#"@@TYPES@@/#"../../../types/#g' "$F" && rm "$F.bak"
grep -n "^    import" "$F"
```

Tiene que quedar así (comprobado sobre el archivo real): `types` con `"../../../types/…"`;
`stores`, `utils`, `IPC` y `audio` con `"../../…"`; `helpers`, `input` e `inputs` con
`"../…"`. Si ves algún `"../../../../"` o `"@@TYPES@@"`, el `sed` no se aplicó bien:
repetí el paso 1 y el 2.

**Paso 3 — borrar el bloque que ya resuelve el modal.** En la parte de abajo del
archivo (después de `</script>`), borrá **desde** la línea que empieza con

```svelte
{#if outputsList.filter((a) => !a.stageOutput).length > 1 || !currentOutput?.enabled || currentOutput?.stageOutput}
```

**hasta** la línea anterior a

```svelte
{#if currentOutput?.blackmagic}
```

(sin incluir esta última). Ese bloque tenía: el interruptor de habilitada, el estilo y
el look (ahora son los Looks), el layout de stage (H3) y "Pantalla de salida" (el lienzo
del modal).

**Paso 4 — borrar los 4 botones del popup que ya no existe.** Borrá cada línea que
contenga `popupId="change_output_values"` **junto con** el `{#if …}` y `{/if}` que la
envuelven, es decir, los bloques de 3 líneas de esta forma:

```svelte
    {#if currentOutput.invisible && !currentOutput.blackmagic}
        <MaterialPopupButton label="edit.size" … popupId="change_output_values" />
    {/if}
```

Verificá: `grep -n "change_output_values\|choose_screen\|select_style" "$F"` → sin resultados.

**Paso 5 — limpiar lo que quedó sin usar.** Corré
`bun run test:svelte 2>&1 | grep ScreenOutputOptions` y, por cada error
*"'X' is declared but its value is never read"*, borrá `X` (del import, o la variable o
función entera). Repetí hasta que no quede ninguno de ese archivo (al borrar unas, aparecen otras que
dependían de ellas). En una prueba hecha sobre el archivo real, la primera vuelta
muestra **sólo** errores de este tipo: `activeLook`, `looks`, `stageShows`, `styles`,
`applyLook`, `MaterialPopupButton`, `outputsList`, `_toggleOutput`, `editStyle`,
`editStage`, `activeOutputs`, `outputLabel`; en las vueltas siguientes suelen aparecer
`activeStyle`, `settingsTab`, `styleId`, `stageId`, `activeStage`, `activePage`,
`isCropped`, `toggleOutputEnabled`, `outputDisplay`, `toggleOutput`. Si aparece un error
de **otro** tipo, revisá los pasos 2–4.

**Paso 6:** el componente todavía no se usa en ningún lado; eso es la tarea H5.
Corré los 3 chequeos (test:svelte ≤ 56).

**Commit:** `F10.8b: recuperar las opciones de envío de Settings → Outputs como ScreenOutputOptions`

---

## H5 — Usar las opciones avanzadas en la pestaña Envío

**Archivo:** `src/frontend/components/screens/ScreenDetail.svelte`.

`ScreenOutputOptions` elige la salida con el store `currentOutputSettings`. En el
`<script>` de `ScreenDetail.svelte` agregá:

```ts
    import ScreenOutputOptions from "./ScreenOutputOptions.svelte"
    // sumá currentOutputSettings al import de "../../stores" que ya existe

    $: if (outputId && $currentOutputSettings !== outputId) currentOutputSettings.set(outputId)
```

En la pestaña Envío (`{:else if activeTab === "sending"}`), dentro de cada sección
(NDI, OMT, WebRTC, RTMP) **dejá el `MaterialToggleSwitch` de activar** y **borrá** el
`{#if currentOutput.<tipo>} … {/if}` que viene debajo (los campos mínimos: Nombre,
Grupos, URL, Token, destinos, botones Iniciar/Detener). Después del último `</div>` de
la sección RTMP, y antes del `</div>` que cierra `tab-panel`, agregá:

```svelte
        <ScreenOutputOptions />
```

Después borrá las funciones que quedaron sin usar en `ScreenDetail.svelte`
(`updateNdiData`, `updateOmtData`, `updateWebrtcData`, `addDest`, `removeDest`,
`updateDest` y sus imports), siguiendo la regla 3.

**Verificación extra:** `grep -n "framerate\|displayMode\|pixelFormat\|bitrate\|rateControl\|quality" src/frontend/components/screens/ScreenOutputOptions.svelte`
tiene que mostrar resultados (son las opciones recuperadas).

**Commit:** `F10.8b: pestaña Envío con todas las opciones (NDI, OMT, Blackmagic, WebRTC, RTMP)`

---

## H6 — Opciones de pantalla que faltaban (pestaña Hardware)

**Archivo:** `src/frontend/components/screens/ScreenDetail.svelte`, dentro de
`{#if activeTab === "hardware"}`, al final del bloque (antes de
`{:else if activeTab === "cropping"}`).

Agregá:

```svelte
        <MaterialToggleSwitch label="settings.invisible_window" checked={!!currentOutput.invisible} defaultValue={false} on:change={(e) => setOutputValue("invisible", e.detail)} />
        <MaterialToggleSwitch label="settings.transparent" checked={!!currentOutput.transparent} defaultValue={false} on:change={(e) => setOutputValue("transparent", e.detail)} />
        <MaterialToggleSwitch label="context.hide_from_preview" checked={!!currentOutput.hideFromPreview} defaultValue={false} on:change={(e) => setOutputValue("hideFromPreview", e.detail)} />
        <MaterialColorInput label="edit.color" value={currentOutput.color || "#F0008C"} defaultValue="#F0008C" on:change={(e) => setOutputValue("color", e.detail)} />
        <MaterialNumberInput label="screen.width" value={currentOutput.forcedResolution?.width || 0} defaultValue={0} max={8192} on:change={(e) => setForcedResolution("width", e.detail)} />
        <MaterialNumberInput label="screen.height" value={currentOutput.forcedResolution?.height || 0} defaultValue={0} max={8192} on:change={(e) => setForcedResolution("height", e.detail)} />
```

En el `<script>`:

```ts
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import { translateText } from "../../utils/language"   // si todavía no está importado

    function setOutputValue(key: string, value: any) {
        outputs.update((a) => {
            if (a[outputId]) (a[outputId] as any)[key] = value
            return a
        })
    }
    function setForcedResolution(side: "width" | "height", value: number) {
        outputs.update((a) => {
            const out = a[outputId]
            if (!out) return a
            const res = { width: out.forcedResolution?.width || 0, height: out.forcedResolution?.height || 0, [side]: Number(value) || 0 }
            if (!res.width || !res.height) delete out.forcedResolution
            else out.forcedResolution = res
            return a
        })
    }
```

Las claves de traducción usadas ya existen (comprobado): `settings.invisible_window`,
`settings.transparent`, `context.hide_from_preview`, `edit.color`, `screen.width` y
`screen.height`. Arriba de los dos números poné un título chico con
`{translateText("settings.resolution")}` para que se entienda que es la resolución
forzada (0 = sin forzar).

**Commit:** `F10.8b: opciones de pantalla invisible, transparente, ocultar de la vista previa, color y resolución forzada`

---

## H7 — Controles del proyecto en vez de HTML crudo

**Archivo:** `src/frontend/components/screens/ScreenDetail.svelte`. Hacelo **por
bloques**, corriendo los chequeos entre bloque y bloque.

Equivalencias:

| HTML crudo | Componente | Cómo se usa |
| --- | --- | --- |
| `<select value={v} on:change={(e) => f((e.target as HTMLSelectElement).value)}>` con `<option value="x">Texto</option>` | `MaterialDropdown` (`../inputs/MaterialDropdown.svelte`) | `<MaterialDropdown label="…" value={v} options={[{ value: "x", label: "Texto" }]} on:change={(e) => f(e.detail)} />` |
| `<input type="number" value={v} on:change={(e) => f((e.target as HTMLInputElement).value)}>` | `MaterialNumberInput` | `<MaterialNumberInput label="…" value={v} on:change={(e) => f(e.detail)} />` |
| `<input value={v} on:change={…}>` (texto) | `MaterialTextInput` | `<MaterialTextInput label="…" value={v} on:change={(e) => f(e.detail)} />` |

Bloques, en este orden (un commit al final de los cuatro):

1. **Tipo** (Única/Espejo/Edge blend) y **Espejar de** (la lista de salidas: armá
   `options` con `Object.entries($outputs).filter(([id, o]) => id !== outputId && !(o.stageOutput || o.kind === "stage")).map(([id, o]) => ({ value: id, label: o.name || id }))`).
2. **Salida** (monitores) y **Destino** (Completo/Personalizado) en la pestaña Hardware.
3. Los 4 campos **x, y, ancho, alto** de Destino personalizado.
4. **Relación de aspecto**, los 4 de **recorte** y los 4 de **edge blend** en la pestaña
   Recorte.

Dejá el `<input class="name-input">` del nombre de la pantalla como está (es un título
editable, no un campo de formulario).

**Verificación:** `grep -c "<select\|<input" src/frontend/components/screens/ScreenDetail.svelte`
→ tiene que dar `1` (sólo el del nombre).

**Commit:** `F10.8b: controles del proyecto en el modal de pantallas`

---

## H8 — Traducciones

**Archivos:** `public/lang/en.json`, `public/lang/es.json` y los `.svelte` de
`src/frontend/components/screens/`.

1. Listá los textos fijos en español:
   `grep -n '>[A-ZÁÉÍÓÚa-z][^<{]*<\|label="[A-ZÁÉÍÓÚ][^".]*"\|title="[A-ZÁÉÍÓÚ][^".]*"' src/frontend/components/screens/*.svelte`
   (los `label="settings.xxx"` ya son claves; los que tienen espacios o mayúscula sin
   punto son texto fijo).
2. En `en.json` y `es.json`, agregá una sección nueva **al final del objeto raíz**
   (antes de la última `}`), con una clave por texto. Ejemplo:
   ```json
       "screen_config": {
           "title": "Screen configuration",
           "audience": "Audience",
           "stage": "Stage",
           "system": "System",
           "type": "Type",
           "single": "Single",
           "mirror": "Mirror",
           "edge_blend": "Edge blend",
           "mirror_of": "Mirror of",
           "output": "Output",
           "target": "Target",
           "full": "Full",
           "custom": "Custom",
           "hardware": "Hardware",
           "cropping": "Cropping",
           "sending": "Sending",
           "new_ndi": "New NDI output",
           "identify": "Identify screens",
           "monitors": "Monitors"
       }
   ```
   y en `es.json` lo mismo con los textos en español ("Configuración de pantallas",
   "Audiencia", "Stage", "Sistema", "Tipo", "Única", "Espejo", "Edge blend",
   "Espejar de", "Salida", "Destino", "Completo", "Personalizado", "Hardware",
   "Recorte", "Envío", "Nueva salida NDI", "Identificar pantallas", "Monitores").
   **Cuidá la coma** de la sección
   anterior. Verificá que el JSON es válido:
   `bun -e "JSON.parse(require('fs').readFileSync('public/lang/es.json','utf8'));JSON.parse(require('fs').readFileSync('public/lang/en.json','utf8'));console.log('ok')"`
3. Reemplazá cada texto fijo:
   - en atributos `label=`/`title=` de componentes `Material*` → la clave directa:
     `label="screen_config.type"`;
   - en texto entre etiquetas → `{translateText("screen_config.type")}` (importá
     `translateText` desde `"../../utils/language"` si no está).
   - El título del modal en `ScreenConfig.svelte` (`title="Configuración de pantallas"`)
     → `title={translateText("screen_config.title")}`.

**Verificación:** el `grep` del paso 1 no devuelve textos en español.

**Commit:** `F10.8b: traducciones del modal de pantallas (en/es)`

---

## H9 — Marcar el roadmap

En `docs/ROADMAP.md` marcá con `[x]` las tareas **F10.3**, **F10.5**, **F10.4b** y
**F10.8b**, sólo si sus pasos quedaron hechos (si alguna tarea H se salteó, dejá la que
corresponda sin marcar y explicá en el informe). Completá `docs/informes/haiku.md`
según la regla 6 (incluye la línea `TERMINADO`).

**Commit:** `docs: informe de Haiku`

---

## Qué NO está en este plan (y por qué)

- **F10.9 (quitar el puente de Estilos, ~60 archivos):** toca medio frontend con
  cambios que requieren criterio caso por caso; el puente funciona. Queda para un
  modelo más grande.
- **F11.9 (repaso visual):** requiere ver la app.
- Pruebas con monitor real (F2.8, F10.10) y mediciones (F8.3): son del usuario.

## Cómo lanzarlo

Con el script de reintento (desde la carpeta `FreeShow`; elegí el id del modelo Haiku
que muestre `opencode models | grep -i haiku`):

```bash
MODELO=<proveedor>/<modelo-haiku> scripts/carril.sh . docs/informes/haiku.md "Carril Haiku. Seguí docs/PLAN-HAIKU.md al pie de la letra: tareas H0 a H9 en orden, una por vez, con sus reglas. Rama feature/tauri-rust-migration. Informe: docs/informes/haiku.md."
```
