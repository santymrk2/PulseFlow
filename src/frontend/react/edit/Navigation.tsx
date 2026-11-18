import { useEffect, useMemo, useState } from "react"
import type { ClickEvent } from "../../../types/Main"
import type { ShowRef } from "../../../types/Projects"
import { activeEdit, activePage, activeShow, editHistory, editMode, effects, focusMode, labelsDisabled, overlays, refreshEditSlide, scenes, shows, templates } from "../../stores"
import { getAccess } from "../../utils/profile"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getExtension, getFileName, getMediaType } from "../../components/helpers/media"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { Slides } from "./Slides"
import styles from "./Navigation.module.css"

interface NavHistoryEntry {
    id?: string
    name?: string
    icon?: string
    edit?: unknown
    show?: (ShowRef & { index?: number }) | null
}

export function Navigation() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentEditHistory = useStore(editHistory)
    const currentEditMode = useStore(editMode)
    const currentEffects = useStore(effects)
    const currentFocusMode = useStore(focusMode)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOverlays = useStore(overlays)
    const currentScenes = useStore(scenes)
    const currentShows = useStore(shows)
    const currentTemplates = useStore(templates)

    const currentShowId = currentActiveShow?.id || currentActiveEdit.showId || ""

    function addSlide(e: { detail?: { shift?: boolean; ctrl?: boolean } }) {
        let index = 1
        let isParent = false

        if (currentActiveEdit?.slide !== null && currentActiveEdit?.slide !== undefined) {
            const ref = getLayoutRef()
            if (ref[currentActiveEdit.slide]) index = currentActiveEdit.slide + 1
        }

        if (e?.detail?.shift) isParent = true
        history({ id: "SLIDES", newData: { index, replace: { parent: isParent }, addItems: !e?.detail?.ctrl } })
    }

    const names = useMemo(
        () => ({
            show: (id: string) => _show(id).get("name"),
            media: (id: string) => getFileName(id),
            camera: () => currentActiveEdit.data?.name,
            audio: (id: string) => getFileName(id),
            overlay: (id: string) => currentOverlays[id]?.name || "",
            template: (id: string) => currentTemplates[id]?.name || "",
            scene: (id: string) => currentScenes[id]?.name || "",
            effect: (id: string) => currentEffects[id]?.name || ""
        }),
        [currentActiveEdit.data?.name, currentEffects, currentOverlays, currentScenes, currentTemplates]
    )

    useEffect(() => {
        editHistory.update((a) => {
            if (!currentActiveEdit.id && currentShowId && !currentShows[currentShowId]) return a

            const editObj = clone(currentActiveEdit) as { id?: string; type?: string }
            const id = editObj.id || currentShowId
            if (!id) return a

            const type = editObj.type || "show"
            let icon = type === "show" ? "slide" : type
            if (icon === "media") icon = getMediaType(getExtension(id))
            else if (icon === "audio") icon = "music"
            else if (icon === "template") icon = "templates"
            else if (icon === "overlay") icon = "overlays"
            else if (icon === "scene") icon = "scene"
            else if (icon === "effect") icon = "effects"

            const nameFn = (names as Record<string, (id: string) => unknown>)[type]
            if (!nameFn) return a
            const name = nameFn(String(id))
            if (name === undefined) return a

            const edit: NavHistoryEntry = { id, name: String(name ?? ""), icon, edit: editObj }

            if (type === "show") {
                let active = clone(currentActiveShow) as ShowRef | null
                if (!active && currentShowId) active = { type: "show", id: currentShowId, index: currentActiveEdit.slide || 0 }
                if (active) edit.show = active
            }

            a.push(edit as never)

            if (a.length > 15) a = a.slice(-15)
            const seen = new Set<string>()
            a = a
                .reverse()
                .filter((e) => {
                    const key = String((e as NavHistoryEntry).id || "")
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                })
                .reverse()

            return a
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentActiveEdit, currentActiveShow, currentShowId, currentShows, names])

    const [clonedHistory, setClonedHistory] = useState<NavHistoryEntry[]>([])
    useEffect(() => {
        if (currentEditHistory.length !== clonedHistory.length || (!currentActiveEdit.id && !currentActiveShow?.id)) {
            setTimeout(() => setClonedHistory(clone(currentEditHistory).reverse() as NavHistoryEntry[]))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentEditHistory.length, currentActiveEdit.id, currentActiveShow?.id])

    const activeIndex = clonedHistory.findIndex((edited) => (currentActiveEdit.id ? currentActiveEdit.id === edited.id : currentShowId === edited.id))

    function openRecent(edited: NavHistoryEntry) {
        activeEdit.set(edited.edit as never)
        const editObj = edited.edit as { type?: string } | undefined
        if (editObj?.type !== "audio") refreshEditSlide.set(true)
        if (edited.show) {
            if (currentFocusMode) activeEdit.set({ items: [], slide: edited.show.index || 0, type: "show", showId: edited.show.id })
            else activeShow.set(edited.show as ShowRef)
        }
    }

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey) return
            const target = e.target as HTMLElement | null
            if (target?.closest?.(".edit") || document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return

            const showRecent = !(currentFocusMode && currentShowId) && (currentActiveEdit.id || ((!currentShowId || !currentShows[currentShowId]) && currentEditHistory.length) || currentEditMode === "text_edit")
            if (!showRecent || clonedHistory.length === 0) return

            if (e.key === "ArrowDown") {
                e.preventDefault()
                let nextIndex = activeIndex + 1
                if (activeIndex === -1) nextIndex = 0
                if (nextIndex < clonedHistory.length) openRecent(clonedHistory[nextIndex])
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                let prevIndex = activeIndex - 1
                if (activeIndex === -1) prevIndex = 0
                if (prevIndex >= 0) openRecent(clonedHistory[prevIndex])
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFocusMode, currentShowId, currentActiveEdit.id, currentShows, currentEditHistory.length, currentEditMode, clonedHistory, activeIndex])

    const profile = getAccess("shows")
    const isLocked = currentShows[currentShowId]?.locked || profile.global === "read" || profile[currentShows[currentShowId]?.category || ""] === "read"

    const showRecent = !(currentFocusMode && currentShowId) && (currentActiveEdit.id || ((!currentShowId || !currentShows[currentShowId]) && currentEditHistory.length) || currentEditMode === "text_edit")

    if (currentFocusMode) {
        return (
            <>
                <Button onClick={() => activePage.set("show")}>
                    <Icon id="back" right />
                    <T id="actions.back" />
                </Button>
                {currentShowId ? <Slides /> : null}
            </>
        )
    }

    if (currentFocusMode && currentShowId) {
        return <Slides />
    }

    if (showRecent) {
        return (
            <>
                <div className={styles.title}>
                    <h3 style={{ fontStyle: "italic", opacity: 0.7 }}>
                        <T id="edit.recent" />
                    </h3>
                </div>
                {currentEditHistory.length ? (
                    <div className={styles.edited}>
                        {clonedHistory.map((edited) => {
                            const isActive = currentActiveEdit.id ? currentActiveEdit.id === edited.id : currentShowId === edited.id
                            return (
                                <Button key={String(edited.id)} style={{ width: "100%", padding: "0.15rem 0.65rem", fontWeight: "normal", justifyContent: "left" }} onClick={() => openRecent(edited)} isActive={isActive} tab>
                                    <Icon id={String(edited.icon || "")} />
                                    <p style={{ margin: "3px 5px" }}>{String(edited.name || "—")}</p>
                                </Button>
                            )
                        })}
                    </div>
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </>
        )
    }

    if (currentActiveShow && (currentActiveShow.type === undefined || currentActiveShow.type === "show")) {
        return (
            <>
                <Slides />
                <FloatingBar onlyOne>
                    <Button disabled={isLocked} icon="add" title="new.slide" onClick={(detail) => addSlide({ detail } as ClickEvent)}>
                        {!currentLabelsDisabled ? <T id="new.slide" /> : null}
                    </Button>
                </FloatingBar>
            </>
        )
    }

    return (
        <Center faded>
            <T id="empty.show" />
        </Center>
    )
}
