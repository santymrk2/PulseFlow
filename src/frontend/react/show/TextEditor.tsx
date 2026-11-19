import { useEffect, useState, type KeyboardEvent } from "react"
import type { Show } from "../../../types/Show"
import { getQuickExample } from "../../converters/txt"
import { activePopup, textEditZoom } from "../../shared/core/stores"
import { formatText } from "../../components/show/formatTextEditor"
import { getPlainEditorText } from "../../components/show/getTextEditor"
import { transposeText } from "../../utils/chordTranspose"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { getNormalizedKey } from "../../utils/shortcuts"
import { Icon } from "../helpers/Icon"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { Button } from "../ui/button/Button"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import { useStore } from "../hooks/useStore"
import { HighlightedNotes } from "./tools/HighlightedNotes"

export interface TextEditorProps {
    currentShow?: Show
}

// (F24.20a). El índice de caja de texto es estado local, como en Svelte.
export function TextEditor({ currentShow }: TextEditorProps) {
    const zoom = useStore(textEditZoom)
    const [itemIndex, setItemIndex] = useState(0)
    const [text, setText] = useState("")

    const slides = Object.values(currentShow?.slides || {})
    const hasLockedSlide = slides.some((slide) => slide?.locked)
    const isLocked = !!currentShow?.locked || hasLockedSlide
    const maxTextboxes = slides.reduce((max, slide) => {
        const count = (slide?.items || []).reduce((total, item) => total + ((item?.type || "text") === "text" || item?.lines ? 1 : 0), 0)
        return Math.max(max, count)
    }, 0)
    const showHasChords = slides.some((slide) => slide?.items?.some((item) => item.lines?.some((line) => line.chords)))

    useEffect(() => {
        if (currentShow) setText(getPlainEditorText("", false, itemIndex))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentShow, itemIndex])

    useEffect(() => {
        if (itemIndex > maxTextboxes) setItemIndex(0)
    }, [itemIndex, maxTextboxes])

    useEffect(() => {
        if (isLocked) newToast("output.state_locked")
    }, [isLocked])

    function keydown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.shiftKey || event.altKey) return
        const ctrlKey = event.ctrlKey || event.metaKey ? getNormalizedKey(event as unknown as globalThis.KeyboardEvent) : ""
        if (ctrlKey === "f") activePopup.set("find_replace")
    }

    function format(value: string) {
        setText(value)
        formatText(value, "", itemIndex)
    }

    return (
        <>
            <HighlightedNotes className="context #editbox_text" disabled={isLocked} style={{ padding: 30, paddingBottom: 60, scrollPaddingBottom: 60, fontSize: `${zoom / 8}em` }} placeholder={getQuickExample()} value={text} onChange={(value) => format(value)} onKeydown={keydown} />

            <FloatingBar side="left">
                {showHasChords && itemIndex === 0 ? (
                    <>
                        <Button onClick={() => format(transposeText(text, 1))} title="edit.transpose_up">
                            <Icon id="arrow_up" size={1.3} white />
                        </Button>
                        <Button onClick={() => format(transposeText(text, -1))} title="edit.transpose_down">
                            <Icon id="arrow_down" size={1.3} white />
                        </Button>
                    </>
                ) : null}
                <ZoomControl hidden={showHasChords && itemIndex === 0} columns={zoom / 10} min={0.5} max={2} defaultValue={1} addValue={-0.1} onChange={(value) => textEditZoom.set(value * 10)} />
            </FloatingBar>

            {maxTextboxes > 1 ? (
                <FloatingBar side="right">
                    <Button disabled={itemIndex <= 0} onClick={() => setItemIndex(itemIndex - 1)} title="media.previous">
                        <Icon id="remove" size={1.1} white />
                    </Button>
                    <Button onClick={() => setItemIndex(0)} title={itemIndex > 0 ? "actions.reset" : ""} style={{ minWidth: 45 }}>
                        <span style={{ fontSize: "0.85em", opacity: 0.8, fontWeight: 500 }}>{itemIndex === 0 ? translateText("category.all") : `#${itemIndex}`}</span>
                    </Button>
                    <Button disabled={itemIndex >= maxTextboxes} onClick={() => setItemIndex(itemIndex + 1)} title="media.next">
                        <Icon id="add" size={1.1} white />
                    </Button>
                </FloatingBar>
            ) : null}
        </>
    )
}
