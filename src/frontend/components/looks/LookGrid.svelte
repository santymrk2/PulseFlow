<script lang="ts">
    import { looks, styles, templates } from "../../stores"
    import { lookScreenToStyle } from "../helpers/looks"

    export let lookId: string
    export let audienceOutputs: any[] = []

    $: look = $looks[lookId]
    $: screens = look?.screens || {}

    function updateCell(outputId: string, path: string, value: any) {
        looks.update((a) => {
            if (!a[lookId]) return a
            if (!a[lookId].screens[outputId]) a[lookId].screens[outputId] = { layers: { media: true, slide: true, overlays: true } }
            const cell = a[lookId].screens[outputId]
            if (path.includes(".")) {
                const [p1, p2] = path.split(".")
                cell[p1][p2] = value
            } else {
                cell[path] = value
            }
            return a
        })
    }

    function toggleLayer(outputId: string, layer: string) {
        looks.update((a) => {
            if (!a[lookId]) return a
            if (!a[lookId].screens[outputId]) a[lookId].screens[outputId] = { layers: { media: true, slide: true, overlays: true } }
            a[lookId].screens[outputId].layers[layer] = !a[lookId].screens[outputId].layers[layer]
            return a
        })
    }
</script>

<div class="grid">
    <div class="row header">
        <div class="cell label">Presentación (tema)</div>
        {#each audienceOutputs as out}
            <div class="cell out">{out.name}</div>
        {/each}
    </div>
    <div class="row">
        <div class="cell label">Tema</div>
        {#each audienceOutputs as out}
            <div class="cell">
                <select class="select" value={screens[out.id]?.theme || ""} on:change={(e) => updateCell(out.id, "theme", (e.target as HTMLSelectElement).value || undefined)}>
                    <option value="">⊘</option>
                    {#each Object.entries($templates || {}) as [tid, tpl]}
                        <option value={tid}>{tpl.name || tid}</option>
                    {/each}
                </select>
            </div>
        {/each}
    </div>
    <div class="row">
        <div class="cell label">Slide</div>
        {#each audienceOutputs as out}
            <div class="cell"><input type="checkbox" checked={screens[out.id]?.layers?.slide !== false} on:change={() => toggleLayer(out.id, "slide")} /></div>
        {/each}
    </div>
    <div class="row">
        <div class="cell label">Media</div>
        {#each audienceOutputs as out}
            <div class="cell"><input type="checkbox" checked={screens[out.id]?.layers?.media !== false} on:change={() => toggleLayer(out.id, "media")} /></div>
        {/each}
    </div>
    <div class="row">
        <div class="cell label">Overlays</div>
        {#each audienceOutputs as out}
            <div class="cell"><input type="checkbox" checked={screens[out.id]?.layers?.overlays !== false} on:change={() => toggleLayer(out.id, "overlays")} /></div>
        {/each}
    </div>
</div>

<style>
    .grid {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        overflow: hidden;
    }
    .row {
        display: grid;
        grid-template-columns: 160px repeat(auto-fit, minmax(120px, 1fr));
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }
    .row:last-child {
        border-bottom: none;
    }
    .cell {
        padding: 6px 8px;
        border-right: 1px solid var(--border-color, var(--primary-lighter));
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .cell:last-child {
        border-right: none;
    }
    .label {
        justify-content: flex-start;
        opacity: 0.9;
    }
    .out {
        font-size: 0.9em;
    }
    .select {
        width: 100%;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--border-color, var(--primary-lighter));
        padding: 4px;
        border-radius: var(--radius, 4px);
    }
</style>
