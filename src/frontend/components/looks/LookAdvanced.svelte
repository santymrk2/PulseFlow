<script lang="ts">
    import { looks } from "../../stores"

    export let lookId: string

    $: look = $looks[lookId]
    $: screens = look?.screens || {}

    function updateCell(outputId: string, path: string, value: any) {
        looks.update((a) => {
            if (!a[lookId]) return a
            if (!a[lookId].screens[outputId]) a[lookId].screens[outputId] = { layers: { media: true, slide: true, overlays: true } }
            a[lookId].screens[outputId][path] = value
            return a
        })
    }
</script>

<div class="adv">
    <div class="title">Más opciones</div>
    <div class="row">
        <div class="label">Fondo</div>
        <div class="inputs">
            {#each Object.keys(screens) as outId}
                <input class="input" placeholder={outId} value={screens[outId]?.background || ""} on:change={(e) => updateCell(outId, "background", (e.target as HTMLInputElement).value || undefined)} />
            {/each}
        </div>
    </div>
    <div class="row">
        <div class="label">Volumen</div>
        <div class="inputs">
            {#each Object.keys(screens) as outId}
                <input class="input" type="number" placeholder={outId} value={screens[outId]?.volume ?? ""} on:change={(e) => updateCell(outId, "volume", (e.target as HTMLInputElement).value === "" ? undefined : Number((e.target as HTMLInputElement).value))} />
            {/each}
        </div>
    </div>
    <div class="row">
        <div class="label">Líneas</div>
        <div class="inputs">
            {#each Object.keys(screens) as outId}
                <input class="input" type="number" placeholder={outId} value={screens[outId]?.lines ?? ""} on:change={(e) => updateCell(outId, "lines", (e.target as HTMLInputElement).value === "" ? undefined : Number((e.target as HTMLInputElement).value))} />
            {/each}
        </div>
    </div>
</div>

<style>
    .adv {
        border: 1px solid var(--border-color, var(--primary-lighter));
        border-radius: var(--radius, 4px);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .title {
        font-size: 0.9em;
        opacity: 0.8;
    }
    .row {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .label {
        width: 80px;
        opacity: 0.8;
        font-size: 0.85em;
    }
    .inputs {
        flex: 1;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .input {
        flex: 1;
        min-width: 80px;
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--border-color, var(--primary-lighter));
        padding: 4px 6px;
        border-radius: var(--radius, 4px);
    }
</style>
