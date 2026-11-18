import { useState } from "react"
import { get } from "../../lib/store"
import { mediaFitOptions } from "../../components/edit/values/boxes"
import { activePopup, popupData, styles } from "../../stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { NumberField } from "../ui/number-field/NumberField"
import stylesModule from "./MediaFit.module.css"

// Port de components/main/popups/MediaFit.svelte. Lee: popupData.active (al montar), popupData.styleId/trigger/updateCustom y styles.
// Escribe: llama a trigger(valor) y a updateCustom({ key, value }); si la opción elegida ya estaba activa, activePopup = null.
const iconSize = 100
const icons = {
    contain:
        '<g><path d="M 22 20.5 L 78 20.5 C 79.104 20.5 80 21.396 80 22.5 L 80 78.5 C 80 79.604 79.104 80.5 78 80.5 L 22 80.5 C 20.896 80.5 20 79.604 20 78.5 L 20 22.5 C 20 21.396 20.896 20.5 22 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="20" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="20" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    cover: '<g><path d="M 7 5.5 L 93 5.5 C 94.104 5.5 95 6.396 95 7.5 L 95 93.5 C 95 94.604 94.104 95.5 93 95.5 L 7 95.5 C 5.896 95.5 5 94.604 5 93.5 L 5 7.5 C 5 6.396 5.896 5.5 7 5.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    fill: '<g><path d="M 6.8 20.5 L 93.2 20.5 C 94.193 20.5 95 21.307 95 22.3 L 95 78.7 C 95 79.693 94.193 80.5 93.2 80.5 L 6.8 80.5 C 5.807 80.5 5 79.693 5 78.7 L 5 22.3 C 5 21.307 5.807 20.5 6.8 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="20.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="35.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="65.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="35.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="65.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="22.5" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    blur: '<g><g style="filter: blur(2px) opacity(0.3);"><path d="M 7 5.5 L 93 5.5 C 94.104 5.5 95 6.396 95 7.5 L 95 93.5 C 95 94.604 94.104 95.5 93 95.5 L 7 95.5 C 5.896 95.5 5 94.604 5 93.5 L 5 7.5 C 5 6.396 5.896 5.5 7 5.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="5" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="72.5" y="28" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="27.5" y="73" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="5" y="50.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="5.5" width="22.5" height="22.5" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g></g>  <path d="M 22 20.5 L 78 20.5 C 79.104 20.5 80 21.396 80 22.5 L 80 78.5 C 80 79.604 79.104 80.5 78 80.5 L 22 80.5 C 20.896 80.5 20 79.604 20 78.5 L 20 22.5 C 20 21.396 20.896 20.5 22 20.5 Z" style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><g><rect x="20" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="65" y="35.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="35" y="65.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="20" y="50.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/><rect x="50" y="20.5" width="15" height="15" transform="matrix(1,0,0,1,0,0)" fill="#FFFFFF"/></g></g><path d="M 7 20.5 L 93 20.5 C 94.104 20.5 95 21.396 95 22.5 L 95 78.5 C 95 79.604 94.104 80.5 93 80.5 L 7 80.5 C 5.896 80.5 5 79.604 5 78.5 L 5 22.5 C 5 21.396 5.896 20.5 7 20.5 Z" style="fill:none;stroke:#000000;stroke-width:4;stroke-linecap:square;stroke-miterlimit:2;"/></g>'
}

export function MediaFit() {
    const [currentValue, setCurrentValue] = useState<string>(() => get(popupData).active || "contain")
    const [showMore, setShowMore] = useState(false)
    const popupDataValue = useStore(popupData)
    const stylesValue = useStore(styles)

    const styleId = popupDataValue.styleId as string | undefined
    const currentData = stylesValue[styleId || ""]

    function changeFit(id: string) {
        const trigger = get(popupData).trigger
        if (trigger) {
            trigger(id)

            if (currentValue === id) {
                activePopup.set(null)
                return
            }
            setCurrentValue(id)
            return
        }
    }

    function customUpdate(key: string, value: number | null) {
        const updateCustom = get(popupData).updateCustom
        if (updateCustom) updateCustom({ key, value })
    }

    return (
        <>
            {currentValue === "blur" && styleId ? <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white /> : null}

            <div className={stylesModule.types}>
                {mediaFitOptions.map((fit) => {
                    const isActive = fit.value === currentValue
                    return (
                        <Button key={fit.value} showOutline={isActive} isActive={isActive} onClick={() => changeFit(fit.value)}>
                            <svg viewBox="0 0 100 100" width={`${iconSize}pt`} height={`${iconSize}pt`} dangerouslySetInnerHTML={{ __html: icons[fit.value as keyof typeof icons] }} />
                            <T id={fit.label} />
                        </Button>
                    )
                })}
            </div>

            {showMore ? (
                <div className={stylesModule.options}>
                    <NumberField label="edit.blur" value={currentData.blurAmount ?? 6} defaultValue={6} max={50} onChange={(value) => customUpdate("blurAmount", value)} />
                    <NumberField label="edit.opacity" value={(currentData.blurOpacity || 0.3) * 100} defaultValue={30} min={1} max={100} onChange={(value) => customUpdate("blurOpacity", (value ?? 0) / 100)} />
                </div>
            ) : null}
        </>
    )
}
