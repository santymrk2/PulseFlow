<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activePage, activePopup, activeStage, dictionary, selected, stageShows } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getDynamicIds, replaceDynamicValues } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingBar from "../../lib/components/ui/floating-bar/floating-bar.svelte"
    import Menu from "../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../lib/components/ui/menu/menu-separator.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import { addStageItem } from "../stage/stage"
    import { addItem } from "./scripts/itemHelpers"
    import { slideItems, stageItems, type AddItem } from "./values/items"

    export let isLocked = false

    // Barra de herramientas para agregar ítems: los botones que entran en el ancho disponible van a la vista y el resto
    // (más los que traen submenú, como "Más" o los valores dinámicos) se agrupan en el menú "⋯".
    let menuOpen = false
    let barWidth = 0
    let host: HTMLDivElement | null = null

    $: isStage = $activePage === "stage"

    $: stageId = $activeStage.id || ""
    $: stageShow = $stageShows[stageId] || {}
    $: slideTextItemsCount = Object.values(stageShow?.items || {}).filter((a) => a.type === "slide_text").length

    $: groupedItems = (isStage ? stageItems : slideItems).map((group) => {
        return {
            ...group,
            items: group.items.map((item) => {
                if (item.id === "slide_text") {
                    return {
                        ...item,
                        label: slideTextItemsCount === 1 ? "stage.next_slide_text" : "items.slide_text",
                        suffix: slideTextItemsCount > 1 ? ` (+${slideTextItemsCount})` : ""
                    }
                }

                // Stage textbox quick add dynamic values - we can't have all values anyway, this would just be some common ones
                if (item.id === "dynamic_values") {
                    const excludeValues = ["time_", "exif_", "audio_", "meta_", "slide_text_", "show_text_full", "slide_group_text", "slide_group_color", "slide_group_next_color", "slide_group_upcoming_color", "interaction_", "timer_m", "timer_s"]
                    const ref = { type: "stage" }
                    const children = getDynamicIds(false, "dropdown")
                        .filter((id) => !excludeValues.find((v) => id.includes(v)))
                        .map((id) => {
                            const dynamicId = `{${id}}`
                            const value = replaceDynamicValues(dynamicId, ref).slice(0, 30)
                            return {
                                id: dynamicId,
                                label: dynamicId,
                                icon: "",
                                title: `<b>${dynamicId}</b><br>${value}`,
                                data: value
                            }
                        })
                    return { ...item, children }
                }

                return item
            })
        }
    })

    function handleAdd(type: any) {
        menuOpen = false

        if (isStage) {
            if (typeof type === "string" && type.startsWith("{")) {
                addStageItem("text", type)
            } else {
                addStageItem(type)
            }
        } else {
            if (type === "icon") {
                selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            } else {
                const textVal = type === "text" && $activeEdit.type === "template" ? translateText("example.text", $dictionary) : ""
                addItem(type, null, {}, textVal)
            }
        }
    }

    // ancho disponible = el del contenedor del editor (la barra va centrada abajo)
    onMount(() => {
        const parent = host?.parentElement
        if (!parent) return
        const observer = new ResizeObserver(() => (barWidth = parent.clientWidth))
        observer.observe(parent)
        barWidth = parent.clientWidth
        return () => observer.disconnect()
    })

    $: flat = groupedItems.flatMap((group) => group.items) as AddItem[]
    $: direct = flat.filter((item) => !item.children)
    $: submenus = flat.filter((item) => item.children?.length)

    // con etiqueta ~88 px por botón; si no entran todos, sólo íconos (~38 px) y el resto va al "⋯"
    const LABELED = 88
    const COMPACT = 38
    const MORE_BUTTON = 44
    $: available = Math.max(0, barWidth - 48)
    $: labeled = direct.length * LABELED + (submenus.length ? MORE_BUTTON : 0) <= available
    $: slots = labeled ? direct.length : Math.max(1, Math.floor((available - MORE_BUTTON) / COMPACT))
    $: visibleItems = direct.slice(0, slots)
    $: overflowItems = direct.slice(slots)
    $: hasMore = overflowItems.length > 0 || submenus.length > 0
</script>

<div bind:this={host} class="hidden"></div>

{#if !isLocked && (isStage ? $activeStage.id : $activeEdit.slide !== undefined || $activeEdit.type === "overlay" || $activeEdit.type === "template")}
    <FloatingBar side="center" style="max-width: calc(100% - 24px);overflow: visible;">
        {#each visibleItems as item}
            <Button class="addItem" title={item.title || item.label} on:click={() => handleAdd(item.id)} white>
                <Icon id={item.icon} size={1.1} white />
                {#if labeled}<span class="label"><T id={item.label} />{item.suffix || ""}</span>{/if}
            </Button>
        {/each}

        {#if hasMore}
            <div class="more">
                <Button title="main.more" on:click={() => (menuOpen = !menuOpen)} isActive={menuOpen} white>
                    <Icon id="more" size={1.1} white />
                </Button>
                <Menu open={menuOpen} onclose={() => (menuOpen = false)} class="more-menu">
                    {#each overflowItems as item}
                        <MenuItem onclick={() => handleAdd(item.id)}>{translateText(item.label)}{item.suffix || ""}</MenuItem>
                    {/each}
                    {#each submenus as group}
                        {#if overflowItems.length || group !== submenus[0]}<MenuSeparator />{/if}
                        {#each group.children || [] as sub}
                            <MenuItem onclick={() => handleAdd(sub.id)} title={sub.title || ""}>
                                {translateText(sub.label)}{sub.suffix || ""}
                                {#if sub.data}<span class="preview">{sub.data}</span>{/if}
                            </MenuItem>
                        {/each}
                    {/each}
                </Menu>
            </div>
        {/if}
    </FloatingBar>
{/if}

<style>
    .more {
        position: relative;
        display: flex;
    }
    /* el menú se abre hacia arriba: la barra está pegada abajo */
    .more :global(.more-menu) {
        top: auto;
        bottom: 100%;
        margin-top: 0;
        margin-bottom: 6px;
        max-height: 50vh;
        overflow-y: auto;
    }
    .preview {
        margin-inline-start: 8px;
        font-size: var(--text-xs);
        opacity: 0.5;
        max-width: 90px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .label {
        font-size: var(--text-sm);
        white-space: nowrap;
    }
    :global(.addItem) {
        gap: 6px;
    }
</style>
