<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { focusMode, special } from "../../../stores"
    import YouTubePlayer from "./YouTubePlayer.svelte"

    export let videoData = { paused: false, muted: true, loop: false, duration: 0 }
    export let videoTime = 0
    export let actualVideoTime = 0
    export let id
    // export let outputId
    export let preview

    // export let startAt = 0

    // <= 0.5.4
    $: id = id.includes("?list") ? id.slice(0, id.indexOf("?list")) : id
    $: id = id.slice(-11)

    // https://developers.google.com/youtube/player_parameters
    const options = {
        playerVars: {
            autoplay: 1,
            loop: videoData.loop,
            fs: 0,
            rel: 0,
            controls: $special.hideCursor ? 0 : 1
            // enablejsapi: 1
            // cc_load_policy: true
        }
    }

    let dispatch = createEventDispatcher()
    let player: any | null = null
    let loaded = false
    function onReady(e) {
        player = e.detail.target

        loaded = true

        videoData.paused = $focusMode

        dispatch("loaded", true)
    }

    $: if (loaded) updateTime()
    let timeInterval: NodeJS.Timeout | null = null
    function updateTime() {
        if (timeInterval) clearInterval(timeInterval)
        timeInterval = setInterval(() => {
            if (!player) return
            try {
                if (player.getPlayerState() === 1) actualVideoTime = player.getCurrentTime()

                // report back to the VideoShow preview
                if (preview && !seeking) videoTime = player.getCurrentTime()
                const duration = preview && !videoData.duration ? player.getDuration() : 0
                if (duration) videoData.duration = duration
            } catch {}
        }, 250)
    }
    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval)
    })

    let seeking = false
    $: if (!seeking && videoTime !== undefined) seekPlayer()
    function seekPlayer() {
        if (!player || !loaded || Math.abs(player.getCurrentTime() - videoTime) < 2) return

        seeking = true
        player.seekTo(videoTime, true)

        setTimeout(() => {
            seeking = false
        }, 500)
    }

    // pause/play state
    $: if (player && loaded && !seeking && videoData.paused !== undefined) {
        if (videoData.paused) player.pauseVideo()
        else player.playVideo()
    }

    // mute state (la ventana webview de salida ya no existe: el player siempre va en silencio)
    $: if (player && loaded && !player.isMuted()) player.mute()

    $: if (!id && player) player.stopVideo()

    // WIP update frontend state if changing output values directly?

    // $: if ($outputWindow && player && videoData.paused) player.seekTo(videoTime)

    // let loopStop = false
    // function change() {
    //     if (loopStop || !loaded || updating || seeking) return

    //     loopStop = true
    //     setTimeout(() => (loopStop = false), 50)

    //     // unstarted (-1), ended (0), playing (1), paused (2), buffering (3), cued (5)
    //     videoData.paused = player.getPlayerState() === 1 ? false : true
    //     if (preview) videoTime = player.getCurrentTime()
    // }

    function ended() {
        dispatch("ended", true)
    }

    // WIP main volume channel should control player videos even though it's not connected at the moment ?
    // $: mainVol = $audioChannelsData.main?.isMuted ? 0 : ($audioChannelsData.main?.volume ?? 1)
    // $: if (!shouldBeMuted && mainVol !== undefined) updateVolume()
    // function updateVolume() {
    //     if (!player) return
    //     player.setVolume(mainVol * 100)
    // }
</script>

<div class="main" class:hide={!id}>
    {#if id}
        <YouTubePlayer class="yt" videoId={id} {options} on:ready={onReady} on:end={ended} />
    {/if}
</div>

<style>
    .main {
        pointer-events: initial;
    }

    .main,
    .main :global(.yt),
    .main :global(iframe) {
        height: 100%;
        width: 100%;
    }

    .hide :global(.yt) {
        display: none;
    }
</style>
