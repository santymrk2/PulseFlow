import { useEffect, useRef, useState, type ComponentType } from "react"
import { get } from "../../shared/core/lib/store"
import type { Popups } from "../../../types/Main"
import { EFFECTS_LIST } from "../../audio/effects/audioEffectsHelpers"
import { activePopup, alertMessage, os, popupData, special } from "../../shared/core/stores"
import { MENU_BAR_HEIGHT } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { clearPopupSubmit } from "../../shared/utils/popup"
import { disablePopupClose } from "../../app/wiring/shortcuts"
import { reactPopups } from "../popups/registry"
import { useStore } from "../../shared/ui/hooks/useStore"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./Popup.module.css"

const FULL_MODALS: Popups[] = ["looks", "screen_config", "add_shows", "playlist_options"]

export function Popup() {
    const currentPopup = useStore(activePopup)
    const alert = useStore(alertMessage)
    const osValue = useStore(os)
    const data = useStore(popupData)
    const specialValue = useStore(special)

    const [popupId, setPopupId] = useState<Popups | null>(null)
    const [scrolled, setScrolled] = useState(false)
    const popupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const popupIdRef = useRef<Popups | null>(null)

    const isWindows = osValue.platform === "win32"
    const isOptimized = !!specialValue.optimizedMode

    useEffect(() => {
        popupIdRef.current = popupId
    }, [popupId])

    useEffect(() => {
        if (popupTimeout.current) return

        if (popupIdRef.current !== currentPopup) clearPopupSubmit()

        setPopupId(currentPopup)
        popupTimeout.current = setTimeout(() => {
            popupTimeout.current = null
            if (popupIdRef.current !== get(activePopup)) {
                setPopupId(get(activePopup))
            }
        }, 250)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPopup])

    useEffect(() => {
        return () => {
            if (popupTimeout.current) clearTimeout(popupTimeout.current)
        }
    }, [])

    useEffect(() => {
        if (popupId === null) setScrolled(false)
    }, [popupId])

    function mousedown(e: React.MouseEvent<HTMLDivElement>) {
        if (popupId && disablePopupClose.includes(popupId)) return
        if (popupId === "alert" && alert === "actions.closing") return
        if ((e.target as HTMLElement).classList?.contains(styles.popup) || (e.target as HTMLElement).classList?.contains("popup")) activePopup.set(null)
    }

    function onScroll(e: React.UIEvent<HTMLDivElement>) {
        setScrolled(e.currentTarget.scrollTop > 0)
    }

    if (popupId === null) return null

    const ReactPopup = reactPopups[popupId] as ComponentType | undefined

    if (FULL_MODALS.includes(popupId)) return ReactPopup ? <ReactPopup /> : null

    return (
        <div style={isWindows ? { height: `calc(100% - ${MENU_BAR_HEIGHT}px)` } : undefined} className={`${styles.popup}${isOptimized ? ` ${styles.isOptimized}` : ""}`} onMouseDown={mousedown}>
            <div className={styles.card}>
                {popupId !== "alert" ? (
                    <div className={styles.headerContent} style={{ borderBottom: "1px solid var(--border-color, var(--primary-lighter))", ...(scrolled ? { boxShadow: "2px 2px 4px 5px color-mix(in srgb, black 10%, transparent)" } : {}) }}>
                        <div className={styles.headerMargin}>
                            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>
                                {data?.popupTitle ? (
                                    translateText(data.popupTitle)
                                ) : popupId === "new_update" ? (
                                    <>
                                        <T id="about.new_update" />: <span style={{ color: "var(--secondary)" }}>v{data?.latestVersion}</span>
                                    </>
                                ) : popupId === "audio_effect" && data?.effect ? (
                                    <T id={EFFECTS_LIST.find((a) => a.id === data.effect)?.label || "popup.audio_effect"} />
                                ) : (
                                    <T id={`popup.${popupId}`} />
                                )}
                            </h2>

                            {!disablePopupClose.includes(popupId) ? <Button className="popup-close" icon="close" iconSize={1.3} title="actions.close [esc]" onClick={() => activePopup.set(null)} /> : null}
                        </div>
                    </div>
                ) : null}

                <div className={styles.scroll} style={{ ["--top-height" as string]: `${isWindows ? MENU_BAR_HEIGHT : 0}px` }} onScroll={onScroll}>
                    <div className={styles.body}>{ReactPopup ? <ReactPopup /> : null}</div>
                </div>
            </div>
        </div>
    )
}
