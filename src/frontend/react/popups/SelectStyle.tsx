import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { OutData } from "../../../types/Output"
import type { Styles } from "../../../types/Settings"
import { Card } from "../drawer/Card"
import { DEFAULT_ITEM_STYLE } from "../../components/edit/scripts/itemHelpers"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { getResolution } from "../../shared/utils/helpers/output"
import { Output } from "../output/Output"
import { openSettings } from "../../components/settings/openSettings"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { activePopup, activeStyle, currentOutputSettings, outputs, popupData, styles } from "../../shared/core/stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { CombinedInput } from "../ui/combined-input/CombinedInput"
import stylesCSS from "./SelectStyle.module.css"

// Port de components/main/popups/SelectStyle.svelte. Lee: styles, currentOutputSettings, outputs y popupData (active, skip, trigger).
// Escribe: el trigger con el id elegido, popupData = { id: "select_style", value }, activePopup = null (200 ms después),
// y al crear: history UPDATE, activeStyle = id y openSettings("styles").
// Card es un port React; se renderiza como hermano de Output, como en el original.
interface StyleItem extends Styles {
    id: string
}

const outOverride: OutData = {
    slide: {
        id: "tempText",
        tempItems: [{ style: DEFAULT_ITEM_STYLE, lines: [] }]
    }
}
const text = "Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nDonec eget condimentum diam,\na sollicitudin lorem."

function getOverride(style: Styles): OutData {
    const override = clone(outOverride)
    const lines = text.split("\n").map((a) => ({ align: "", text: [{ value: a, style: "" }] }))
    override.slide!.tempItems![0].lines = lines.slice(0, style.lines || 10)
    return override
}

export function SelectStyle() {
    const outputsValue = useStore(outputs)
    const [outputStyles] = useState<StyleItem[]>(() => sortByName(keysToID(get(styles))))
    const [active, setActive] = useState(() => (get(popupData).active || "") as string)
    const [outputId] = useState(() => (get(currentOutputSettings) || "") as string)
    const [skip] = useState(() => !!get(popupData).skip)

    function select(selectedId: string) {
        setActive(selectedId)

        const data = get(popupData)
        if (data.trigger) data.trigger(selectedId)

        popupData.set({ id: "select_style", value: selectedId })

        setTimeout(() => {
            setTimeout(() => (get(activePopup) === null ? popupData.set({}) : null), 200)
            activePopup.set(null)
        })
    }

    function createNew() {
        const styleId = uid()
        history({ id: "UPDATE", newData: { data: { name: "" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        select(styleId)
        activeStyle.set(styleId)
        openSettings("styles")
    }

    const outputData = outputsValue[outputId]?.out

    return (
        <>
            <Button className="popup-options" icon="add" iconSize={1.3} title="new.style" onClick={createNew} white />

            <div style={{ position: "relative", height: "100%", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)", overflowY: "auto" }}>
                {outputStyles.length ? (
                    <div className={stylesCSS.grid}>
                        {outputStyles.map((style) => {
                            const resolution = getResolution(null, null, false, outputId, style.id)
                            const out = outputData?.slide ? outputData : getOverride(style)
                            return (
                                <div key={style.id}>
                                    <Card width={25} active={active === style.id} label={style.name} resolution={resolution} onClick={() => select(style.id)} />
                                    <Output outputId={outputId} style={getStyleResolution(resolution, resolution.width, resolution.height, "fit")} styleIdOverride={style.id} outOverride={out} mirror />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>

            {skip ? (
                <CombinedInput style={{ margin: "6px", marginTop: "10px", width: "initial" }}>
                    <Button style={{ width: "100%" }} icon="arrow_forward" onClick={() => activePopup.set(null)}>
                        <T id="guide.skip" />
                    </Button>
                </CombinedInput>
            ) : null}
        </>
    )
}
