<script lang="ts">
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, cloudUsers, drawSettings, drawTool, editMode, outputDisplay, outputState, outputs, paintCache, profiles, quickSearchActive, saved, settingsTab, shows, activeDrawerTab, drawer, looks, activeLook, activePopup } from "../../stores"
    import { getCloudUsers } from "../../utils/cloudSync"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { toggleOutputs } from "../helpers/output"

    import TopButton from "../inputs/TopButton.svelte"
    import { DEFAULT_DISPLAY_NAME } from "../../utils/SocketHelper"
    import Button from "../../lib/components/ui/button/button.svelte"
    import Capsule from "../../lib/components/ui/capsule/capsule.svelte"
    import Menu from "../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../lib/components/ui/menu/menu-separator.svelte"
    import { applyLook } from "../helpers/looks"
    import { getAllNormalOutputs, getAllStageOutputs } from "../helpers/output"
    import { DEFAULT_DRAWER_HEIGHT } from "../../utils/common"

    export let isWindows = false

    $: show = $shows[$activeShow?.id || ""]
    $: showProfile = profile?.access.shows || {}
    $: isLocked = show?.locked || showProfile.global === "read" || showProfile[show?.category || ""] === "read"

    // && !$editHistory.length
    $: editDisabled = $activeEdit.id && ($activeEdit.type || "show") !== "show" ? false : $activeShow && ($activeShow?.type || "show") === "show" ? isLocked : $activeShow?.type === "pdf" || !$activeShow?.id
    $: physicalOutputWindows = Object.values($outputs).filter((a) => a.enabled && !a.invisible)

    function openOutputSettings() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }

    // disabled tabs

    let settingsDisabled = false
    $: profile = $profiles[$activeProfile || ""]
    $: settingsDisabled = Object.keys(profile?.access.settings || {}).length > 7

    $: lookOptions = Object.entries($looks || {}).map(([id, look]: any) => ({ id, label: look?.name || id, value: id }))

    $: users = getCloudUsers($cloudUsers)
    function goToUser(user: { [key: string]: any }) {
        if (user.activePage) activePage.set(user.activePage as any)
        if (user.activeProject) activeProject.set(user.activeProject)
        if (user.activeShow) {
            activeShow.set(user.activeShow)

            if (user.activeShow.type === "image" || user.activeShow.type === "video") activeEdit.set({ id: user.activeShow.id, type: "media", items: [] })
            else activeEdit.set({ type: "show", slide: 0, items: [], showId: user.activeShow.id })
        }
    }

    // --- F11.1 helpers ---

    function toggleTextMode() {
        editMode.set($editMode === "text_edit" ? "default" : "text_edit")
    }

    function openTemplatesDrawer() {
        activeDrawerTab.set("templates")
        if ($drawer.height < 300) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    function openScriptureDrawer() {
        activeDrawerTab.set("scripture")
        if ($drawer.height < 300) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    function openOverlaysDrawer() {
        activeDrawerTab.set("overlays")
        if ($drawer.height < 300) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    function toggleMediaDrawer() {
        if ($activeDrawerTab === "media" && $drawer.height > 40) {
            drawer.set({ height: 40, stored: $drawer.height, autoclosed: true })
        } else {
            activeDrawerTab.set("media")
            if ($drawer.height < 300) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
        }
    }

    function openLiveSettings() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }

    function toggleAudience() {
        toggleOutputs(getAllNormalOutputs().map((a: any) => a.id))
    }

    function toggleStage() {
        toggleOutputs(getAllStageOutputs().map((a: any) => a.id))
    }

    // live status per group
    $: normalOutputIds = getAllNormalOutputs().map((o: any) => o.id)
    $: stageOutputIds = getAllStageOutputs().map((o: any) => o.id)
    $: audienceLive = ($outputState || []).some((s: any) => s.active === true && normalOutputIds.includes(s.id))
    $: stageLive = ($outputState || []).some((s: any) => s.active === true && stageOutputIds.includes(s.id))

    // menús desplegables de la barra (kit: menu)
    let moreOpen = false
    let lookOpen = false
    function runMore(fn: () => void) {
        fn()
        moreOpen = false
    }
    function applyLookFromMenu(id: string) {
        applyLook(id)
        lookOpen = false
    }
    function editLooks() {
        lookOpen = false
        activePopup.set("looks")
    }

    // right-click on audience/stage -> configure screens
    function onScreensContextMenu(e: MouseEvent) {
        e.preventDefault()
        activePopup.set("screen_config")
    }
</script>

<div class="top" data-tauri-drag-region>
    <span style="width: var(--navigation-width);" data-tauri-drag-region>
        {#if !isWindows}
            <div class="macTitleSpace" data-tauri-drag-region />
        {/if}
    </span>

    <!-- Izquierda 1: Buscar · Texto · Tema (F12.5: cápsula del kit, misma apariencia en todos los grupos) -->
    <Capsule>
        <Button variant="ghost" size="sm" data-title={translateText("menu.search")} onclick={() => quickSearchActive.set(true)}>
            <Icon id="search" size={1} white />
        </Button>
        <Button variant="ghost" size="sm" data-title={translateText("menu.text")} onclick={toggleTextMode}>
            <Icon id="text" size={1} white />
        </Button>
        <Button variant="ghost" size="sm" data-title={translateText("menu.theme")} onclick={openTemplatesDrawer}>
            <Icon id="theme" size={1} white />
        </Button>
    </Capsule>

    <!-- Izquierda 2: Show · Edit · Biblia · ⋯ -->
    <Capsule>
        <TopButton id="show" />
        <TopButton id="edit" disabled={editDisabled} />
        <Button variant="ghost" size="sm" data-title={translateText("menu.bible")} onclick={openScriptureDrawer}>
            <Icon id="scripture" size={1} white />
        </Button>
        <div class="menu-anchor">
            <Button variant="ghost" size="sm" data-title={translateText("menu.more")} onclick={() => (moreOpen = !moreOpen)}>
                <Icon id="more" size={1} white />
            </Button>
            <Menu open={moreOpen} onclose={() => (moreOpen = false)}>
                <MenuItem onclick={() => runMore(() => activePage.set("stage"))}>{translateText("menu.stage_editor")}</MenuItem>
                <MenuItem onclick={() => runMore(openTemplatesDrawer)}>{translateText("menu.theme_editor")}</MenuItem>
                <MenuItem onclick={() => runMore(openOverlaysDrawer)}>{translateText("menu.overlay_editor")}</MenuItem>
            </Menu>
        </div>
    </Capsule>

    <span class="spacer" data-tauri-drag-region />

    <!-- Derecha 1: Media · Look ▾ · Live -->
    <Capsule>
        <Button variant="ghost" size="sm" data-title={translateText("menu.media")} onclick={toggleMediaDrawer}>
            <Icon id="media" size={1} white />
        </Button>
        <div class="menu-anchor">
            <Button variant="ghost" size="sm" data-title={translateText("looks.looks") + ": " + ($looks[$activeLook]?.name || "")} onclick={() => (lookOpen = !lookOpen)}>
                <Icon id="looks" size={1} white />
            </Button>
            <Menu open={lookOpen} class="min-w-52" onclose={() => (lookOpen = false)}>
                {#each lookOptions as look}
                    <MenuItem checked={look.id === $activeLook} onclick={() => applyLookFromMenu(look.id)}>{look.label}</MenuItem>
                {/each}
                {#if lookOptions.length}<MenuSeparator />{/if}
                <MenuItem onclick={editLooks}>{translateText("looks.edit_looks")}</MenuItem>
            </Menu>
        </div>
        <Button variant="ghost" size="sm" data-title={translateText("menu.live")} onclick={openLiveSettings}>
            <Icon id="broadcast" size={1} white />
        </Button>
    </Capsule>

    <!-- Derecha 3: Dibujo · Configuración (en la barra superior, junto a las pantallas) -->
    <Capsule>
        <TopButton id="draw" red={$drawTool === "fill" || ($drawTool === "zoom" && $drawSettings.zoom?.size !== 100) || !!($drawTool === "paint" && $paintCache?.length)} />
        {#if !settingsDisabled}
            <TopButton id="settings" />
        {/if}
    </Capsule>

    <!-- Derecha 2: Audiencia · Stage (rojo mientras están en vivo); clic derecho abre Configurar pantallas -->
    <Capsule>
        <Button variant="live" size="sm" aria-pressed={audienceLive} data-title={translateText("menu.audience")} oncontextmenu={onScreensContextMenu} onclick={toggleAudience}>
            <Icon id="people" size={1} white />
        </Button>
        <Button variant="live" size="sm" aria-pressed={stageLive} data-title={translateText("menu.stage")} oncontextmenu={onScreensContextMenu} onclick={toggleStage}>
            <Icon id="user" size={1} white />
        </Button>
        {#if users.length}
            <div class="users" data-data-title={translateText("settings.connections")}>
                {#each users as user}
                    {@const name = user.displayName || DEFAULT_DISPLAY_NAME}
                    <button class="user" class:isSameArea={$activeShow && user.activeShow?.id === $activeShow?.id} title={name} style="background-color: {user.color};" onclick={() => goToUser(user)}>
                        {#if name === DEFAULT_DISPLAY_NAME}
                            <Icon id="profiles" size={0.9} white />
                        {:else}
                            {name.charAt(0)}
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
    </Capsule>

    <span style="width: var(--navigation-width);justify-content: flex-end;" data-tauri-drag-region>
        <span class="unsaved-dot" class:hidden={$saved} data-title={translateText("menu.unsaved")} role="none" />
        {#if !$outputDisplay && !physicalOutputWindows.length}
            <div data-title={translateText("No 'physical' outputs available!")} style="position: absolute;top: 0;inset-inline-end: 0;height: 100%;width: 60px;" role="none" onclick={openOutputSettings}></div>
        {/if}
    </span>
</div>

<style>
    .top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        z-index: 30;
        min-height: 48px;
        height: 48px;

        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }
    .top > span {
        display: flex;
        align-items: center;
    }

    .spacer {
        flex: 1;
    }

    .menu-anchor {
        position: relative;
        display: flex;
    }

    .macTitleSpace {
        width: 80px;
        flex-shrink: 0;
    }

    .unsaved-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: var(--red);
    }
    .unsaved-dot.hidden {
        visibility: hidden;
    }

    div :global(button.display) {
        display: flex;
        justify-content: center;
        min-width: 60px;
    }

    /* connected users: avatares dentro de la última cápsula */
    .users {
        display: flex;
        align-items: center;
        gap: 2px;
        padding-inline: 2px;
    }
    .user {
        width: 22px;
        min-width: 22px;
        height: 22px;

        background-color: var(--secondary);
        color: var(--textInvert);
        border: 1px solid var(--primary-lighter);
        border-radius: 50%;

        font-size: 0.8em;
        font-weight: bold;

        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    .user:hover {
        filter: brightness(0.9);
    }
    .user.isSameArea {
        box-shadow: 0 0 0 2px var(--secondary);
    }

    @media screen and (max-width: 580px) {
        .top > span:first-child {
            display: none;
        }
    }
</style>
