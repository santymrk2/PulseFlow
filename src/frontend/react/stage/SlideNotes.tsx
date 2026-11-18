import type { OutSlide } from "../../../types/Show"
import { showsCache } from "../../stores"
import { getLayoutRef } from "../../components/helpers/show"
import { getStageTextLayoutOffset } from "../../components/stage/stage"
import { useStore } from "../hooks/useStore"
import styles from "./SlideNotes.module.css"

export interface SlideNotesProps {
    currentSlide: OutSlide
    slideOffset?: number
    autoSize?: number
}

// (F24.19a).
export function SlideNotes({ currentSlide, slideOffset = 0, autoSize = 100 }: SlideNotesProps) {
    const currentShows = useStore(showsCache)
    const showRef = currentSlide ? getLayoutRef(currentSlide.id) : []
    const slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    const customOffset = getStageTextLayoutOffset(showRef, slideOffset, slideIndex)
    const slideId = customOffset !== null && currentSlide ? showRef[customOffset]?.id || null : null
    const slide = currentSlide && slideId ? currentShows[currentSlide.id]?.slides?.[slideId] : null
    const notes = slide?.notes ? slide.notes.replaceAll("\n", "<br>") : ""

    if (!slide) return null

    return <div className={`autoFontSize ${styles.notes}`} style={{ fontSize: `${autoSize}px` }} dangerouslySetInnerHTML={{ __html: notes }} />
}
