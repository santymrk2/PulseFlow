<script lang="ts">
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, cloudUsers, drawSettings, drawTool, editMode, outputDisplay, outputState, outputs, paintCache, profiles, quickSearchActive, saved, settingsTab, shows, activeDrawerTab, drawer, looks, activeLook, activePopup } from "../../stores"
    import { getCloudUsers } from "../../utils/cloudSync"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { toggleOutputs } from "../helpers/output"

    import TopButton from "../inputs/TopButton.svelte"
    import { DEFAULT_DISPLAY_NAME } from "../../utils/SocketHelper"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
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

    // more menu
    let moreOpen = false
    function toggleMore() {
        moreOpen = !moreOpen
    }
    function runMore(fn: () => void) {
        fn()
        moreOpen = false
    }

    // right-click on audience/stage -> configure screens
    function onScreensContextMenu(e: MouseEvent) {
        e.preventDefault()
        activePopup.set("choose_screen")
    }
</script>

{#if users.length}
    <div class="users" style="{isWindows ? 'top: 25px;' : ''}width: calc(17px + ((22px - 5px) * {users.length}));" data-title={translateText("settings.connections")}>
        {#each users as user, i}
            {@const isSameArea = $activeShow && user.activeShow?.id === $activeShow?.id}
            {@const name = user.displayName || DEFAULT_DISPLAY_NAME}

            <div class="user" class:isSameArea data-title={name} style="background-color: {user.color};transform: translateX(-{5 * i}px);" role="none" on:click={() => goToUser(user)}>
                {#if name === DEFAULT_DISPLAY_NAME}
                    <Icon id="profiles" size={1.2} white />
                {:else}
                    {name.charAt(0)}
                {/if}
            </div>
        {/each}
    </div>
{/if}

<div class="top" data-tauri-drag-region>
    <span style="width: var(--navigation-width);" data-tauri-drag-region>
        {#if !isWindows}
            <div class="macTitleSpace" data-tauri-drag-region />
        {/if}
    </span>

    <!-- Izquierda 1: Buscar · Texto · Tema -->
    <span class="capsule">
        <button class="cap-btn" on:click={() => quickSearchActive.set(true)}>
            <Icon id="search" size={1.2} />
            <span class="cap-label">{translateText("menu.search")}</span>
        </button>
        <button class="cap-btn" on:click={toggleTextMode}>
            <Icon id="text" size={1.2} />
            <span class="cap-label">{translateText("menu.text")}</span>
        </button>
        <button class="cap-btn" on:click={openTemplatesDrawer}>
            <Icon id="theme" size={1.2} />
            <span class="cap-label">{translateText("menu.theme")}</span>
        </button>
    </span>

    <!-- Izquierda 2: Show · Edit · Biblia · ⋯ -->
    <span class="capsule">
        <TopButton id="show" />
        <TopButton id="edit" disabled={editDisabled} />
        <button class="cap-btn" on:click={openScriptureDrawer}>
            <Icon id="scripture" size={1.2} />
            <span class="cap-label">{translateText("menu.bible")}</span>
        </button>
        <div class="more-wrap">
            <button class="cap-btn" on:click={toggleMore}>
                <Icon id="more" size={1.2} />
                <span class="cap-label">{translateText("menu.more")}</span>
            </button>
            {#if moreOpen}
                <div class="more-menu">
                    <button class="more-item" on:click={() => runMore(() => activePage.set("stage"))}>{translateText("menu.stage_editor")}</button>
                    <button class="more-item" on:click={() => runMore(openTemplatesDrawer)}>{translateText("menu.theme_editor")}</button>
                    <button class="more-item" on:click={() => runMore(openOverlaysDrawer)}>{translateText("menu.overlay_editor")}</button>
                </div>
            {/if}
        </div>
    </span>

    <span class="spacer" data-tauri-drag-region />

    <!-- Derecha 1: Media · Look · Live -->
    <span class="capsule">
        <button class="cap-btn" on:click={toggleMediaDrawer}>
            <Icon id="media" size={1.2} />
            <span class="cap-label">{translateText("menu.media")}</span>
        </button>
        {#if lookOptions.length}
            <MaterialDropdown label="Look" value={$activeLook} options={lookOptions} on:change={(e) => applyLook(e.detail.value)} onlyArrow={false} style="min-width: 90px; max-width: 160px;" />
        {/if}
        <button class="cap-btn" on:click={openLiveSettings}>
            <Icon id="broadcast" size={1.2} />
            <span class="cap-label">{translateText("menu.live")}</span>
        </button>
    </span>

    <!-- Derecha 2: Audiencia · Stage (round, red when live) -->
    <span class="capsule round-capsule">
        <div class="round-wrap">
            <button class="round-btn" class:red={audienceLive} on:click={toggleAudience} on:contextmenu={onScreensContextMenu} title={translateText("menu.audience")}>
                <Icon id="display" size={1.2} white />
            </button>
            <span class="round-label">{translateText("menu.audience")}</span>
        </div>
        <div class="round-wrap">
            <button class="round-btn" class:red={stageLive} on:click={toggleStage} on:contextmenu={onScreensContextMenu} title={translateText("menu.stage")}>
                <Icon id="stage" size={1.2} white />
            </button>
            <span class="round-label">{translateText("menu.stage")}</span>
        </div>
    </span>

    <span style="width: var(--navigation-width);justify-content: flex-end;" data-tauri-drag-region>
        <TopButton id="draw" red={$drawTool === "fill" || ($drawTool === "zoom" && $drawSettings.zoom?.size !== 100) || !!($drawTool === "paint" && $paintCache?.length)} hideLabel />
        {#if !settingsDisabled}
            <TopButton id="settings" hideLabel />
        {/if}
        <span class="unsaved-dot" class:hidden={$saved} data-title={translateText("menu.unsaved")} role="none" />
        {#if !$outputDisplay && !physicalOutputWindows.length}
            <div data-title={translateText("No 'physical' outputs available!")} style="position: absolute;top: 0;inset-inline-end: 0;height: 100%;width: 60px;" role="none" on:click={openOutputSettings} />
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
    .top span {
        display: flex;
        align-items: center;
    }

    .spacer {
        flex: 1;
    }

    .capsule {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 4px;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        height: 40px;
    }

    .cap-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        min-width: 46px;
        height: 34px;
        padding: 2px 6px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--text);
        cursor: pointer;
        font-size: 0.7rem;
        line-height: 1;
    }
    .cap-btn:hover {
        background-color: var(--hover);
    }
    .cap-label {
        margin-top: 2px;
        font-size: 0.62rem;
        opacity: 0.85;
    }

    /* TopButton (show/edit/stage) is a MaterialButton; make it fit capsule */
    .capsule :global(button) {
        /* keep */
    }

    .round-capsule {
        gap: 6px;
    }
    .round-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
    }
    .round-btn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 1px solid var(--primary-lighter);
        background-color: var(--primary-darkest);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
    }
    .round-btn.red {
        background-color: var(--red, #e53935);
        border-color: var(--red, #e53935);
        color: #fff;
    }
    .round-btn:hover {
        filter: brightness(1.1);
    }
    .round-label {
        font-size: 0.6rem;
        margin-top: 1px;
        opacity: 0.8;
    }

    .more-wrap {
        position: relative;
    }
    .more-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        z-index: 100;
        min-width: 160px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .more-item {
        background: transparent;
        border: none;
        color: var(--text);
        padding: 6px 10px;
        text-align: left;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
    }
    .more-item:hover {
        background-color: var(--hover);
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

    /* USERS */
    .users {
        position: absolute;
        top: 0;
        left: 0;
        height: calc(48px - 4px);

        display: flex;
        align-items: center;
        margin: 2px 0;
        padding: 0 5px;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-left: none;
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;

        z-index: 31;
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
    }
    .user:hover {
        filter: brightness(0.9);
    }
    .user.isSameArea {
        box-shadow: 0 0 0 2px var(--secondary);
    }

    @media screen and (max-width: 580px) {
        .top span:first-child {
            display: none;
        }
    }
</style>
