<script lang="ts">
    import { customActionActivation } from "./components/actions/actions"
    import Navigation from "./components/edit/Navigation.svelte"
    import LazyLoad from "./components/helpers/LazyLoad.svelte"
    import ProfileChangerMenu from "./components/main/ProfileChangerMenu.svelte"
    import Tipbar from "./components/main/Tipbar.svelte"
    import Top from "./components/main/Top.svelte"
    import Preview from "./components/output/preview/Preview.svelte"
    import LibraryAddMenu from "./components/show/LibraryAddMenu.svelte"
    import Projects from "./components/show/Projects.svelte"
    import ProjectContentList from "./components/show/ProjectContentList.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import StageLayouts from "./components/stage/StageLayouts.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import Timeline from "./components/timeline/Timeline.svelte"
    import { DEFAULT_WIDTH } from "./utils/common"
    import { activeDrawerTab, activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, categories, currentWindow, drawer, drawerTabsData, editMode, focusMode, loaded, os, projectView, projects, resized, showChangeProfileMenu, showsCache, special } from "./stores"
    import { getAccess } from "./utils/profile"
    import Icon from "./components/helpers/Icon.svelte"
    import ListRow from "./lib/components/ui/list-row/list-row.svelte"
    import SectionHeader from "./lib/components/ui/section-header/section-header.svelte"
    import { translateText } from "./utils/language"

    $: page = $activePage
    $: projectActive = !$projectView && $activeProject !== null
    $: itemCount = projectActive && $activeProject ? ($projects[$activeProject]?.shows?.length ?? 0) : 0
    $: isWindows = !$currentWindow && $os.platform === "win32"

    function openLibraryCategory(categoryId: string) {
        activeDrawerTab.set("shows")
        drawerTabsData.update((a) => {
            if (!a.shows) a.shows = { activeSubTab: categoryId, enabled: true }
            else a.shows.activeSubTab = categoryId
            return a
        })
        if ($drawer.height <= 40) {
            drawer.set({ height: $drawer.stored ?? 300, stored: null })
        }
    }

    let previousId = ""
    $: if ($activeShow?.id !== previousId) showOpened()
    function showOpened() {
        if (!$activeShow?.id || $activeShow?.type !== "show") return

        // allow show to actually open before triggering
        setTimeout(() => customActionActivation("show_opened"), 50)
        previousId = $activeShow?.id
    }
</script>

<div class="column">
    {#if !$focusMode}
        <Top {isWindows} />
    {/if}
    <div class="row">
        <Resizeable id="leftPanel">
            <div class="left">
                {#if page === "show"}
                    {#key $activeProfile}
                        <div class="librarySection">
                            <SectionHeader>
                                {translateText("ui.library")}
                                {#snippet actions()}
                                    <LibraryAddMenu />
                                {/snippet}
                            </SectionHeader>
                            {#each Object.entries($categories || {}) as [id, cat]}
                                {#if !cat?.isArchive && $activeProfile ? getAccess(id).global !== "none" : true}
                                    <ListRow onclick={() => openLibraryCategory(id)}>
                                        {#snippet icon()}
                                            <Icon id={cat?.icon || "folder"} white size={0.9} />
                                        {/snippet}
                                        {cat?.name?.includes(".") ? translateText(cat.name) : cat?.name || id}
                                    </ListRow>
                                {/if}
                            {/each}
                        </div>

                        <SectionHeader>{translateText("ui.playlist")}</SectionHeader>
                        <Projects />

                        {#if projectActive}
                            <SectionHeader>{translateText("ui.items", null, [String(itemCount)])}</SectionHeader>
                            <ProjectContentList tree={[]} recentlyUsedList={[]} />
                        {/if}

                        <div class="librarySection">
                            <SectionHeader>{translateText("ui.media")}</SectionHeader>
                            <ListRow
                                onclick={() => {
                                    activeDrawerTab.set("media")
                                    if ($drawer.height <= 40) drawer.set({ height: $drawer.stored ?? 300, stored: null })
                                }}
                            >
                                {#snippet icon()}
                                    <Icon id="media" white size={0.9} />
                                {/snippet}
                                {translateText("ui.media")}
                            </ListRow>
                        </div>
                    {/key}
                {:else if page === "edit"}
                    <Navigation />
                {:else if page === "stage"}
                    <StageLayouts />
                {/if}
            </div>
        </Resizeable>

        <div class="center">
            {#if page === "show"}
                {#if $focusMode}
                    <LazyLoad component={() => import("./components/show/focus/FocusMode.svelte")} show={$focusMode} />
                {:else}
                    <Show />
                {/if}
            {:else if page === "edit"}
                <LazyLoad component={() => import("./components/edit/Editor.svelte")} show={page === "edit"} />
            {:else if page === "stage"}
                <LazyLoad component={() => import("./components/stage/StageLayout.svelte")} show={page === "stage"} />
            {/if}
        </div>

        <Resizeable id="rightPanel" let:width side="right">
            <div class="right" class:row={width > DEFAULT_WIDTH * 1.8}>
                <Preview />
                {#if page === "show"}
                    {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) && !$focusMode}
                        <ShowTools />
                    {/if}
                {:else if page === "edit"}
                    {#if $activeEdit.type === "media" || $activeEdit.type === "camera"}
                        <LazyLoad component={() => import("./components/edit/MediaTools.svelte")} show={$activeEdit.type === "media" || $activeEdit.type === "camera"} />
                    {:else if $activeEdit.type === "audio"}
                        <LazyLoad component={() => import("./components/edit/AudioTools.svelte")} show={$activeEdit.type === "audio"} />
                    {:else if $activeEdit.type === "effect"}
                        <LazyLoad component={() => import("./components/edit/EffectTools.svelte")} show={$activeEdit.type === "effect"} />
                    {:else if $activeEdit.type === "scene"}
                        <LazyLoad component={() => import("./components/edit/SceneTools.svelte")} show={$activeEdit.type === "scene"} />
                    {:else if $activeEdit.type === "overlay" || $activeEdit.type === "template" || $showsCache[$activeShow?.id || ""]}
                        {#if $focusMode || (($activeEdit.type || "show") === "show" && $editMode !== "default")}
                            <!-- show nothing -->
                        {:else}
                            <LazyLoad component={() => import("./components/edit/EditTools.svelte")} show={!$focusMode} />
                        {/if}
                    {/if}
                {:else if page === "stage" && $activeStage.id}
                    <LazyLoad component={() => import("./components/stage/StageTools.svelte")} show={page === "stage" && !!$activeStage.id} />
                {/if}
            </div>
        </Resizeable>
    </div>

    {#if page === "show" && $special.projectTimelineActive && $activeProject && !$projectView}
        <Resizeable id="project_timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
            {#key $activeProject}
                <Timeline type="project" isClosed={$resized.project_timeline <= 40} />
            {/key}
        </Resizeable>
    {/if}

    {#if $loaded && (page === "show" || page === "edit")}
        <LazyLoad component={() => import("./components/drawer/Drawer.svelte")} show={$loaded && (page === "show" || page === "edit")} />
    {/if}

    {#if $showChangeProfileMenu && $activeProfile !== null}
        <ProfileChangerMenu />
    {/if}

    <Tipbar />
</div>

<style>
    .column,
    .row {
        display: flex;
        justify-content: space-between;
        /* background: var(--primary-darker); */
    }

    .column {
        flex-direction: column;
        height: 100%;
    }

    .row {
        flex: 1;
        overflow: hidden;
    }

    .center {
        position: relative;

        flex: 1;
        background-color: var(--primary-darker);
        overflow: auto;

        scroll-behavior: smooth;
    }

    .left,
    .right {
        position: relative;

        display: flex;
        flex-direction: column;
        flex: 1;
        justify-content: space-between;
        overflow: hidden;
    }
    .right.row {
        flex-direction: row-reverse;
    }

    .right :global(.border) {
        /* divisor entre secciones (referencia: RightPanel.tsx Divider: h-px mx-3) */
        border-top: 1px solid var(--border-color, var(--primary-lighter));
        margin: 0 12px;
    }
    .right.row :global(.border) {
        border: none;
        border-inline-end: 1px solid var(--border-color, var(--primary-lighter));
        margin: 12px 0;
        min-width: 50%;
    }

    .right.row :global(.textfield .picker) {
        left: unset !important;
        right: 0;
    }
    /* F11.10 — secciones de la columna izquierda */
    .librarySection {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px;
    }
</style>
