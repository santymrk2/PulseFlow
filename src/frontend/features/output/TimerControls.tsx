import { Timers } from "../../react/drawer/timers/Timers"

// Port de components/output/tools/TimerControls.svelte (F24.20b). El original sólo montaba la isla React de Timers.
export function TimerControls() {
    return <Timers onlyPlaying />
}
