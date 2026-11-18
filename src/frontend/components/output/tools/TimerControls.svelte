<script lang="ts">
    import { Timers } from "../../../react/drawer/timers/Timers"
    import ReactIsland from "../../../react/bridge/ReactIsland.svelte"
</script>

<ReactIsland component={Timers} props={{ onlyPlaying: true }} />
