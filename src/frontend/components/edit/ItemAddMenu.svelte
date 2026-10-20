<script lang="ts">
    import { fade } from "svelte/transition"
    import { activeEdit, activePage, activePopup, activeStage, ai, dictionary, selected, stageShows } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getDynamicIds, replaceDynamicValues } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingBar from "../../lib/components/ui/floating-bar/floating-bar.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import { addStageItem } from "../stage/stage"
    import { addItem } from "./scripts/itemHelpers"
    import { slideItems, stageItems } from "./values/items"

    export let isLocked = false

    let isOpen = false
    let hoveredId: string | null = null
    let hoveredSubmenu: any[] | null = null
    let hoveredY = 0
    let hoverTimeout: any = null
    let delayedHoverTimeout: any = null

    $: isStage = $activePage === "stage"

    $: if (!isOpen) {
        hoveredSubmenu = null
        hoveredId = null
        clearTimeout(delayedHoverTimeout)
    }

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
        isOpen = false

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

    function handleDoubleClick() {
        if (isOpen) return
        handleAdd(isStage ? "slide_text" : "text")
    }

    function handleMousedown(e: MouseEvent) {
        if (!isOpen) return
        const target = e.target as HTMLElement
        if (!target.closest(".addMenu") && !target.closest(".addButton")) {
            isOpen = false
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (isOpen && e.key === "Escape") {
            isOpen = false
            e.preventDefault()
            e.stopPropagation()
        }
    }
</script>

<svelte:window on:mousedown={handleMousedown} on:keydown|capture={handleKeydown} />

{#if !isLocked && (isStage ? $activeStage.id : $activeEdit.slide !== undefined || $activeEdit.type === "overlay" || $activeEdit.type === "template")}
    {#if isOpen}
        <div class="addMenu" transition:fade={{ duration: 80 }} style="overflow: visible;">
            <div class="menu-content">
                {#each groupedItems as group, i}
                    {#if group.label}
                        <div class="group-label"><T id={group.label} /></div>
                    {:else if i > 0}
                        <div class="group-spacer" />
                    {/if}

                    {#each group.items as item, j}
                        {@const isFirst = i === 0 && j === 0}
                        <div
                            class="item-wrapper"
                            on:mouseenter={(e) => {
                                clearTimeout(hoverTimeout)
                                clearTimeout(delayedHoverTimeout)

                                const target = e.currentTarget
                                const open = () => {
                                    const rect = target.getBoundingClientRect()
                                    const shell = target.closest(".addMenu")
                                    if (!shell) return

                                    const parentRect = shell.getBoundingClientRect()
                                    hoveredSubmenu = item.children || null
                                    hoveredId = item.id
                                    hoveredY = parentRect.bottom - rect.bottom
                                }

                                if (item.children) {
                                    delayedHoverTimeout = setTimeout(open, 120)
                                } else {
                                    hoveredSubmenu = null
                                    hoveredId = null
                                }
                            }}
                            on:mouseleave={() => {
                                clearTimeout(delayedHoverTimeout)
                                hoverTimeout = setTimeout(() => {
                                    hoveredSubmenu = null
                                    hoveredId = null
                                }, 150)
                            }}
                        >
                            <Button class="add-item-button" variant={item.children ? "ghost" : "outline"} on:click={() => (item.children ? null : handleAdd(item.id))} title={item.title || item.label} white={!isFirst}>
                                <Icon id={item.icon} size={1.2} white={!isFirst} />
                                <T id={item.label} />{item.suffix || ""}
                            </Button>
                        </div>
                    {/each}
                {/each}
            </div>

            {#if hoveredSubmenu && hoveredSubmenu.length > 0 && hoveredId}
                <div
                    class="addMenu submenu"
                    transition:fade={{ duration: 80 }}
                    style="bottom: {hoveredY - 6}px;"
                    on:mouseenter={() => clearTimeout(hoverTimeout)}
                    on:mouseleave={() => {
                        hoveredSubmenu = null
                        hoveredId = null
                    }}
                >
                    {#each hoveredSubmenu as subItem}
                        <Button class="add-item-button" variant="outline" on:click={() => handleAdd(subItem.id)} title={subItem.title || subItem.label} white>
                            {#if subItem.icon}<Icon id={subItem.icon} size={1.2} white />{/if}
                            <span class="item-name">
                                {translateText(subItem.label)}{subItem.suffix || ""}
                            </span>
                            {#if subItem.data}<span class="item-preview">{subItem.data}</span>{/if}
                        </Button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    <FloatingBar>
        <Button class="addButton" title={isOpen ? "actions.close" : "edit.add_items"} on:click={() => (isOpen = !isOpen)} on:dblclick={handleDoubleClick}>
            <Icon id="add" size={1} style={isOpen ? "transform: rotate(135deg);" : ""} white />
        </Button>
    </FloatingBar>
{/if}

<style>
    .addMenu {
        position: absolute;
        bottom: 52px;
        right: 12px;

        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 160px;

        background: var(--bg-elevated);
        border-radius: var(--radius-modal);
        border: 1px solid var(--border-strong);
        padding: 4px;
        box-shadow: var(--shadow-float);

        /* over all slide items */
        z-index: 999;
    }

    .menu-content {
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    /* Thinner scrollbar */
    .menu-content::-webkit-scrollbar,
    .submenu::-webkit-scrollbar {
        width: 5px;
    }

    .addMenu :global(.add-item-button) {
        width: 100%;
        flex-shrink: 0;
        justify-content: start;
        padding: 0 8px;
        border-radius: var(--radius);
        min-height: 28px;
        gap: 8px;
    }

    .item-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
    }

    .item-preview {
        font-size: var(--text-xs);
        opacity: 0.5;
        max-width: 70px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-left: auto;
    }

    /* filas sin fondo propio: sólo hover */
    .addMenu :global(.add-item-button),
    .addMenu :global(.add-item-button .surface) {
        backdrop-filter: none !important;
        background: transparent !important;
        border-color: transparent !important;
    }

    .addMenu :global(.add-item-button:hover) {
        background: var(--bg-hover) !important;
    }

    .submenu {
        position: absolute;
        right: calc(100% + 4px);
        width: 260px;
        z-index: 1000;

        max-height: 45vh;

        overflow-y: auto;
        overflow-x: hidden;
    }

    .item-wrapper {
        position: relative;
        display: flex;
        width: 100%;
    }

    .item-wrapper:hover::before {
        content: "";
        position: absolute;
        left: -15px; /* cover the 12px gap */
        right: 0;
        top: 0;
        bottom: 0;
        pointer-events: all;
        z-index: -1;
    }

    .item-wrapper:hover {
        z-index: 1001; /* Above other menu items */
    }

    .group-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-subtle);
        padding: 8px 8px 4px;
    }

    .group-spacer {
        height: 6px;
    }

    /* +/x rotate animation */
    :global(.addButton svg) {
        transition: transform 0.2s ease !important;
    }
</style>
