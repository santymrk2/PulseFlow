import { useEffect, useState, type MouseEvent } from "react"
import type { TabsObj } from "../../../types/Tabs"
import { clone } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { updateActiveSceneOutputs } from "../../shared/utils/helpers/output"
import { openSettings } from "../../components/settings/openSettings"
import { activeEdit, activePopup, activeStyle, overlays, popupData, scenes, selected, styles } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Tabs } from "../main/Tabs"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { PopupField } from "../ui/popup-field/PopupField"
import stylesModule from "./SceneTools.module.css"

const tabs: TabsObj = {
    scene: { name: "tools.scene", icon: "scene" }
}

// Port de components/edit/SceneTools.svelte. Las pestañas usan el port React (onActiveChange).
export function SceneTools() {
    const currentActiveEdit = useStore(activeEdit)
    const currentScenes = useStore(scenes)
    const currentStyles = useStore(styles)
    const currentOverlays = useStore(overlays)
    const currentSelected = useStore(selected)

    const [active, setActive] = useState(Object.keys(tabs)[0])

    const sceneId = currentActiveEdit.id || ""
    const scene = currentScenes[sceneId] || { content: {} }
    const content = scene.content || {}
    const styleId = (content.style || "") as string
    const overlaysList = (content.overlays || []) as string[]

    function updateContent(key: string, data: unknown, shouldOverride = false) {
        if (!sceneId) return

        const newContent = { ...clone(scene.content || {}), [key]: data }
        history({
            id: "UPDATE",
            newData: { key: "content", data: newContent },
            oldData: { id: sceneId },
            location: { page: "drawer", id: "scene_key", ...(shouldOverride ? { override: `content_${key}_${sceneId}` } : {}) }
        })

        updateActiveSceneOutputs(sceneId)
    }

    function editStyle() {
        activeStyle.set(styleId)
        openSettings("styles")
    }

    function openAddOverlay() {
        popupData.set({
            hide: overlaysList,
            trigger: (value: string) => addOverlay(value)
        })

        activePopup.set("select_overlay")
    }

    function addOverlay(overlayId: string) {
        if (!overlayId || overlaysList.includes(overlayId)) return

        const currentOverlays = clone(overlaysList)
        currentOverlays.push(overlayId)
        updateContent("overlays", currentOverlays)

        overlays.update((all) => {
            if (scene.name && all[overlayId] && !all[overlayId].name) {
                all[overlayId].name = scene.name
            }
            return all
        })
    }

    function moveOverlay(index: number, direction: number) {
        const currentOverlays = clone(overlaysList)
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= currentOverlays.length) return

        const temp = currentOverlays[index]
        currentOverlays[index] = currentOverlays[targetIndex]
        currentOverlays[targetIndex] = temp

        updateContent("overlays", currentOverlays)
    }

    function toggleSelectOverlay(index: number, overlayId: string) {
        if (currentSelected.id === "scene_overlay" && currentSelected.data?.[0]?.index === index) {
            selected.set({ id: null, data: [] })
        } else {
            selected.set({ id: "scene_overlay", data: [{ id: overlayId, index }] })
        }
    }

    function deselectOverlay() {
        selected.update((sel) => {
            if (sel.id === "scene_overlay") return { id: null, data: [] }
            return sel
        })
    }

    useEffect(() => {
        return () => {
            selected.update((sel) => {
                if (sel.id === "scene_overlay") return { id: null, data: [] }
                return sel
            })
        }
    }, [])

    function handleMainClick(event: MouseEvent<HTMLDivElement>) {
        const target = event.target as Element | null
        if (!target?.closest(".overlay-item") && !target?.closest(".contextMenu")) deselectOverlay()
    }

    const media = content.media as { name?: string; id?: string; type?: string } | undefined

    return (
        <div className={`main border editTools ${stylesModule.main}`} onClick={handleMainClick}>
            <Tabs tabs={tabs} active={active} onActiveChange={setActive} />

            <div className={stylesModule.content}>
                <PopupField label="popup.choose_media_input" value={content.media} name={media?.name || media?.id || ""} icon={media?.type || "camera"} popupId="choose_media_input" onChange={(value) => updateContent("media", value || null)} allowEmpty />

                <InputRow style={{ marginTop: "5px" }}>
                    <PopupField label="actions.id_select_output_style" value={styleId} name={currentStyles[styleId]?.name || ""} icon="styles" popupId="select_style" onChange={(value) => updateContent("style", (value as string) || "")} allowEmpty />
                    {currentStyles[styleId] ? <Button title="titlebar.edit" icon="edit" onClick={editStyle} /> : null}
                </InputRow>

                <div style={{ marginTop: "10px" }}>
                    <div className={stylesModule.title}>
                        <span style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px" }}>
                            <Icon id="overlays" white />
                            <p>
                                <T id="tabs.overlays" />
                            </p>
                        </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {overlaysList.map((overlayId, index) => {
                            const overlayObj = currentOverlays[overlayId]
                            const isHidden = ((content.hiddenOverlays || []) as string[]).includes(overlayId)
                            const isSelected = currentSelected.id === "scene_overlay" && currentSelected.data?.[0]?.index === index
                            return (
                                <div
                                    key={`${index}_${overlayId}`}
                                    id={`#${index}`}
                                    data-index={index}
                                    data-overlay-id={overlayId}
                                    className={`overlay-item context #scene_overlay ${stylesModule.overlayItem} ${isSelected ? `selected ${stylesModule.selected}` : ""}`}
                                    onClick={() => toggleSelectOverlay(index, overlayId)}
                                    onMouseDown={(event) => {
                                        if (event.button === 2) {
                                            selected.set({ id: "scene_overlay", data: [{ id: overlayId, index }] })
                                        }
                                    }}
                                >
                                    <div className={stylesModule.itemTitle} style={isHidden ? { opacity: 0.5 } : undefined}>
                                        <span style={{ fontSize: "0.75em", opacity: 0.5, minWidth: "12px", textAlign: "center" }}>{index + 1}</span>
                                        <p style={{ fontSize: "0.9em" }}>{overlayObj?.name || translateText("main.unnamed")}</p>
                                    </div>

                                    {index < overlaysList.length - 1 ? <Button className="down" icon="down" onClick={() => moveOverlay(index, 1)} /> : null}
                                    {index > 0 ? <Button className="up" icon="up" onClick={() => moveOverlay(index, -1)} /> : null}
                                </div>
                            )
                        })}
                    </div>

                    <Button variant="outline" icon="add" style={{ width: "100%" }} onClick={openAddOverlay}>
                        <T id="edit.overlay_content" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
