<script lang="ts">
    import { onDestroy } from "svelte"
    import type { DrawerTabIds } from "../../../types/Tabs"
    import { activeDrawerTab, activeEdit, activePage, activeShow, audioFolders, audioPlaylists, categories, drawer, drawerOpenedInEdit, drawerTabsData, focusMode, mediaFolders, mediaOptions, os, overlayCategories, previousShow, scriptures, selected, templateCategories } from "../../stores"
    import { DEFAULT_DRAWER_HEIGHT, DEFAULT_WIDTH, MENU_BAR_HEIGHT } from "../../utils/common"
    import { startResizing, stopResizing } from "../../utils/cursor"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { getNormalizedKey } from "../../utils/shortcuts"
    import { isTypingTarget } from "../../utils/shortcutsHelper"
    import { drawerTabs } from "../../values/tabs"
    import Content from "../drawer/Content.svelte"
    import Navigation from "../drawer/Navigation.svelte"
    import { keysToID } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import Button from "../../lib/components/ui/button/button.svelte"
    import Slider from "../../lib/components/ui/slider/slider.svelte"
    import Resizeable from "../system/Resizeable.svelte"
    import Info from "./info/Info.svelte"
    import { getBreadcrumbs } from "./breadcrumb"

    const minHeight = 40
    const topHeight = 48 // Top.svelte
    let maxHeight = window.innerHeight - topHeight - ($os.platform === "win32" ? MENU_BAR_HEIGHT - 0.3 : 0)
    $: height = $drawer.height

    let move = false
    let mouse: null | { x: number; y: number; offsetY: number } = null
    function mousedown(e: any) {
        startResizing("ns-resize")

        maxHeight = window.innerHeight - topHeight - ($os.platform === "win32" ? MENU_BAR_HEIGHT - 0.3 : 0)
        mouse = {
            x: e.clientX,
            y: e.clientY,
            offsetY: window.innerHeight - height - e.clientY
        }
    }

    // open drawer if autoclosed
    $: if ($activePage === "show" && $drawer.autoclosed) setTimeout(() => drawer.set({ height: $drawer.stored ?? DEFAULT_DRAWER_HEIGHT, stored: null }), 100)

    let animFrame: number | null = null
    function mousemove(e: any) {
        if (!mouse) return

        if ($selected?.id || $selected?.data?.length) selected.set({ id: null, data: [] })

        if (animFrame) return
        animFrame = requestAnimationFrame(() => {
            animFrame = null
            if (!mouse) return

            const newHeight = getHeight(window.innerHeight - e.clientY - mouse.offsetY)
            if (newHeight !== $drawer.height) {
                drawer.set({ height: newHeight, stored: null })

                const isClosed = newHeight <= minHeight
                if (isClosed) drawerOpenedInEdit.set(false)
                else if ($activePage === "edit") drawerOpenedInEdit.set(true)
            }
        })
    }

    function getHeight(height: number) {
        if (height < minHeight * 2) return minHeight
        if (height > maxHeight) return maxHeight
        move = true
        return height
    }

    $: storeHeight = $drawer.stored
    function click(e: any) {
        if ((height > minHeight && e?.target?.closest("button")) || move || e?.target instanceof HTMLInputElement) {
            move = false
            return
        }

        if (height > minHeight) {
            // close drawer
            if (e === null || e?.target.classList.contains("top") || e?.target?.closest("#" + $activeDrawerTab)) closeDrawer()
            drawerOpenedInEdit.set(false)
            return
        }

        // open drawer
        drawer.set({ height: storeHeight === null || storeHeight < DEFAULT_DRAWER_HEIGHT ? DEFAULT_DRAWER_HEIGHT : storeHeight, stored: null })
        if ($activePage === "edit") drawerOpenedInEdit.set(true)

        // if drawer is closed when searching, set category to "all"
        if (e === null && ["shows", "overlays", "templates", "media", "audio"].includes($activeDrawerTab)) {
            if ($activeDrawerTab === "media") mediaOptions.update((a) => ({ ...a, view: "all" }))
            drawerTabsData.update((a) => {
                a[$activeDrawerTab].activeSubTab = "all"
                return a
            })
        }
    }

    function closeDrawer() {
        drawer.set({ height: minHeight, stored: height })
        drawerOpenedInEdit.set(false)
    }

    function mouseup(e: any) {
        if (animFrame) {
            cancelAnimationFrame(animFrame)
            animFrame = null
        }
        if (mouse) {
            stopResizing()
            mouse = null
        }
        if (!e.target.closest(".top")) move = false
    }

    onDestroy(() => {
        if (animFrame) cancelAnimationFrame(animFrame)
        if (mouse) stopResizing()
    })

    $: activeTab = $activeDrawerTab
    function openDrawerTab(tab: { id: string; name: string; icon: string }) {
        const newId = tab.id as DrawerTabIds
        if ($activeDrawerTab === newId) return

        // open visually immediately
        activeTab = newId

        // allow click event first
        setTimeout(() => {
            activeDrawerTab.set(newId)
        }, 10)
    }

    function keydown(e: KeyboardEvent) {
        if (e.shiftKey || e.altKey) return

        const ctrlKey = e.ctrlKey || e.metaKey ? getNormalizedKey(e) : ""

        if (ctrlKey === "d" && !isTypingTarget(document.activeElement)) {
            if (!$selected?.id && !$activeEdit.items.length) click(null)
        }
    }

    $: if ($activeShow?.type === undefined || $activeShow?.type === "show") previousShow.set(JSON.stringify($activeShow))

    $: tabs = keysToID(drawerTabs)

    const hiddenInFocusMode = ["templates", "calendar"]

    // F11.2 — migas de navegación ("Medios › Carpeta")
    $: crumbs = getBreadcrumbs($activeDrawerTab, $drawerTabsData[$activeDrawerTab]?.activeSubTab || undefined, {
        categories: $categories,
        mediaFolders: $mediaFolders,
        audioFolders: $audioFolders,
        audioPlaylists: $audioPlaylists,
        overlayCategories: $overlayCategories,
        templateCategories: $templateCategories,
        scriptures: $scriptures
    })

    // F11.2 — pie del cajón: agregar, vista grilla/lista y tamaño
    $: showViewToggle = $activeDrawerTab === "media"
    $: showSizeSlider = ["media", "overlays", "templates"].includes($activeDrawerTab) || ($activeDrawerTab === "functions" && $drawerTabsData.functions?.activeSubTab === "scenes")

    function toggleView() {
        mediaOptions.update((a) => ({ ...a, mode: a.mode === "grid" ? "list" : "grid" }))
    }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} on:keydown={keydown} />

<!-- <Resizeable id="drawer" side="bottom" minWidth={50}> -->
<section class="drawer" style="height: {height}px">
    <div class="handle" class:resizing={mouse} title={translateText("_ resizable")} on:mousedown={mousedown} />
    <div
        class="top context #drawer_top"
        on:click={click}
        on:keydown={() => {
            // does not work and prevents search input keys
            // if (e.key === "Enter" || e.key === " ") {
            //     e.preventDefault()
            //     click(e)
            // }
        }}
    >
        <!-- role="button"
        tabindex="0" -->
        <span class="tabs">
            {#each tabs as tab, i}
                <!-- Shows no tiene pestaña: se entra por LIBRARY (columna izquierda) -->
                {#if tab.id !== "shows" && $drawerTabsData[tab.id]?.enabled !== false && getAccess(tab.id).global !== "none" && (!$focusMode || !hiddenInFocusMode.includes(tab.id))}
                    <!-- overflow: unset; -->
                    <Button id={tab.id} style="border-radius: var(--radius) var(--radius) 0 0;border-bottom: 2px solid var(--primary);padding: 0 0.75em;height: 100%;" class="context #drawer_top" title="<b>{tab.name.split('.')[0]}.{tab.name.split('.')[1]}</b>{tab.title ? `\n${tab.title}` : ''} [Ctrl+{i + 1}]" isActive={activeTab === tab.id} on:click={() => openDrawerTab(tab)} on:dblclick={closeDrawer}>
                        <Icon id={tab.icon} size={1} white={activeTab === tab.id} />
                    </Button>
                {/if}
            {/each}
        </span>

        <span class="topRight">
            {#if showViewToggle}
                <Button on:click={toggleView} title="show.{$mediaOptions.mode}">
                    <Icon size={1.2} id={$mediaOptions.mode} white />
                </Button>
            {/if}
            {#if showSizeSlider}
                <Slider style="width: 110px;" bind:value={$mediaOptions.columns} min={2} max={10} invert />
            {/if}
        </span>
    </div>

    {#if crumbs.length}
        <div class="breadcrumbs">
            {#each crumbs as crumb, i}
                {#if i}<span class="sep">›</span>{/if}
                <span class="crumb" class:current={i === crumbs.length - 1}>{crumb.key ? translateText(crumb.key) : crumb.name || ""}</span>
            {/each}
        </div>
    {/if}

    <div class="content">
        <Resizeable id="leftPanelDrawer">
            <Navigation id={$activeDrawerTab} />
        </Resizeable>
        <Content id={$activeDrawerTab} />
        <Resizeable id="rightPanelDrawer" let:width side="right">
            <div class="right" class:row={width > DEFAULT_WIDTH * 1.8}>
                <Info id={$activeDrawerTab} />
            </div>
        </Resizeable>
    </div>
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100px;
        z-index: 20;

        background-color: var(--primary);

        /* */
    }

    .handle {
        height: 4px;
        flex: none;
        background-color: var(--border-color, var(--primary-lighter));
        cursor: ns-resize;
    }
    .handle.resizing {
        background-color: var(--secondary);
    }

    .top {
        position: relative;
        height: 36px;
        flex: none;
        display: flex;
        justify-content: space-between;

        z-index: 1;
    }

    .top .tabs {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
    }

    .breadcrumbs {
        height: 32px;
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 12px;

        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;

        border-bottom: 1px solid var(--border-color);
    }
    .breadcrumbs .crumb {
        opacity: 0.5;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .breadcrumbs .crumb.current {
        opacity: 1;
    }
    .breadcrumbs .sep {
        opacity: 0.3;
    }

    .topRight {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px;
    }

    .content {
        display: flex;
        flex: 1;
        min-height: 0;
        justify-content: space-between;
    }

    .right {
        display: contents;
    }
    .right.row :global(.scroll.split) {
        flex-direction: row-reverse;
    }
    .right.row :global(.scroll.split .border) {
        border-inline-end: 2px solid var(--border-color, var(--primary-lighter));
        overflow-y: auto;
    }
    /* scripture preview */
    .right.row :global(.scroll.split .zoomed) {
        flex: 1;
    }

    /* labels were removed in F11.2 — tabs are icon-only */
</style>
