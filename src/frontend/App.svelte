<script lang="ts">
    import MainLayout from "./MainLayout.svelte"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import Guide from "./components/guide/Guide.svelte"
    import { getContrast } from "./components/helpers/color"
    import Loader from "./components/main/Loader.svelte"
    import ProgressPanel from "./components/main/ProgressPanel.svelte"
    import MenuBar from "./components/main/MenuBar.svelte"
    import Popup from "./components/main/Popup.svelte"
    import SettingsModal from "./components/settings/SettingsModal.svelte"
    import ProfileSelector from "./components/main/ProfileSelector.svelte"
    import Recorder from "./components/main/Recorder.svelte"
    import StatusIndicator from "./components/main/StatusIndicator.svelte"
    import Toast from "./components/main/Toast.svelte"
    import TooltipManager from "./components/main/TooltipManager.svelte"
    import QuickSearch from "./components/quicksearch/QuickSearch.svelte"
    import Center from "./components/system/Center.svelte"
    import { activeProfile, closeAd, currentWindow, loaded, os, profiles, theme, themes } from "./stores"
    import { focusArea, logerror, mainClick } from "./utils/common"
    import { keydown } from "./utils/shortcuts"
    import { startup, startupAppEffects } from "./utils/startup"

    startup()
    // timers y listeners globales (F9.1: viven en utils/startup.ts)
    startupAppEffects()

    $: isWindows = !$currentWindow && $os.platform === "win32"

    ///// UPDATERS /////

    $: contrastColor = getContrast($themes[$theme]?.colors?.secondary || "")
    $: secondaryContrast = `--secondary-text: ${contrastColor === "#000000" ? "#131313" : "#f0f0ff"};`
    $: globalStyle = `${isWindows ? "height: calc(100% - 25px);" : ""}${secondaryContrast}`

    let ready = false
    $: if ($loaded) hasLoaded()
    function hasLoaded() {
        setTimeout(() => {
            // prevent brief flash
            ready = true
        }, 51)
    }
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} on:click={mainClick} on:error={logerror} on:unhandledrejection={logerror} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    <!-- "isWindows" is only set in main window -->
    {#if isWindows}
        <MenuBar />
    {/if}

    <main style={globalStyle} class:closeAd={$closeAd}>
        <ContextMenu />
        <TooltipManager />

        {#if $loaded}
            <!-- antes de Popup: los popups abiertos desde Configuración quedan encima -->
            <SettingsModal />
            <Popup />
            <QuickSearch />
            <Toast />
            <StatusIndicator />
            <Recorder />
            <Guide />
            <ProgressPanel />

            <MainLayout />

            {#if ready && Object.keys($profiles).filter((a) => a !== "admin").length && $activeProfile === null}
                <ProfileSelector />
            {/if}
        {:else}
            <Center>
                <Loader size={2} />
            </Center>
        {/if}
    </main>
{/if}

<style>
    main {
        height: 100%;
        background-color: var(--primary);
        /* background: linear-gradient(130deg, var(--primary) 0%, rgb(42, 44, 62) 100%); */
    }

    .closeAd {
        height: 1px;
    }
</style>
