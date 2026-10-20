<script lang="ts">
    import type { Look, LookScreen } from "../../../types/Settings"
    import { activeLook, looks, outputs } from "../../stores"
    import { translateText } from "../../utils/language"
    import { confirmCustom } from "../../utils/popup"
    import { save } from "../../utils/save"
    import { clone, keysToID, sortByName } from "../helpers/array"
    import { history } from "../helpers/history"
    import { applyLook, createLook, isStageOutput } from "../helpers/looks"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialSlider from "../inputs/Slider.svelte"
    import LookGrid from "./LookGrid.svelte"
    import Modal from "../main/Modal.svelte"

    // F10.6 — modal "Looks": presets a la izquierda, grilla pantallas × capas a la
    // derecha. Los cambios se editan en una copia y se aplican al tocar "Guardar".

    const t = translateText

    $: audienceScreens = sortByName(keysToID($outputs).filter((a) => !isStageOutput(a)))
    $: presetIds = Object.keys($looks)

    // ----- presets -----

    let selectedLook = ""
    $: if (!selectedLook || !$looks[selectedLook]) selectedLook = $activeLook && $looks[$activeLook] ? $activeLook : presetIds[0] || ""

    /** Copia editable del look seleccionado; se guarda en $looks al tocar "Guardar". */
    let draft: Look | null = null
    $: draft = $looks[selectedLook] ? clone($looks[selectedLook]) : null

    /** ¿la copia difiere de lo guardado? (para resaltar "Guardar") */
    $: isDirty = !!draft && JSON.stringify(draft) !== JSON.stringify($looks[selectedLook])

    function updateDraft(patch: Partial<Look>) {
        if (!draft) return
        draft = { ...draft, ...patch }
    }

    function updateCell(outputId: string, patch: Partial<LookScreen>) {
        if (!draft) return
        const cell = { ...(draft.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }), ...patch }
        updateDraft({ screens: { ...(draft.screens || {}), [outputId]: cell } })
    }

    function saveDraft() {
        if (!draft || !selectedLook) return

        history({ id: "UPDATE", newData: { data: clone(draft) }, oldData: { id: selectedLook }, location: { page: "settings", id: "settings_look" } })
        save()
    }

    function createPreset() {
        const name = `${t("looks.looks")} ${presetIds.length + 1}`
        const id = createLook(name)
        save()
        selectedLook = id
    }

    async function removePreset(id: string) {
        if (presetIds.length <= 1 || !id) return
        const ok = await confirmCustom(`${t("actions.delete")} "${$looks[id]?.name}"?`)
        if (!ok) return

        history({ id: "UPDATE", newData: { id }, location: { page: "settings", id: "settings_look" } })
        if (selectedLook === id) selectedLook = ""
        save()
    }

    function renamePreset(id: string) {
        if (!id) return
        const current = $looks[id]?.name || ""
        const value = typeof window !== "undefined" ? window.prompt(t("looks.name"), current) : null
        if (value === null || !value.trim()) return

        const look = { ...$looks[id], name: value.trim() }
        history({ id: "UPDATE", newData: { data: look }, oldData: { id }, location: { page: "settings", id: "settings_look" } })
        save()
    }

    function duplicatePreset(id: string) {
        const source = $looks[id]
        if (!source) return

        const newId = createLook(`${source.name} 2`)
        looks.update((a) => {
            a[newId] = { ...a[newId], screens: clone(source.screens), transitionMs: source.transitionMs }
            return a
        })
        save()
        selectedLook = newId
    }

    function makeLive() {
        if (!selectedLook) return
        applyLook(selectedLook)
    }

    function onTransitionChange(e: Event) {
        const value = Number((e.currentTarget as HTMLInputElement)?.value ?? 0)
        updateDraft({ transitionMs: value })
    }
</script>

<Modal title="looks.window_title" width={760} height={520}>
    <div class="looks-window">
        <!-- Columna izquierda: en vivo + presets -->
        <div class="sidebar">
            <div class="live">
                <Icon id="play" size={0.9} white />
                <span>{t("looks.live")}: <strong>{$looks[$activeLook]?.name || "—"}</strong></span>
            </div>

            <div class="presets-header">
                <span>{t("looks.presets")}</span>
                <MaterialButton icon="add" title="looks.new" small on:click={createPreset} />
            </div>

            <div class="presets">
                {#each presetIds as id (id)}
                    {@const look = $looks[id]}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <div
                        class="preset"
                        class:selected={id === selectedLook}
                        role="button"
                        tabindex="0"
                        on:click={() => (selectedLook = id)}
                        on:keydown={(e) => e.key === "Enter" && (selectedLook = id)}
                        on:contextmenu={(e) => {
                            e.preventDefault()
                            renamePreset(id)
                        }}
                    >
                        {#if id === $activeLook}
                            <span class="dot" />
                        {/if}
                        <span class="name">{look.name}</span>
                    </div>
                {/each}
            </div>

            <div class="preset-actions">
                <MaterialButton icon="rename" title="actions.rename" small disabled={!selectedLook} on:click={() => renamePreset(selectedLook)} />
                <MaterialButton icon="duplicate" title="actions.duplicate" small disabled={!selectedLook} on:click={() => duplicatePreset(selectedLook)} />
                <MaterialButton icon="delete" title="actions.delete" small red disabled={!selectedLook || presetIds.length <= 1} on:click={() => removePreset(selectedLook)} />
            </div>
        </div>

        <!-- Detalle del preset -->
        <div class="detail">
            {#if !audienceScreens.length}
                <p class="hint">{t("looks.no_screens")}</p>
            {:else if draft}
                <div class="detail-header">
                    <input class="name-input" type="text" value={draft.name} on:input={(e) => updateDraft({ name: e.currentTarget.value })} />
                    <MaterialButton variant={isDirty ? "contained" : "text"} icon="save" title="actions.save" disabled={!isDirty} on:click={saveDraft} />
                </div>

                <div class="scroll">
                    <LookGrid screens={audienceScreens} {draft} on:cell={(e) => updateCell(e.detail.outputId, e.detail.patch)} />
                </div>

                <div class="detail-footer">
                    <div class="transition">
                        <span class="label">{t("looks.transition")}</span>
                        <MaterialSlider value={draft.transitionMs ?? 1000} min={0} max={5000} step={100} style="flex: 1;" on:change={onTransitionChange} />
                        <span class="value">{((draft.transitionMs ?? 1000) / 1000).toFixed(1)} s</span>
                    </div>

                    <MaterialButton variant="contained" icon="play" on:click={makeLive}>
                        {t("looks.make_live")}
                    </MaterialButton>
                </div>
            {:else}
                <p class="hint">{t("looks.no_screens")}</p>
            {/if}
        </div>
    </div>
</Modal>

<style>
    .looks-window {
        display: flex;
        flex: 1;
        min-height: 0;
        width: 100%;
    }

    /* Columna izquierda */

    .sidebar {
        display: flex;
        flex-direction: column;
        flex: 0 0 200px;
        width: 200px;

        background-color: var(--primary-darker);
        border-inline-end: 1px solid var(--border-color, var(--primary-lighter));
    }

    .live {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        font-size: 0.85em;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }

    .presets-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px 4px;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.6;
    }

    .presets {
        flex: 1;
        overflow-y: auto;
        padding: 2px 6px;
    }

    .preset {
        display: flex;
        align-items: center;
        gap: 6px;

        padding: 7px 8px;
        border-radius: var(--radius, 6px);
        cursor: pointer;
        font-size: 0.9em;
    }
    .preset:hover {
        background-color: var(--primary-lightest, rgb(255 255 255 / 0.06));
    }
    .preset.selected {
        background-color: var(--secondary);
    }
    .preset .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dot {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: #4caf50;
    }
    .preset.selected .dot {
        background-color: #fff;
    }

    .preset-actions {
        display: flex;
        gap: 4px;
        padding: 8px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
    }

    /* Detalle */

    .detail {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        min-height: 0;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }

    .name-input {
        flex: 1;
        padding: 6px 8px;
        font-size: 0.95em;
        color: var(--text);
        background-color: var(--primary-darkest);
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 6px);
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 12px 14px;
    }

    .detail-footer {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 10px 14px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
    }

    .transition {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        font-size: 0.85em;
    }

    .transition .label {
        opacity: 0.7;
        white-space: nowrap;
    }

    .transition .value {
        min-width: 44px;
        text-align: end;
        opacity: 0.85;
    }

    .hint {
        padding: 20px;
        font-size: 0.85em;
        opacity: 0.5;
    }
</style>
