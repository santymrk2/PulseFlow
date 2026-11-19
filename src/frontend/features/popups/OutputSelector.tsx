import { useEffect, useState } from "react"
import type { Display } from "../../../types/Main"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../shared/core/ipc/main"
import { clone, keysToID } from "../../shared/utils/helpers/array"
import { PreviewOutput } from "../../react/output/PreviewOutput"
import { openSettings } from "../../components/settings/openSettings"
import { activePopup, currentOutputSettings, outputs } from "../../shared/core/stores"
import { send } from "../../shared/utils/request"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { triggerClickOnEnterSpace } from "../../shared/ui/helpers/triggerClickOnEnterSpace"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./OutputSelector.module.css"

// Port de components/main/popups/OutputSelector.svelte. Lee outputs (al renderizar) y pide los monitores con requestMain(Main.GET_DISPLAYS) al montar.
// Escribe: currentOutputSettings + activePopup al elegir una salida (abre Configuración/Pantallas) y send(OUTPUT, ["IDENTIFY_SCREENS"], screens).
interface PreviewScreen extends Display {
    previewBounds: { x: number; y: number }
}

export function OutputSelector() {
    const outputsValue = useStore(outputs)
    const [screens, setScreens] = useState<PreviewScreen[]>([])
    const [minPosX, setMinPosX] = useState<number | null>(null)
    const [minPosY, setMinPosY] = useState<number | null>(null)
    const [totalScreensWidth, setTotalScreensWidth] = useState(0)
    const [totalScreensHeight, setTotalScreensHeight] = useState(0)

    const outputWindows = keysToID(outputsValue)
        .filter((a) => !a.invisible)
        .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? 1 : -1))

    useEffect(() => {
        let mounted = true
        void (async () => {
            const displays = (await requestMain(Main.GET_DISPLAYS)) || []
            const sorted = [...displays].sort((a, b) => a.bounds.x - b.bounds.x).sort((a, b) => Number(!!b.internal) - Number(!!a.internal))

            let minX: number | null = null
            let minY: number | null = null
            let maxX: number | null = null
            let maxY: number | null = null
            clone(sorted).forEach(({ bounds }) => {
                if (minX === null || bounds.x < minX) minX = bounds.x
                if (minY === null || bounds.y < minY) minY = bounds.y
                if (maxX === null || bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width
                if (maxY === null || bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height
            })

            if (!mounted) return
            setMinPosX(minX)
            setMinPosY(minY)
            setTotalScreensWidth(Math.min(maxX !== null && minX !== null ? (maxX - minX) / 2 : 0, 4800))
            setTotalScreensHeight(Math.min(maxY !== null && minY !== null ? (maxY - minY) / 2 : 0, 1000))

            setScreens(
                sorted.map((a) => ({
                    ...a,
                    previewBounds: { x: a.bounds.x - (minX || 0), y: a.bounds.y - (minY || 0) }
                }))
            )
        })()
        return () => {
            mounted = false
        }
    }, [])

    function identifyScreens() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], screens)
    }

    function openOutput(outputId: string) {
        currentOutputSettings.set(outputId)
        openSettings("display_settings")
        activePopup.set(null)
    }

    return (
        <>
            <div className={styles.content}>
                {screens.length ? (
                    <div className={styles.screens} style={{ transform: `translate(-${totalScreensWidth}px, -${totalScreensHeight}px)` }}>
                        {screens.map((screen, i) => (
                            <div key={screen.id || i} className={`${styles.screen} ${styles.noClick}`} style={{ opacity: 0.4, width: `${screen.bounds.width}px`, height: `${screen.bounds.height}px`, insetInlineStart: `${screen.previewBounds.x}px`, top: `${screen.previewBounds.y}px` }}>
                                {i + 1}
                            </div>
                        ))}

                        {outputWindows.map((currentScreen) => (
                            <div key={currentScreen.id} style={{ zIndex: currentScreen.enabled ? 1 : 0, opacity: currentScreen.enabled ? 1 : 0.8, position: "absolute", width: `${currentScreen.bounds?.width}px`, height: `${currentScreen.bounds?.height}px`, insetInlineStart: `${(currentScreen.bounds?.x ?? 0) - (minPosX || 0)}px`, top: `${(currentScreen.bounds?.y ?? 0) - (minPosY || 0)}px` }}>
                                {!currentScreen.enabled ? <span style={{ zIndex: 2, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "0.5em", pointerEvents: "none" }}>{currentScreen.name}</span> : null}

                                <div data-title={`main.open: <b>${currentScreen.name}</b>`} className={styles.screen} style={{ width: "100%", height: "100%", ...(currentScreen.screen && screens.find((a) => a.id.toString() === currentScreen.screen) ? { opacity: 1 } : {}) }} onClick={() => openOutput(currentScreen.id)} role="button" tabIndex={0} onKeyDown={triggerClickOnEnterSpace}>
                                    {currentScreen.enabled ? <PreviewOutput outputId={currentScreen.id} disableTransitions /> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <T id="remote.loading" />
                )}
            </div>

            <div className={styles.bottom}>
                <Button variant="outline" onClick={identifyScreens} title="settings.identify_screens" style={{ padding: "12px" }}>
                    <Icon id="search" size={1.4} white />
                </Button>
            </div>
        </>
    )
}
