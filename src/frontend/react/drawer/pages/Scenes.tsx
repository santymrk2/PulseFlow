import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react"
import type { Scene } from "../../../../types/Show"
import { activeEdit, activePage, activeProfile, labelsDisabled, mediaOptions, outLocked, outputs, previewOutputId, profiles, scenes, styles as stylesStore } from "../../../shared/core/stores"
import { getResolution, findMatchingOut, startScene } from "../../../shared/utils/helpers/output"
import { history } from "../../../shared/utils/helpers/history"
import { clone, keysToID, sortByName } from "../../../shared/utils/helpers/array"
import { getAccess } from "../../../shared/utils/profile"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { DropArea } from "../../system/DropArea"
import { SelectElem } from "../../system/SelectElem"
import { Card } from "../Card"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { SceneActions } from "./SceneActions"
import { ScenePreview } from "./ScenePreview"
import styles from "./Scenes.module.css"

// Port de components/drawer/pages/Scenes.svelte: grilla de escenas con carga por lotes.
export function Scenes() {
    const scenesValue = useStore(scenes)
    const outputsValue = useStore(outputs)
    const mediaOptionsValue = useStore(mediaOptions)
    const labelsDisabledValue = useStore(labelsDisabled)
    const outLockedValue = useStore(outLocked)
    const activePageValue = useStore(activePage)
    const activeEditValue = useStore(activeEdit)
    const activeProfileValue = useStore(activeProfile)
    useStore(stylesStore)
    useStore(previewOutputId)
    useStore(profiles)

    const profile = (activeProfileValue ? getAccess("scenes") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read"

    const resolution = getResolution()

    const filteredScenes = sortByName(keysToID(scenesValue) as (Scene & { id: string })[]).filter((s) => profile[s.id] !== "none")
    const fullFilteredScenes = clone(filteredScenes)

    const [lazyLoader, setLazyLoader] = useState(0)
    const [loaded, setLoaded] = useState(false)

    // lazy loader
    useEffect(() => {
        if (loaded || !fullFilteredScenes.length) return
        if (lazyLoader >= fullFilteredScenes.length) {
            setLoaded(true)
            return
        }

        const timeout = setTimeout(
            () => {
                setLazyLoader((current) => {
                    const batch = current === 0 ? 4 : Math.min(32, current * 2)
                    return current + batch
                })
            },
            lazyLoader === 0 ? 60 : 30
        )

        return () => clearTimeout(timeout)
    }, [loaded, lazyLoader, fullFilteredScenes.length])

    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    function wheel(e: WheelEvent<HTMLDivElement>) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout.current) return

        mediaOptions.set({ ...mediaOptionsValue, columns: Math.max(2, Math.min(10, mediaOptionsValue.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
        }, 500)
    }

    function sceneClick(e: ReactMouseEvent, id: string) {
        if (outLockedValue || e.ctrlKey || e.metaKey) return
        const target = e.target instanceof Element ? e.target : null
        if (target?.closest(".edit") || target?.closest(".icons")) return

        startScene(id)
    }

    return (
        <>
            <div style={{ position: "relative", height: "100%", overflowY: "auto" }} className={`context #drawer_scenes${readOnly ? "_readonly" : ""}`} onWheel={wheel}>
                <DropArea id="scenes">
                    {fullFilteredScenes.length ? (
                        <div className={styles.grid} style={{ "--width": `${100 / mediaOptionsValue.columns}%` } as CSSProperties}>
                            {fullFilteredScenes.map((scene, i) => {
                                const isReadOnly = readOnly || profile[scene.id] === "read"
                                const isActive = findMatchingOut(scene.id, outputsValue) !== null

                                return (
                                    <SelectElem key={scene.id} id="scene" data={scene.id} className={`context #scene_card${isReadOnly ? "_readonly" : ""}`} draggable fill>
                                        <Card width={100} preview={activePageValue === "edit" ? activeEditValue.type === "scene" && activeEditValue.id === scene.id : false} outlineColor={findMatchingOut(scene.id, outputsValue)} active={isActive} label={scene.name} renameId={`scene_${scene.id}`} resolution={resolution} showPlayOnHover={!isActive} onClick={(e) => sceneClick(e, scene.id)}>
                                            {loaded || i < lazyLoader ? (
                                                <>
                                                    <ScenePreview scene={scene} />
                                                    <SceneActions columns={mediaOptionsValue.columns} sceneId={scene.id} />
                                                </>
                                            ) : null}
                                        </Card>
                                    </SelectElem>
                                )
                            })}
                        </div>
                    ) : (
                        <Center size={1.2} faded>
                            {filteredScenes.length ? <T id="empty.search" /> : <T id="empty.general" />}
                        </Center>
                    )}
                </DropArea>
            </div>

            <FloatingBar onlyOne>
                <Button disabled={readOnly} icon="add" title="new.scene" onClick={() => history({ id: "UPDATE", location: { page: "drawer", id: "scene" } })}>
                    {!labelsDisabledValue ? <T id="new.scene" /> : null}
                </Button>
            </FloatingBar>
        </>
    )
}
