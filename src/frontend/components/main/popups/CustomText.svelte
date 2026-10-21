<script lang="ts">
    import { onMount } from "svelte"
    import { special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import TextareaField from "../../../lib/components/ui/textarea-field/textarea-field.svelte"

    let id = "splash"

    const getValue = {
        splash: () => $special.splashText || ""
    }
    const setValue = {
        splash: () => {
            special.update((a) => {
                a.splashText = text
                return a
            })
        }
    }

    onMount(() => {
        if (getValue[id]) text = getValue[id]()
    })

    let text = ""
    function changeValue(e: CustomEvent<string>) {
        text = e.detail
        if (setValue[id]) setValue[id]()
    }
</script>

<TextareaField label="edit.text" rows={5} placeholder={translateText("empty.text...")} value={text} on:change={changeValue} autofocus />
