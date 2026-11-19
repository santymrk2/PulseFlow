import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react"
import type { Overlay } from "../../../../types/Show"
import { activeEdit, activePage, activeProfile, activeShow, labelsDisabled, mediaOptions, overlayCategories, outputs, overlays, previewOutputId, profiles, styles as stylesStore } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { addProjectItem } from "../../../converters/project"
import { clone, keysToID, sortByName } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { findMatchingOut, getResolution } from "../../../shared/utils/helpers/output"
import { toggleOverlayOutput } from "../../../shared/utils/helpers/overlayOutput"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Textbox } from "../../slide/Textbox"
import { Zoomed } from "../../slide/Zoomed"
import { Center } from "../../system/Center"
import { DropArea } from "../../system/DropArea"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Card } from "../Card"
import { Effects } from "../effects/Effects"
import { OverlayActions } from "./OverlayActions"
import styles from "./Overlays.module.css"

// Port de components/drawer/pages/Overlays.svelte: grilla de overlays con carga por lotes.
// Zoomed y Textbox se importan directamente desde sus ports React (F24.24 P8g).
export interface OverlaysProps {
    active: string | null
    // Overlay editor: lista de una columna en el panel izquierdo; un clic abre el overlay para editarlo
    columns?: number | null
    editOnClick?: boolean
}

interface OverlayWithId extends Overlay {
    id: string
}

interface LazyState {
    active: string | null
    count: number
    loaded: boolean
}

export function Overlays({ active, columns = null, editOnClick = false }: OverlaysProps) {
    const overlaysValue = useStore(overlays)
    const overlayCategoriesValue = useStore(overlayCategories)
    const activeProfileValue = useStore(activeProfile)
    const activeShowValue = useStore(activeShow)
    const activeEditValue = useStore(activeEdit)
    const activePageValue = useStore(activePage)
    const mediaOptionsValue = useStore(mediaOptions)
    const labelsDisabledValue = useStore(labelsDisabled)
    const outputsValue = useStore(outputs)
    useStore(stylesStore)
    useStore(previewOutputId)
    useStore(profiles)

    const profile = (activeProfileValue ? getAccess("overlays") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read" || profile[active || ""] === "read"
    const gridColumns = columns ?? mediaOptionsValue.columns

    const resolution = getResolution()

    const filteredOverlays = sortByName(keysToID(clone(overlaysValue)) as (Overlay & { id: string })[]).filter((s) => (active === "all" && !overlayCategoriesValue[s?.category || ""]?.isArchive) || active === s.category || (active === "unlabeled" && (s.category === null || !overlayCategoriesValue[s.category])))
    const fullFilteredOverlays = clone(filteredOverlays)

    // lazy loader: el estado guarda la categoría para resetearse junto con el cambio de `active`
    const [lazy, setLazy] = useState<LazyState>(() => ({ active, count: 0, loaded: false }))
    useEffect(() => {
        if (lazy.active !== active) {
            setLazy({ active, count: 0, loaded: false })
            return
        }
        if (lazy.loaded || !fullFilteredOverlays.length) return
        if (lazy.count >= fullFilteredOverlays.length) {
            setLazy({ ...lazy, loaded: true })
            return
        }

        const timeout = setTimeout(
            () => {
                setLazy((current) => ({ ...current, count: current.count + (current.count === 0 ? 4 : Math.min(32, current.count * 2)) }))
            },
            lazy.count === 0 ? 60 : 30
        )

        return () => clearTimeout(timeout)
    }, [lazy, active, fullFilteredOverlays.length])

    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    function wheel(e: WheelEvent<HTMLDivElement>) {
        if (columns !== null || (!e.ctrlKey && !e.metaKey)) return
        if (nextScrollTimeout.current) return

        mediaOptions.set({ ...mediaOptionsValue, columns: Math.max(2, Math.min(10, mediaOptionsValue.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
        }, 500)
    }

    const overlayWithNonExistentCategory = active === "unlabeled" && filteredOverlays.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredOverlays.map((s) => s.category))].filter((c) => c && !overlayCategoriesValue[c]) as string[]

        overlayCategories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }

    function overlayClick(e: ReactMouseEvent<HTMLDivElement>, id: string) {
        if (e.ctrlKey || e.metaKey) return
        const target = e.target instanceof Element ? e.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return

        // Overlay editor: un clic abre el overlay para editarlo (no lo saca al aire)
        if (editOnClick) {
            activeEdit.set({ type: "overlay", id, items: [] })
            activePage.set("edit")
            return
        }

        toggleOverlayOutput(id)
    }

    function overlayDblClick(e: ReactMouseEvent<HTMLDivElement>, overlay: OverlayWithId) {
        if (e.ctrlKey || e.metaKey) return
        const target = e.target instanceof Element ? e.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return

        addProjectItem({ id: overlay.id, name: overlay.name || "", type: "overlay" })
    }

    return (
        <>
            <div style={{ position: "relative", height: "100%", overflowY: "auto" }} className="context #drawer_overlays" onWheel={wheel}>
                {active === "effects" ? (
                    <Effects />
                ) : (
                    <DropArea id="overlays">
                        {fullFilteredOverlays.length ? (
                            <div className={styles.grid} style={{ "--width": `${100 / gridColumns}%` } as CSSProperties}>
                                {fullFilteredOverlays.map((overlay, i) => {
                                    const isReadOnly = readOnly || profile[overlay.category || ""] === "read"
                                    const isActive = findMatchingOut(overlay.id, outputsValue) !== null

                                    return (
                                        <SelectElem key={overlay.id} id="overlay" data={overlay.id} className={`context #overlay_card${overlay.isDefault && !isReadOnly ? "_default" : ""}${isReadOnly ? "_readonly" : ""}`} draggable fill>
                                            <Card
                                                width={100}
                                                preview={activePageValue === "edit" ? activeEditValue.type === "overlay" && activeEditValue.id === overlay.id : activeShowValue?.type === "overlay" && activeShowValue?.id === overlay.id}
                                                outlineColor={findMatchingOut(overlay.id, outputsValue)}
                                                active={isActive}
                                                label={overlay.name}
                                                renameId={`overlay_${overlay.id}`}
                                                icon={overlay.isDefault ? "protected" : null}
                                                color={overlay.color}
                                                resolution={resolution}
                                                showPlayOnHover
                                                onClick={(e) => overlayClick(e, overlay.id)}
                                                onDblClick={(e) => overlayDblClick(e, overlay)}
                                            >
                                                {lazy.loaded || i < lazy.count ? (
                                                    <>
                                                        {/* icons */}
                                                        <OverlayActions columns={gridColumns} overlayId={overlay.id} />

                                                        <Zoomed resolution={resolution} background={overlay.items.length ? "var(--primary);" : overlay.color || "var(--primary);"} checkered={!!overlay.items.length}>
                                                            {overlay.items.map((item, index) => (
                                                                <Textbox key={index} item={item} ref={{ type: "overlay", id: overlay.id }} preview miniPreview />
                                                            ))}
                                                        </Zoomed>
                                                    </>
                                                ) : null}
                                            </Card>
                                        </SelectElem>
                                    )
                                })}
                            </div>
                        ) : (
                            <Center size={1.2} faded>
                                {filteredOverlays.length ? <T id="empty.search" /> : <T id="empty.general" />}
                            </Center>
                        )}
                    </DropArea>
                )}
            </div>

            {overlayWithNonExistentCategory ? (
                <FloatingBar side="left" onlyOne>
                    <Button onClick={createNonExistentCategories}>
                        <Icon id="autofill" />
                        <T id="category.create_nonexistent" />
                    </Button>
                </FloatingBar>
            ) : null}

            {active === "effects" ? (
                <FloatingBar onlyOne>
                    <Button disabled={readOnly} icon="add" title="new.effect" onClick={() => history({ id: "UPDATE", location: { page: "drawer", id: "effect" } })}>
                        {!labelsDisabledValue ? <T id="new.effect" /> : null}
                    </Button>
                </FloatingBar>
            ) : (
                <FloatingBar onlyOne>
                    <Button disabled={readOnly} icon="add" title="new.overlay" onClick={() => history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })}>
                        {!labelsDisabledValue ? <T id="new.overlay" /> : null}
                    </Button>
                </FloatingBar>
            )}
        </>
    )
}
