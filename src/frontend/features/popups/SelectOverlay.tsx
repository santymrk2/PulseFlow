import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Item } from "../../../types/Show"
import { Card } from "../../react/drawer/Card"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { getResolution } from "../../shared/utils/helpers/output"
import { activePopup, outputs, overlays, popupData, previewOutputId, styles } from "../../shared/core/stores"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Textbox } from "../slide/Textbox"
import { Zoomed } from "../slide/Zoomed"
import { Center } from "../../shared/ui/system/Center"
import { Button } from "../../shared/ui/kit/button/Button"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import stylesCSS from "./SelectOverlay.module.css"

// Port de components/main/popups/SelectOverlay.svelte. Lee: popupData (active, hide, trigger), outputs, styles,
// previewOutputId (resolución) y overlays. Escribe: el trigger, popupData = { id: "select_overlay", value },
// activePopup = null (500 ms después), popupData = {} y un history UPDATE al crear.
// Card, Zoomed y Textbox son ports React directos.
// Como el Zoomed original no recibía slots, Textbox se renderiza como hermano suyo (F24.24 P8g).
interface OverlayItem {
    id: string
    name?: string
    color?: string | null
    items?: Item[]
}

const INITIAL_BATCH = 8

function filter(s: string) {
    return s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
}

export function SelectOverlay() {
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(styles)
    const previewOutputIdValue = useStore(previewOutputId)
    const overlaysValue = useStore(overlays)
    const [active, setActive] = useState(() => (get(popupData).active || "") as string)
    const [hide] = useState<string[]>(() => get(popupData).hide || [])
    const [searchValue, setSearchValue] = useState("")
    const [lazyLoader, setLazyLoader] = useState(INITIAL_BATCH)
    const [loaded, setLoaded] = useState(false)
    const prevSearchValue = useRef("")

    const resolution = getResolution(null, { outputs: outputsValue, styles: stylesValue, previewOutputId: previewOutputIdValue })
    const allOverlays: OverlayItem[] = sortByName(keysToID(overlaysValue)).filter((a) => !hide.includes(a.id))
    const filteredOverlays = searchValue.length > 1 ? allOverlays.filter((a) => filter(a.name || "").includes(filter(searchValue))) : allOverlays

    useEffect(() => {
        if (loaded || !filteredOverlays.length) return
        if (lazyLoader >= filteredOverlays.length) {
            setLoaded(true)
            return
        }
        const timeout = setTimeout(() => setLazyLoader(lazyLoader + 16), 25)
        return () => clearTimeout(timeout)
    }, [loaded, lazyLoader, filteredOverlays.length])

    function changeSearch(value: string | null) {
        const next = value || ""
        if (next !== prevSearchValue.current) {
            prevSearchValue.current = next
            setLoaded(false)
            setLazyLoader(INITIAL_BATCH)
        }
        setSearchValue(next)
    }

    function select(selectedId: string) {
        setActive(selectedId)

        const data = get(popupData)
        if (data.trigger) data.trigger(selectedId)

        popupData.set({ id: "select_overlay", value: selectedId })

        setTimeout(() => {
            setTimeout(() => popupData.set({}), 500)
            activePopup.set(null)
        })
    }

    function createNew() {
        const overlayId = uid()
        history({ id: "UPDATE", oldData: { id: overlayId }, location: { page: "drawer", id: "overlay" } })
        select(overlayId)
    }

    return (
        <>
            <Button className="popup-options" icon="add" iconSize={1.3} title="new.overlay" onClick={createNew} white />

            {allOverlays.length > 8 ? (
                <div style={{ marginBottom: "10px" }}>
                    <TextField label="main.search" value={searchValue} onInput={changeSearch} autofocus />
                </div>
            ) : null}

            <div style={{ position: "relative", height: "100%", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)", overflowY: "auto" }}>
                {filteredOverlays.length ? (
                    <div className={stylesCSS.grid}>
                        {filteredOverlays.map((overlay, i) => (
                            <div key={overlay.id}>
                                <Card width={25} active={active === overlay.id} label={overlay.name || ""} color={overlay.color} resolution={resolution} onClick={() => select(overlay.id)} />
                                {loaded || i < lazyLoader ? (
                                    <>
                                        <Zoomed resolution={resolution} background={overlay.items?.length ? "var(--primary);" : overlay.color || "var(--primary);"} checkered={!!overlay.items?.length} />
                                        {(overlay.items || []).map((item, index) => (
                                            <Textbox key={index} item={item} ref={{ type: "overlay", id: overlay.id }} preview miniPreview />
                                        ))}
                                    </>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                        <T id={searchValue.length > 1 ? "empty.search" : "empty.general"} />
                    </Center>
                )}
            </div>
        </>
    )
}
