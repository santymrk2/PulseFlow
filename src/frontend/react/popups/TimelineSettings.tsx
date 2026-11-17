// Port de components/main/popups/TimelineSettings.svelte. Lee: timeline.startTime (ms).
// Escribe: timeline.startTime con parseTime del valor del campo.
import { formatTime, parseTime } from "../../components/timeline/timeline"
import { timeline } from "../../stores"
import { useStore } from "../hooks/useStore"
import { TextField } from "../ui/text-field/TextField"

export function TimelineSettings() {
    const timelineValue = useStore(timeline)
    const startTime = timelineValue.startTime || 0 // ms
    const formattedTime = formatTime(startTime, null)

    function update(key: string, value: number) {
        timeline.update((a) => {
            a[key] = value
            return a
        })
    }

    return <TextField label="timeline.start_time" value={formattedTime} defaultValue="00:00:00;00" onChange={(value) => update("startTime", parseTime(value || ""))} />
}
