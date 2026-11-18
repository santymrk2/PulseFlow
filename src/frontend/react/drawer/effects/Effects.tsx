import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { Effect } from "../../../../types/Effects"
import { activeEdit, activePage, activeShow, effects, mediaOptions, outputs, previewOutputId, styles as stylesStore } from "../../../stores"
import { addProjectItem } from "../../../converters/project"
import { clone, keysToID, sortByName } from "../../../components/helpers/array"
import { findMatchingOut, getResolution } from "../../../components/helpers/output"
import { toggleEffectOutput } from "../../../components/helpers/overlayOutput"
import { Effect as EffectView } from "../../output/Effect"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Zoomed } from "../../slide/Zoomed"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Card } from "../Card"
import { EffectIcons } from "./EffectIcons"
import "./Effects.module.css"

// Port de components/drawer/effects/Effects.svelte: grilla de efectos con carga por lotes.
// Effect y Zoomed se importan directamente desde sus ports React (F24.24 P8g).
export interface EffectsProps {
    // Editor de overlays: un clic abre el efecto para editarlo (no lo saca al aire)
    editOnClick?: boolean
}

interface EffectWithId extends Effect {
    id: string
}

export function Effects({ editOnClick = false }: EffectsProps) {
    const effectsValue = useStore(effects)
    const outputsValue = useStore(outputs)
    const activeEditValue = useStore(activeEdit)
    const activePageValue = useStore(activePage)
    const activeShowValue = useStore(activeShow)
    const mediaOptionsValue = useStore(mediaOptions)
    useStore(stylesStore)
    useStore(previewOutputId)

    const resolution = getResolution()
    const filteredEffects = sortByName(keysToID(clone(effectsValue)) as EffectWithId[])
    const fullFilteredEffects = clone(filteredEffects)

    // Loader lento: igual que el onMount original, el intervalo lee siempre la lista viva y se detiene al pasarse.
    const lengthRef = useRef(fullFilteredEffects.length)
    lengthRef.current = fullFilteredEffects.length
    const [slowLoader, setSlowLoader] = useState(0)
    useEffect(() => {
        let current = 0
        const loader = setInterval(() => {
            current++
            if (current > lengthRef.current + 1) {
                clearInterval(loader)
                current = -1
            }
            setSlowLoader(current)
        }, 0)

        return () => clearInterval(loader)
    }, [])

    const [hover, setHover] = useState<null | number>(null)
    function mouseenter(event: ReactMouseEvent<HTMLDivElement>, index: number) {
        const grid = document.querySelector(".grid")
        if (!grid) return
        if (event.buttons > 0) return
        setHover(index)
    }

    function effectClick(event: ReactMouseEvent<HTMLDivElement>, effect: EffectWithId) {
        if (event.ctrlKey || event.metaKey) return
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return

        if (editOnClick) {
            activeEdit.set({ type: "effect", id: effect.id, items: [] })
            activePage.set("edit")
            return
        }

        toggleEffectOutput(effect.id)
    }

    function effectDblClick(event: ReactMouseEvent<HTMLDivElement>, effect: EffectWithId) {
        if (event.ctrlKey || event.metaKey) return
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return

        addProjectItem({ id: effect.id, name: effect.name || "", type: "effect" })
    }

    return (
        <div style={{ position: "relative", height: "100%", width: "100%", overflowY: "auto" }}>
            {fullFilteredEffects.length ? (
                <div className="grid">
                    {fullFilteredEffects.map((effect, i) => (
                        <Card
                            key={effect.id}
                            className={`context #effect_card${effect.isDefault ? "_default" : ""}`}
                            width={editOnClick ? 100 : 0}
                            resolution={{ width: 16, height: 9 }}
                            preview={activePageValue === "edit" ? activeEditValue.type === "effect" && activeEditValue.id === effect.id : activeShowValue?.type === "effect" && activeShowValue?.id === effect.id}
                            outlineColor={findMatchingOut(effect.id, outputsValue)}
                            active={findMatchingOut(effect.id, outputsValue) !== null}
                            label={effect.name || ""}
                            renameId={`effect_${effect.id}`}
                            icon={effect.isDefault ? "protected" : null}
                            color={effect.color}
                            showPlayOnHover
                            onClick={(event) => effectClick(event, effect)}
                            onDblClick={(event) => effectDblClick(event, effect)}
                            onMouseEnter={(event) => mouseenter(event, i)}
                            onMouseLeave={() => setHover(null)}
                        >
                            {/* iconos */}
                            <EffectIcons columns={mediaOptionsValue.columns} effectId={effect.id} />

                            <SelectElem id="effect" data={effect.id} fill draggable>
                                <Zoomed resolution={resolution} background={effect.items?.length ? "var(--primary);" : effect.color || "var(--primary);"} checkered={!!effect.items?.length}>
                                    {slowLoader < 0 || slowLoader > i ? <EffectView key={hover === i ? "hover" : "idle"} effect={effect} preview={hover !== i} /> : null}
                                </Zoomed>
                            </SelectElem>
                        </Card>
                    ))}
                </div>
            ) : (
                <Center size={1.2} faded>
                    {filteredEffects.length ? <T id="empty.search" /> : <T id="empty.general" />}
                </Center>
            )}
        </div>
    )
}
