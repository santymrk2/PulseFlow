<script lang="ts">
    import { timeline } from "../../../stores"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"
    import { formatTime, parseTime } from "../../timeline/timeline"

    $: startTime = $timeline.startTime || 0 // ms
    $: formattedTime = formatTime(startTime, null)

    function update(key: string, value: any) {
        timeline.update((a) => {
            a[key] = value
            return a
        })
    }
</script>

<TextField label="timeline.start_time" value={formattedTime} defaultValue="00:00:00;00" on:change={(e) => update("startTime", parseTime(e.detail))} />
