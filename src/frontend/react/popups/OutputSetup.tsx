import { useEffect, useState } from "react"
import { popupData } from "../../stores"
import { translateText } from "../../utils/language"
import { setPopupSubmit } from "../../utils/popup"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"
import { Button } from "../ui/button/Button"
import styles from "./OutputSetup.module.css"

// Port de components/main/popups/OutputSetup.svelte. Lee ningún store; escribe popupData = { id: "choose_output_type", value: { localType, networkType } } al confirmar
// (botón o Enter, con setPopupSubmit registrado en cada render para ver la selección actual).
export function OutputSetup() {
    const [localType, setLocalType] = useState("")
    const [networkType, setNetworkType] = useState("")

    const localTypes = [
        { id: "window", name: translateText("settings.window"), icon: "hdmi", tip: "HDMI, DisplayPort" },
        { id: "blackmagic", name: "Blackmagic Design", icon: "blackmagic", tip: "DeckLink, UltraStudio" }
    ]

    const networkTypes = [
        { id: "ndi", name: "NDI®", icon: "ndi", tip: "IP, OBS" },
        { id: "omt", name: "OMT", icon: "omt", tip: "IP" },
        { id: "webrtc", name: "WebRTC", icon: "broadcast", tip: "WHIP, restream.io" },
        { id: "rtmp", name: "RTMP", icon: "broadcast", tip: "YouTube, Twitch, Facebook Live" }
    ]

    function confirm() {
        if (!localType && !networkType) return

        popupData.set({ id: "choose_output_type", value: { localType, networkType } })
    }

    useEffect(() => setPopupSubmit(confirm))

    return (
        <>
            <div className={styles.types}>
                <div className={styles.section}>
                    <p className={styles.title}>{translateText("settings.local_output")}</p>
                    <ChoiceGrid options={localTypes} value={localType} highlightFirst={false} canDeselect onClick={setLocalType} />
                </div>

                <div className={styles.section}>
                    <p className={styles.title}>{translateText("settings.network_output")}</p>
                    <ChoiceGrid options={networkTypes} value={networkType} highlightFirst={false} canDeselect onClick={setNetworkType} />
                </div>
            </div>

            <Button variant="default" disabled={!localType && !networkType} style={{ marginTop: "20px", width: "100%" }} onClick={confirm}>
                {translateText("popup.confirm")}
            </Button>
        </>
    )
}
