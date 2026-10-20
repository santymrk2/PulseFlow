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
    import Slider from "../../lib/components/ui/slider/slider.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import ListRow from "../../lib/components/ui/list-row/list-row.svelte"
    import SectionHeader from "../../lib/components/ui/section-header/section-header.svelte"
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
        <!-- Columna izquierda (F12.4): en vivo + lista de looks + "Nuevo look" abajo -->
        <div class="sidebar">
            <div class="live">
                <Icon id="play" size={0.9} white />
                <span>{t("looks.live")}: <strong>{$looks[$activeLook]?.name || "—"}</strong></span>
            </div>

            <SectionHeader>{t("looks.presets")}</SectionHeader>

            <div class="presets">
                {#each presetIds as id (id)}
                    {@const look = $looks[id]}
                    <ListRow
                        active={id === selectedLook}
                        onclick={() => (selectedLook = id)}
                        oncontextmenu={(e) => {
                            e.preventDefault()
                            renamePreset(id)
                        }}
                    >
                        {look.name}
                        {#snippet trailing()}
                            {#if id === $activeLook}<span class="dot"></span>{/if}
                        {/snippet}
                    </ListRow>
                {/each}
            </div>

            <div class="sidebar-footer">
                <Button variant="outline" size="sm" class="w-full" onclick={createPreset}>+ {t("looks.new")}</Button>
            </div>
        </div>

        <!-- Detalle del look: grilla pantalla × capa -->
        <div class="detail">
            {#if !audienceScreens.length}
                <p class="hint">{t("looks.no_screens")}</p>
            {:else if draft}
                <div class="detail-header">
                    <input class="name-input" type="text" value={draft.name} on:input={(e) => updateDraft({ name: e.currentTarget.value })} />
                    <Button variant={isDirty ? "default" : "ghost"} size="sm" disabled={!isDirty} onclick={saveDraft}>{t("actions.save")}</Button>
                </div>

                <div class="scroll">
                    <LookGrid screens={audienceScreens} {draft} on:cell={(e) => updateCell(e.detail.outputId, e.detail.patch)} />
                </div>
            {:else}
                <p class="hint">{t("looks.no_screens")}</p>
            {/if}
        </div>
    </div>

    <svelte:fragment slot="footer">
        {#if draft}
            <div class="transition">
                <span class="label">{t("looks.transition")}</span>
                <Slider value={draft.transitionMs ?? 1000} min={0} max={5000} step={100} style="flex: 1;" on:change={onTransitionChange} />
                <span class="value">{((draft.transitionMs ?? 1000) / 1000).toFixed(1)} s</span>
            </div>
        {/if}
        <Button variant="ghost" size="sm" disabled={!selectedLook} onclick={() => renamePreset(selectedLook)}>{t("actions.rename")}</Button>
        <Button variant="ghost" size="sm" disabled={!selectedLook} onclick={() => duplicatePreset(selectedLook)}>{t("actions.duplicate")}</Button>
        <Button variant="ghost" size="sm" disabled={!selectedLook || presetIds.length <= 1} onclick={() => removePreset(selectedLook)}>{t("actions.delete")}</Button>
        <Button variant="default" size="sm" disabled={!draft} onclick={makeLive}>{t("looks.make_live")}</Button>
    </svelte:fragment>
</Modal>

<style>
    .looks-window {
        display: flex;
        flex: 1;
        min-height: 0;
        width: 100%;
    }

    .sidebar {
        display: flex;
        flex-direction: column;
        flex: 0 0 240px;
        width: 240px;
        min-height: 0;
        background-color: var(--primary-darker);
        border-inline-end: 1px solid var(--border-color, var(--primary-lighter));
    }

    .live {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        font-size: 12px;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
        min-width: 0;
    }
    .live span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .presets {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 0;
    }

    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--success);
    }

    .sidebar-footer {
        padding: 8px;
        border-top: 1px solid var(--border-color, var(--primary-lighter));
    }

    .detail {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .name-input {
        flex: 1;
        min-width: 0;
        height: 32px;
        padding: 0 8px;
        background-color: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
    }

    .hint {
        opacity: 0.6;
        font-size: 13px;
    }

    .transition {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
        font-size: 12px;
    }
    .transition .label {
        flex-shrink: 0;
        color: var(--text);
        opacity: 0.8;
    }
    .transition .value {
        flex-shrink: 0;
        width: 44px;
        text-align: end;
        opacity: 0.8;
    }
</style>
