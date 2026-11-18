<script lang="ts">
    // Migrado a React en F24.20a. Cascarón temporal: conserva la API Svelte mientras los padres se migran.
    import type { TabsObj } from "../../../types/Tabs"
    import { activeShow, showsCache } from "../../stores"
    import { _show } from "../helpers/shows"
    import Tabs from "../main/Tabs.svelte"
    import ReactIsland from "../../react/bridge/ReactIsland.svelte"
    import { ShowTools } from "../../react/show/ShowTools"

    let tabs: TabsObj = {
        audio: { name: "tabs.audio", icon: "audio" },
        overlays: { name: "clear.overlays", icon: "overlays" },
        timers: { name: "tools.timers", icon: "clock" },
        groups: { name: "tools.groups", icon: "groups" },
        metadata: { name: "tools.metadata", icon: "info" },
        media: { name: "tools.media", icon: "media", remove: true }
    }
    let active = "audio"

    $: showId = $activeShow?.id
    $: currentShow = $showsCache[showId || ""]
    $: if (currentShow) checkMedia()
    function checkMedia() {
        const refs = _show().layouts().ref()
        let disableMedia = true
        if (refs.some((ref) => ref.some((slide) => slide.data.background))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.overlays?.length))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.audio))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.mics))) disableMedia = false
        else if (refs.some((ref) => ref.some((slide) => slide.data.actions?.slideActions?.length))) disableMedia = false
        tabs = { ...tabs, media: { ...tabs.media, remove: disableMedia } }
    }

    let tabsHost: HTMLDivElement | undefined
</script>

<ReactIsland component={ShowTools} props={{ tabs, active, tabsHost }} />

<!-- Tabs usa bind:active: se monta acá y React lo reubica. -->
<div bind:this={tabsHost} style="display: contents">
    <Tabs {tabs} bind:active labels={false} />
</div>
