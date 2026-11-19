import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { defaultColors, defaultGradients } from "../../shared/utils/helpers/color"
import { Tip } from "../../app/main/Tip"
import { special } from "../../shared/core/stores"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { ColorField } from "../../shared/ui/kit/color-field/ColorField"

// Port de components/main/popups/ManageColors.svelte. Lee special.customColors (al leer el portapapeles). Escribe special: customColors / disabledColors /
// customColorsGradient / disabledColorsGradient (agrega el color o lo saca si ya estaba; se muta en el lugar y se re-emite, como el Svelte).
// Al montar lee el portapapeles (navigator.clipboard.readText): los colores válidos y que no estén en customColors se ofrecen con "pegar".
// Tip usa el port React. Se omite el `{console.log(clipboardColors)}` de depuración (y el <span> invisible que lo envolvía).
function isValidColor(color: string) {
    const style = new Option().style
    style.color = color
    return style.color !== ""
}

function changeColor(color: string) {
    const key = color.includes("gradient") ? (defaultGradients.find((a) => a.value === color) ? "disabledColorsGradient" : "customColorsGradient") : defaultColors.find((a) => a.value === color) ? "disabledColors" : "customColors"

    special.update((a) => {
        const colors: string[] = a[key] || []

        const existing = colors.indexOf(color)
        if (existing >= 0) colors.splice(existing, 1)
        else colors.push(color)

        a[key] = colors

        return a
    })
}

export function ManageColors() {
    const [clipboardColors, setClipboardColors] = useState<string[]>([])

    useEffect(() => {
        let mounted = true
        navigator.clipboard
            .readText()
            .then((clipboard) => {
                const text = clipboard.trim().replaceAll('"', "").replaceAll("'", "").replace("[", "").replace("]", "")
                const found: string[] = []

                const parts = text.includes("rgb") ? [text] : text.split(/[\s,]+/)
                parts.forEach((part) => {
                    const color = part.trim()

                    // let isHex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
                    if (isValidColor(color) && !get(special).customColors?.includes(color)) found.push(color)
                })

                if (mounted) setClipboardColors([...new Set(found)])
            })
            .catch((e) => {
                console.warn("Could not read clipboard:", e)
            })

        return () => {
            mounted = false
        }
    }, [])

    function addClipboardColors() {
        clipboardColors.forEach(changeColor)
        setClipboardColors([])
    }

    return (
        <>
            <Tip value="actions.click_disable" bottom={20} />

            <ColorField label="" value="" onChange={(value) => changeColor(value || "")} alwaysVisible editMode />

            {clipboardColors.length ? (
                <Button variant="outline" icon="paste" style={{ marginTop: "10px" }} onClick={addClipboardColors}>
                    <T id="actions.paste" />
                </Button>
            ) : null}
        </>
    )
}
