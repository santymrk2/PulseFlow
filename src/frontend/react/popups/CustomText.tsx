import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { special } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { TextareaField } from "../ui/textarea-field/TextareaField"

// Port de components/main/popups/CustomText.svelte. Lee special.splashText (al montar). Escribe special.splashText al cambiar (en el lugar, como el Svelte).
export function CustomText() {
    const [text, setText] = useState(() => get(special).splashText || "")

    function changeValue(value: string) {
        setText(value)
        special.update((a) => {
            a.splashText = value
            return a
        })
    }

    return <TextareaField label="edit.text" rows={5} placeholder={translateText("empty.text...")} value={text} onChange={changeValue} autofocus />
}
