import type { Output } from "../../../types/Output"
import type { LayoutRef } from "../../../types/Show"
import { activeEdit, activePage, activePopup, activeShow, outLocked, popupData, showsCache } from "../../shared/core/stores"
import { refreshOut, setOutput } from "../../shared/utils/helpers/output"
import { OutputHelper } from "../../shared/utils/helpers/OutputHelper"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { updateOut } from "../../shared/utils/helpers/showActions"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button, type ButtonEvent } from "../../shared/ui/kit/button/Button"
import styles from "./ShowActions.module.css"

interface TempRef {
    temp: boolean
    items: unknown[]
    id: string
}

export interface ShowActionsProps {
    currentOutput: Output
    // En Svelte la prop se llama `ref`; en React se llama `refItems` para no colisionar con el ref del elemento.
    refItems: (LayoutRef | TempRef)[]
    linesIndex: null | number
    maxLines: null | number
}

// Port de components/output/ShowActions.svelte (F24.20b).
export function ShowActions({ currentOutput, refItems, linesIndex, maxLines }: ShowActionsProps) {
    const currentActiveShow = useStore(activeShow)
    const currentActivePage = useStore(activePage)
    const currentActiveEdit = useStore(activeEdit)
    const currentOutLocked = useStore(outLocked)
    const currentShowsCache = useStore(showsCache)

    const outSlide = currentOutput?.out?.slide
    const length = refItems?.length || 0

    // transition
    const slideData = currentShowsCache && outSlide && outSlide.id !== "temp" ? getLayoutRef(outSlide.id)[outSlide.index ?? 0]?.data : null
    const customTransition = slideData ? slideData.transition || slideData.mediaTransition : null
    const layoutLength = getLayoutRef("active", currentShowsCache).length

    // NEW / overlay / slide
    const isEdit = currentActivePage === "edit"
    const currentOverlay = isEdit ? currentActiveEdit.id || "" : currentActiveShow?.type === "overlay" ? currentActiveShow.id : ""
    const activeOverlayIds = currentOutput?.out?.overlays || []
    const overlayActive = activeOverlayIds.includes(currentOverlay)
    const currentShow = (currentActiveShow?.type || "show") === "show" ? currentActiveShow : null
    const showActive = outSlide?.id && outSlide.id === currentShow?.id && outSlide.layout === currentShowsCache[currentShow?.id || ""]?.settings?.activeLayout
    const slideActive = showActive && (isEdit ? outSlide?.index === currentActiveEdit.slide : true)
    const shouldRefresh = !!(overlayActive || slideActive)
    const shouldPlay = !!(currentOverlay || currentShow)

    function playCurrent(event: ButtonEvent) {
        if (currentOverlay) {
            setOutput("overlays", currentOverlay, true)
            return
        }

        if (!currentShow || !currentShowsCache[currentShow.id]?.settings) return

        const layout = currentShowsCache[currentShow.id].settings.activeLayout
        if (isEdit) setOutput("slide", { id: currentShow.id, layout, index: currentActiveEdit.slide })
        else setOutput("slide", { id: currentShow.id, layout, index: 0 })

        // ref || getLayoutRef()
        updateOut("active", currentActiveEdit.slide || 0, getLayoutRef(), !event.altKey)
    }

    return (
        <span className={styles.group}>
            <Button title="preview._previous_slide [Arrow Left]" disabled={currentOutLocked || outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) < 1 && (linesIndex || 0) < 1 : !layoutLength)} onClick={() => OutputHelper.advanceOutputs("previous")}>
                <Icon id="previous" size={1.2} />
            </Button>
            <Button title="preview._next_slide [Arrow Right]" disabled={currentOutLocked || outSlide?.id === "temp" || (outSlide ? (outSlide.index || 0) + 1 >= length && (linesIndex || 0) + 1 >= (maxLines || 0) : !layoutLength)} onClick={() => OutputHelper.advanceOutputs("next")}>
                <Icon id="next" size={1.2} />
            </Button>

            {shouldRefresh ? (
                <Button title="preview._update [Ctrl+R]" disabled={currentOutLocked} onClick={() => refreshOut()}>
                    <Icon id="refresh" size={1.1} />
                </Button>
            ) : (
                <Button title="preview._start [Space]" disabled={currentOutLocked || !shouldPlay || (currentActivePage === "edit" && (currentActiveEdit.type === "template" || currentActiveEdit.type === "effect"))} onClick={(_detail, event) => playCurrent(event)}>
                    <Icon id="play" size={1.2} white />
                </Button>
            )}

            <Button title={(currentOutLocked ? "preview._unlock" : "preview._lock") + " [Ctrl+L]"} onClick={() => outLocked.set(!currentOutLocked)} red={currentOutLocked}>
                <Icon id={currentOutLocked ? "locked" : "unlocked"} size={1.1} white={currentOutLocked} />
            </Button>
            <Button
                title="popup.transition"
                onClick={() => {
                    popupData.set({})
                    activePopup.set("transition")
                }}
            >
                <Icon size={1.2} id="transition" white={!!customTransition} />
            </Button>
        </span>
    )
}
