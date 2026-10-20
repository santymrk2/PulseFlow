<script lang="ts">
    import type { SettingsTabs } from "../../../types/Tabs"
    import { activePage, activeProfile, focusMode, profiles, settingsTab } from "../../stores"
    import { settingsTabs } from "../../values/tabs"
    import { translateText } from "../../utils/language"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"

    let activeTabs: SettingsTabs[] = []
    $: profile = $profiles[$activeProfile || ""]
    $: if (profile) activeTabs = clone(settingsTabs).filter((tabId) => profile.access.settings?.[tabId] !== "none")
    else activeTabs = clone(settingsTabs)

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest?.(".edit") || e.ctrlKey || e.metaKey) return

        let nextTab = -1
        let currentTabIndex = activeTabs.findIndex((tab) => tab === $settingsTab)

        if (e.key === "ArrowDown") {
            e.preventDefault()

            nextTab = Math.min(activeTabs.length - 1, currentTabIndex + 1)

            if ((currentTabIndex + 1 >= activeTabs.length || $settingsTab === "profiles") && !activeTabs.includes("profiles")) {
                settingsTab.set("profiles")
                return
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault()

            nextTab = Math.max(0, currentTabIndex - 1)
        }

        if (nextTab < 0) return
        settingsTab.set(activeTabs[nextTab] || "profiles")
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $focusMode}
    <button class="back-btn" on:click={() => activePage.set("show")}>
        <Icon id="back" right />
        <T id="actions.back" />
    </button>
{/if}

<aside class="settings-tabs">
    <header class="settings-tabs-header">{translateText("menu.settings")}</header>
    <nav class="settings-tabs-nav">
        {#each activeTabs as tab}
            <button class="settings-tab" class:active={$settingsTab === tab} on:click={() => settingsTab.set(tab)}>
                <Icon id={tab} size={1} />
                <span><T id="settings.{tab}" /></span>
            </button>
        {/each}
    </nav>
</aside>

<style>
    .settings-tabs {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background-color: var(--primary-darker, #1a1a1a);
    }
    .settings-tabs-header {
        height: 36px;
        flex: 0 0 36px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        opacity: 0.6;
        border-bottom: 1px solid var(--border-color, var(--primary-lighter));
    }
    .settings-tabs-nav {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
    }
    .settings-tab {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: left;
        padding: 8px 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        opacity: 0.7;
        font-size: 0.85em;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            opacity 0.15s ease;
    }
    .settings-tab:hover {
        background-color: rgb(255 255 255 / 0.06);
        opacity: 1;
    }
    .settings-tab.active {
        background-color: var(--primary-lighter, rgb(255 255 255 / 0.1));
        opacity: 1;
    }
    .back-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--text);
        cursor: pointer;
    }
</style>
