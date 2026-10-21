<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { SelectIds } from "../../../types/Main"
    import { actions, activeActionTagFilter, activeDrawerTab, activePlaylist, activeVariableTagFilter, activeTimerTagFilter, audioPlaylists, drawerTabsData, outputs, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { customIconsColors } from "../../values/customIcons"
    import { getActionIcon } from "../actions/actions"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getFirstActiveOutput } from "../helpers/output"
    import { metadataDisplayValues } from "../helpers/show"
    import HiddenInput from "../../lib/components/ui/hidden-input/hidden-input.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import SelectElem from "../system/SelectElem.svelte"

    export let category: any

    $: id = category.id
    $: label = category.label
    $: icon = category.icon
    $: option = category.option
    $: action = category.action || ""
    $: template = category.template || ""
    $: metadata = category.metadata || ""
    $: count = category.count || 0
    $: readOnly = category.readOnly || false
    $: customIcon = category.customIcon || false
    $: boxedIcon = category.boxedIcon || false

    export let parentId = ""
    export let isSubmenu = false
    $: submenu = category.submenu || {}

    export let active: string

    $: submenuActive = isSubmenu ? (active === "actions" ? $activeActionTagFilter.includes(id) : active === "variables" ? $activeVariableTagFilter.includes(id) : active === "timer" ? $activeTimerTagFilter.includes(id) : false) : false
    $: isActive = submenuActive || active === id

    $: output = getFirstActiveOutput($outputs)
    $: showOutline = drawerId === "scripture" ? (output?.out?.slide as any)?.categoryId === id : drawerId === "audio" ? $activePlaylist?.id === id : false

    $: drawerId = $activeDrawerTab
    $: selectId = `category_${drawerId}${drawerId === "scripture" ? "___" + icon : ""}` as SelectIds

    const dispatch = createEventDispatcher()
    function click(e: any) {
        const { ctrl, shift } = e.detail
        if (ctrl) return

        if (category.openTrigger) category.openTrigger(id, shift)
        if (shift) return

        drawerTabsData.update((a) => {
            a[drawerId].activeSubTab = parentId || id
            if (isSubmenu) a[drawerId].activeSubmenu = id
            else delete a[drawerId].activeSubmenu
            return a
        })
    }

    function dblclick() {
        if (category.onDoubleClick) category.onDoubleClick()
    }

    function rename(e: any) {
        dispatch("rename", { id, value: e.detail.value })
    }

    const defaultFolders = ["all", "unlabeled", "number", "favourites", "effects_library", "effects", "online", "inputs", "metronome"]
    const tabsWithCategories = ["shows", "media", "audio", "overlays", "templates", "scripture"]

    $: noEdit = !tabsWithCategories.includes(drawerId) || defaultFolders.includes(id)
    $: className = noEdit ? "" : $audioPlaylists[id] ? "context #playlist" : `context #category_${drawerId}_button${readOnly ? "_readonly" : ""}`

    // drag and drop audio playlists
    $: draggable = !!(drawerId === "audio" && $audioPlaylists[id])

    // SUB MENU

    $: openedSubmenus = $drawerTabsData[drawerId]?.openedSubmenus || []
    $: submenuOpened = openedSubmenus.includes(id)

    function openSubMenu() {
        drawerTabsData.update((a) => {
            if (!a[drawerId]) return a
            let opened = clone(openedSubmenus)

            let existingIndex = opened.findIndex((menuId) => menuId === id) ?? -1
            if (existingIndex < 0) opened.push(id)
            else {
                opened.splice(existingIndex, 1)
                delete a[drawerId].activeSubmenu
                if (category.openTrigger) category.openTrigger(id)
            }

            a[drawerId].openedSubmenus = opened
            return a
        })
    }
</script>

<SelectElem style="width: 100%;" id={selectId} selectable={!noEdit} {draggable} borders="center" trigger="column" data={id}>
    <div class="row">
        <Button class={className} style="width: 100%;font-weight: normal;padding: 0 {boxedIcon ? 0.64 : 0.8}em;" {isActive} {showOutline} on:click={click} on:dblclick={dblclick} tab>
            <div style="max-width: 85%;{boxedIcon ? 'gap: 9px;' : ''}" data-title={translateText(label)}>
                <Icon id={icon} size={isSubmenu ? 0.85 : 1} color={isSubmenu ? category.color : boxedIcon ? customIconsColors[icon] || "" : ""} white custom={customIcon} boxed={isSubmenu || boxedIcon} />

                {#if noEdit || isSubmenu}
                    <p style="margin: {isSubmenu ? 3 : 5}px;">
                        {#if label}
                            {translateText(label)}
                        {:else}
                            <span style="opacity: 0.5;font-style: italic;pointer-events: none;">{translateText("main.unnamed")}</span>
                        {/if}
                    </p>
                {:else}
                    <HiddenInput value={translateText(label)} id="category_{drawerId}_{id}" on:edit={rename} />
                {/if}
            </div>

            <div class="icons">
                {#if option}
                    <span style="padding: 0 2px;{option.style}" data-title={translateText(option.title)}>
                        <Icon id={option.icon} size={0.8} white />
                    </span>
                {/if}
                {#if metadata}
                    <span style="padding: 0 2px;" data-title={translateText(`tools.metadata: <b>${metadataDisplayValues.find((a) => a.id === metadata)?.name}</b>`)}>
                        <Icon id="info" size={0.8} white />
                    </span>
                {/if}
                {#if template && $templates[template]}
                    <span style="padding: 0 2px;" data-title={translateText(`info.template: <b>${$templates[template].name}</b>`)}>
                        <Icon id="templates" size={0.8} white />
                    </span>
                {/if}
                {#if action && $actions[action]}
                    <span style="padding: 0 2px;" data-title={translateText(`popup.action: <b>${$actions[action].name}</b>`)}>
                        <Icon id={getActionIcon(action)} size={0.8} white />
                    </span>
                {/if}

                {#if count}
                    <span class="count" style={translateText(label).length > 25 ? "min-width: 10px;" : ""}>{count}</span>
                {/if}
            </div>

            <!-- SUB MENU -->
            {#if !isSubmenu && submenu?.options?.length}
                <Button on:click={openSubMenu} style="border-left: 1px solid var(--primary-lighter);padding: 0.8em;position: absolute;right: 0;">
                    {#if submenuOpened}
                        <Icon id="arrow_down" size={1.4} />
                    {:else}
                        <Icon id="arrow_right" size={1.4} white />
                    {/if}
                </Button>
            {/if}
        </Button>
    </div>
</SelectElem>

{#if !isSubmenu && submenuOpened && submenu?.options?.length}
    <div class="submenus">
        {#each submenu.options as option}
            <svelte:self parentId={id} category={option} {active} isSubmenu />
        {/each}
    </div>
{/if}

<style>
    div {
        display: flex;
        align-items: center;
        gap: 10px;

        width: 100%;
    }

    /* filas planas de 28px: hover y activa como en LIBRARIES */
    .row > :global(button.tab) {
        height: 28px;
        min-height: 28px;
        border-radius: 0 !important;
        border-left: 2px solid transparent !important;
    }
    .row > :global(button.tab.isActive) {
        background-color: var(--secondary-opacity) !important;
        border-left-color: var(--secondary) !important;
    }
    .row > :global(button.tab):not(:disabled):not(.isActive):hover {
        background-color: var(--hover, var(--bg-hover)) !important;
    }

    div :global(input) {
        padding: 6.5px;
    }

    .count {
        opacity: 0.5;
        font-size: 0.8em;
        min-width: 28px;
        text-align: end;
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }

    .icons {
        display: flex;
        align-items: center;
        gap: 0;
        width: auto;

        opacity: 0.8;
    }

    .submenus {
        border-top: 1px solid var(--primary-lighter);

        /* margin-left: 20px; */
        border-inline-start: 8px solid var(--primary-darkest);

        display: flex;
        flex-direction: column;
        gap: 0;
    }
</style>
