<script lang="ts">
    import { fade } from "svelte/transition"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activeProfile, profiles, saved, topContextActive, windowState } from "../../stores"
    import { translateText } from "../../utils/language"
    import { initializeClosing } from "../../utils/save"
    import ContextChild from "../context/ContextChild.svelte"
    import ContextItem from "../context/ContextItem.svelte"
    import { contextMenuItems, contextMenuLayouts } from "../context/contextMenus"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { activeLook, looks, activePopup } from "../../stores"
    import { getAllNormalOutputs, getAllStageOutputs, toggleOutputs } from "../../components/helpers/output"
    import { applyLook } from "../../components/helpers/looks"
    import type { ContextMenuItem } from "../context/contextMenus"

    const menus: string[] = ["file", "edit", "view", "help", "screens"]

    let activeID: null | string = null
    let menuElem: HTMLDivElement | null = null
    let activeMenu: string[] = []
    let x = 0
    let y = 25

    $: maximized = !!$windowState.maximized

    const screensMenu = ["screens_toggle_audience", "screens_toggle_stage", "SEPARATOR", "screens_config", "screens_looks", "SEPARATOR", "screens_live"]

    // F10.7 — items del menú "Pantallas" definidos acá porque viven fuera de
    // `contextMenus.ts` (herramienta de escritorio, no de la lista de contextos).
    const screensMenuItems: { [key: string]: ContextMenuItem } = {
        screens_toggle_audience: { label: "screen_config.show_audience", shortcuts: ["Ctrl+1"], icon: "outputs" },
        screens_toggle_stage: { label: "screen_config.show_stage", shortcuts: ["Ctrl+2"], icon: "stage" },
        screens_config: { label: "screen_config.configure", icon: "settings" },
        screens_looks: { label: "screen_config.manage_looks", icon: "styles" },
        screens_live: { label: "menu.live", icon: "live" }
    }

    function menu(e: any) {
        const id: string = e.target.id
        topContextActive.set(activeID !== id)
        activeID = activeID === id ? null : id

        if (activeID === null) return
        x = e.target.offsetLeft
        activeMenu = id === "screens" ? screensMenu : contextMenuLayouts[id] || []
    }

    function closeTopMenu() {
        topContextActive.set(false)
        activeID = null
    }

    function toggleScreens(type: "audience" | "stage") {
        const ids = (type === "stage" ? getAllStageOutputs() : getAllNormalOutputs()).map((a) => a.id)
        if (ids.length) toggleOutputs(ids)
        closeTopMenu()
    }

    const click = (e: MouseEvent) => {
        if (e.target?.closest(".menu") || e.target?.closest(".menus")) return

        topContextActive.set(false)
    }

    $: if ($topContextActive === false) activeID = null

    const move = (e: any) => {
        if (!$topContextActive || activeID === e.target.id) return
        ;(document.activeElement as any)?.blur()
        menu(e)
    }
</script>

<svelte:window on:click={click} on:contextmenu={click} />

<main bind:clientHeight={y}>
    {#if $topContextActive && activeID !== "screens"}
        <div bind:this={menuElem} class="contextMenu menu" style="inset-inline-start: {x}px; top: {y}px;" transition:fade={{ duration: 50 }}>
            {#key activeMenu}
                {#each activeMenu as id}
                    {#if id === "SEPARATOR"}
                        <hr />
                    {:else if contextMenuItems[id]?.items}
                        <ContextChild {id} topBar />
                    {:else}
                        <ContextItem {id} topBar />
                    {/if}
                {/each}
            {/key}
        </div>
    {/if}

    <div class="nocontext menus" on:mousemove={move} on:click={menu} on:contextmenu={menu}>
        {#each menus as menu}
            <Button id={menu} active={activeID === menu} red={menu === "file" && !$saved}>
                <T id="titlebar.{menu}" />
            </Button>
        {/each}
    </div>

    {#if activeID === "screens"}
        <div bind:this={menuElem} class="contextMenu menu" style="inset-inline-start: {x}px; top: {y}px;" transition:fade={{ duration: 50 }}>
            <ContextItem contextElem={menuElem} topBar id="screens_toggle_audience" menu={screensMenuItems.screens_toggle_audience} on:click={() => toggleScreens("audience")} />
            <ContextItem contextElem={menuElem} topBar id="screens_toggle_stage" menu={screensMenuItems.screens_toggle_stage} on:click={() => toggleScreens("stage")} />
            <hr />
            <ContextItem
                contextElem={menuElem}
                topBar
                id="screens_config"
                menu={screensMenuItems.screens_config}
                on:click={() => {
                    activePopup.set("screen_config")
                    closeTopMenu()
                }}
            />
            <ContextItem
                contextElem={menuElem}
                topBar
                id="screens_looks"
                menu={screensMenuItems.screens_looks}
                on:click={() => {
                    activePopup.set("looks")
                    closeTopMenu()
                }}
            />
            <hr />
            <!-- "En vivo": submenu propio (los looks se cargan del store, no de contextMenus.ts) -->
            <div class="liveGroup">
                <ContextItem contextElem={menuElem} topBar id="screens_live" menu={screensMenuItems.screens_live} />
                <div class="liveItems">
                    {#if Object.keys($looks || {}).length}
                        {#each Object.entries($looks || {}) as [lookId, look]: any}
                            <button
                                class="liveLook"
                                class:active={$activeLook === lookId}
                                on:click={() => {
                                    applyLook(lookId)
                                    closeTopMenu()
                                }}
                            >
                                <span>{look?.name || lookId}</span>
                                {#if $activeLook === lookId}<span class="check">✓</span>{/if}
                            </button>
                        {/each}
                    {:else}
                        <span class="empty">({translateText("looks.no_looks")})</span>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    {#if $activeProfile && Object.keys($profiles).filter((a) => a !== "admin").length > 1}
        <div class="info">
            <T id="profile.profile" />: {$profiles[$activeProfile]?.name || "—"}
        </div>
    {/if}

    <div class="window">
        <Button on:click={() => sendMain(Main.MINIMIZE)} center>
            <Icon id="remove" size={1.2} white />
        </Button>
        <Button on:click={() => sendMain(Main.MAXIMIZE)} style="transform: rotate(180deg);" center>
            <Icon id={maximized ? "maximized" : "unmaximized"} size={maximized ? 0.8 : 0.9} white />
        </Button>
        <Button id="close" on:click={() => initializeClosing()} center>
            <Icon id="close" size={1.2} white />
        </Button>
    </div>
</main>

<style>
    main :global(button) {
        opacity: 0.7;
        cursor: default !important;
        font-weight: normal !important;
    }

    main {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
        font-size: 0.9em;
        height: 25px;
        -webkit-app-region: drag;
    }

    div,
    div :global(div) {
        display: flex;
        -webkit-app-region: no-drag;
    }

    .window :global(button) {
        width: 48px;
    }

    /* disable styled border radius */
    div :global(button),
    div :global(.menu) {
        border-radius: 0px !important;
    }

    /* close */
    .window :global(#close):hover {
        background-color: var(--red);
    }
    .window :global(#close):active,
    .window :global(#close):focus {
        background-color: var(--red);
    }
    .window :global(#close):hover :global(svg) {
        fill: white;
    }

    /* menu */
    .menu {
        display: flex;
        flex-direction: column;
        position: fixed;
        min-width: 250px;
        background-color: var(--primary-darker);
        box-shadow: var(--shadow-float);
        border-radius: 4px;
        padding: 8px 0;
        z-index: 6000;
        -webkit-app-region: no-drag;
    }

    hr {
        margin: 8px 0;
        height: 1px;
        border: none;
        background-color: var(--primary);
    }

    .check {
        opacity: 0.9;
    }

    /* "En vivo" (F10.7): submenu de looks cargado del store */
    .liveGroup {
        display: flex;
        flex-direction: column;
    }

    .liveItems {
        display: flex;
        flex-direction: column;
        padding-inline-start: 22px;
    }

    .liveLook {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 16px;
        border: none;
        background: none;
        color: var(--text);
        font: inherit;
        cursor: pointer;
        text-align: start;
    }

    .liveLook:hover {
        background-color: rgb(0 0 0 / 0.2);
    }

    .liveLook.active {
        color: var(--secondary);
    }

    .empty {
        padding: 6px 16px;
        opacity: 0.5;
        font-style: italic;
    }

    /* info */

    .info {
        pointer-events: none;

        font-size: 0.8em;
        opacity: 0.7;

        display: flex;
        align-items: center;
    }
</style>
