import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { EditMode, TabsObj } from "../../../types/Tabs"
import { activeEdit, activePage, activePopup, activeShow, cloudUsers, dictionary, drawer, drawerOpenedInEdit, editMode, focusMode, labelsDisabled, openToolsTab, refreshEditSlide, showsCache, slideNotesActive, special } from "../../stores"
import { isActiveShowInUseByCloudUser } from "../../utils/cloudSync"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { getLayoutRef } from "../../components/helpers/show"
import { getSlideChords } from "../../components/edit/scripts/chords"
import { getSlideText } from "../../components/edit/scripts/textStyle"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { SlideEditor } from "./editors/SlideEditor"
import { TextEditor } from "../show/TextEditor"
import { useStore } from "../hooks/useStore"
import styles from "./Editor.module.css"

import SplashSvelte from "../../components/main/Splash.svelte"
import OverlayEditorSvelte from "../../components/edit/editors/OverlayEditor.svelte"
import TemplateEditorSvelte from "../../components/edit/editors/TemplateEditor.svelte"
import SceneEditorSvelte from "../../components/edit/editors/SceneEditor.svelte"
import EffectEditorSvelte from "../../components/edit/editors/EffectEditor.svelte"
import MediaEditorSvelte from "../../components/edit/editors/MediaEditor.svelte"
import CameraEditorSvelte from "../../components/edit/editors/CameraEditor.svelte"
import AudioEditorSvelte from "../../components/edit/editors/AudioEditor.svelte"
import ItemAddMenuSvelte from "../../components/edit/ItemAddMenu.svelte"

// Port de components/edit/Editor.svelte (F24.21c).
// Incluye lógica de tabs equivalente a components/main/Tabs.svelte sincronizada con editMode.
export function Editor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentActivePage = useStore(activePage)
    const currentActiveShow = useStore(activeShow)
    const currentCloudUsers = useStore(cloudUsers)
    const currentDrawer = useStore(drawer)
    const currentDrawerOpenedInEdit = useStore(drawerOpenedInEdit)
    const currentEditMode = useStore(editMode)
    const currentFocusMode = useStore(focusMode)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOpenToolsTab = useStore(openToolsTab)
    const currentRefreshEditSlide = useStore(refreshEditSlide)
    const currentShowsCache = useStore(showsCache)
    const currentSlideNotesActive = useStore(slideNotesActive)
    const currentSpecial = useStore(special)
    useStore(dictionary) // para translateText reactivo

    const [hideCloudConflict, setHideCloudConflict] = useState(false)
    const [overflowHidden, setOverflowHidden] = useState(true)
    const [manuallyChanged, setManuallyChanged] = useState(false)

    const currentShowId = currentActiveShow?.id || currentActiveEdit.showId || ""
    const currentShow = currentShowsCache[currentShowId]
    const ref = getLayoutRef(currentShowId, currentShow)
    const Slide = currentShow?.slides && currentActiveEdit.slide != null ? currentShow.slides[ref[currentActiveEdit.slide!]?.id] : null

    const profile = getAccess("shows")
    const isLocked = currentShow?.locked || !!(Slide && (Slide as { locked?: boolean }).locked) || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    const chordCount = Slide ? getSlideChords(Slide).length : 0
    const chordsHidden = !!currentShow?.reference?.type
    const chordsDisabled = !Slide || isLocked || (chordCount < 1 && !getSlideText(Slide))

    const editTabs = useMemo(() => {
        const tabs: TabsObj = {
            default: { name: "tools.slide", icon: "slide" },
            ...(!chordsHidden && { chords: { name: "edit.chords", icon: "chords", data: chordCount > 0 ? chordCount : undefined, disabled: chordsDisabled } }),
            text_edit: { name: "show.text", tooltip: "show.text [Ctrl+Shift+T]", icon: "text_edit" }
        } as TabsObj
        return tabs
    }, [chordsHidden, chordCount, chordsDisabled])

    // if chords mode becomes invalid
    useEffect(() => {
        if (currentEditMode === "chords" && (chordsHidden || chordsDisabled)) editMode.set("default")
    }, [currentEditMode, chordsHidden, chordsDisabled])

    // refreshEditSlide pulse
    useEffect(() => {
        if (!currentRefreshEditSlide) return
        const t = setTimeout(() => refreshEditSlide.set(false), 100)
        return () => clearTimeout(t)
    }, [currentRefreshEditSlide])

    // on mount behaviors
    useEffect(() => {
        if (!currentDrawerOpenedInEdit) {
            const minHeight = 40
            if (currentDrawer.height > minHeight) {
                drawer.set({ height: minHeight, stored: currentDrawer.height, autoclosed: true })
            }
        }

        if (currentActiveShow?.id && (currentActiveShow.type || "show") !== "show" && (!currentActiveEdit.id || currentActiveEdit.type === currentActiveShow.type)) {
            activeEdit.set({ id: currentActiveShow.id, type: currentActiveShow.type as "overlay" | "template" | "effect" | "media" | "camera" | "audio", items: [] })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // openToolsTab -> switch tab (equivalente a Tabs.svelte)
    useEffect(() => {
        if (!currentOpenToolsTab) return
        const tabId = currentOpenToolsTab
        openToolsTab.set("")

        if (currentActivePage !== "show" && manuallyChanged) return
        if (!editTabs[tabId]) return

        editMode.set(tabId as EditMode)
        // if opened tab is in overflow, expand overflow
        if (editTabs[tabId]?.overflow) setOverflowHidden(false)
    }, [currentOpenToolsTab, editTabs, currentActivePage, manuallyChanged])

    const labels = currentLabelsDisabled ? false : true
    const tabsEntries = Object.entries(editTabs)

    function selectTab(id: string) {
        setManuallyChanged(true)
        editMode.set(id as EditMode)
        if (editTabs[id]?.overflow) setOverflowHidden(false)
    }

    const conflict = !hideCloudConflict && isActiveShowInUseByCloudUser({ $activeShow: currentActiveShow, $cloudUsers: currentCloudUsers })

    let content: ReactNode = null
    if (currentActiveEdit.type === "overlay") {
        content = (
            <>
                <SvelteIsland component={OverlayEditorSvelte} props={{}} />
                <SvelteIsland component={ItemAddMenuSvelte} props={{}} />
            </>
        )
    } else if (currentActiveEdit.type === "template") {
        content = (
            <>
                <SvelteIsland component={TemplateEditorSvelte} props={{}} />
                <SvelteIsland component={ItemAddMenuSvelte} props={{}} />
            </>
        )
    } else if (currentActiveEdit.type === "scene") {
        content = <SvelteIsland component={SceneEditorSvelte} props={{}} />
    } else if (currentActiveEdit.type === "effect") {
        content = (
            <>
                <SvelteIsland component={EffectEditorSvelte} props={{}} />
                <FloatingBar>
                    <Button className="addButton" title="edit.add_items" onClick={() => activePopup.set("effect_items")}>
                        <Icon id="add" size={1} white />
                    </Button>
                </FloatingBar>
            </>
        )
    } else if (currentActiveEdit.type === "media") {
        content = <SvelteIsland component={MediaEditorSvelte} props={{}} />
    } else if (currentActiveEdit.type === "camera") {
        content = <SvelteIsland key={currentActiveEdit.id} component={CameraEditorSvelte} props={{}} />
    } else if (currentActiveEdit.type === "audio") {
        content = <SvelteIsland component={AudioEditorSvelte} props={{}} />
    } else if (currentActiveEdit.slide !== undefined) {
        content = (
            <>
                {conflict ? (
                    <div className={`darken ${styles.darken}`}>
                        <p style={{ textAlign: "center", fontSize: "1.5em", display: "block", backgroundColor: "black", padding: 10, borderRadius: 4 }}>
                            Currently in use on another computer!
                            <br />
                            <Button variant="outline" icon="check" onClick={() => setHideCloudConflict(true)} />
                        </p>
                    </div>
                ) : null}

                {!currentFocusMode ? (
                    <div className={`tabs ${styles.tabs}`}>
                        {tabsEntries.map(([id, tab]) => {
                            if (tab.remove || tab.overflow) return null
                            const active = currentEditMode === id
                            return (
                                <Button key={id} data-title={translateText(tab.tooltip || tab.name || "")} isActive={active} disabled={tab.disabled} showOutline={active} onClick={() => selectTab(id)}>
                                    <Icon id={tab.icon} />
                                    {labels ? (
                                        <span className={styles.tabLabel}>
                                            <T id={tab.name || ""} />
                                        </span>
                                    ) : null}
                                    {tab.data != null ? <span className={styles.tabData}>{tab.data}</span> : null}
                                </Button>
                            )
                        })}
                        {tabsEntries.some(([, t]) => t.overflow) ? (
                            <Button onClick={() => setOverflowHidden(!overflowHidden)} title={overflowHidden ? "actions.open" : "actions.close"}>
                                <Icon id={overflowHidden ? "expand" : "collapse"} />
                            </Button>
                        ) : null}
                        {!overflowHidden
                            ? tabsEntries.map(([id, tab]) => {
                                  if (!tab.overflow) return null
                                  const active = currentEditMode === id
                                  return (
                                      <Button key={id} data-title={translateText(tab.tooltip || tab.name || "")} isActive={active} disabled={tab.disabled} onClick={() => selectTab(id)}>
                                          <Icon id={tab.icon} />
                                          {labels ? (
                                              <span className={styles.tabLabel}>
                                                  <T id={tab.name || ""} />
                                              </span>
                                          ) : null}
                                      </Button>
                                  )
                              })
                            : null}
                    </div>
                ) : null}

                <div className={`content ${styles.content}`}>
                    {currentEditMode === "text_edit" && !currentFocusMode ? (
                        <TextEditor currentShow={currentShowsCache[currentActiveShow?.id || ""]} />
                    ) : (
                        <>
                            <SlideEditor />
                            {currentEditMode === "default" && !currentSlideNotesActive && !currentSpecial.slideTimelineActive && !currentFocusMode ? <SvelteIsland component={ItemAddMenuSvelte} props={{ isLocked }} /> : null}
                        </>
                    )}
                </div>
            </>
        )
    } else {
        content = <SvelteIsland component={SplashSvelte} props={{}} />
    }

    return <div className={`editor ${styles.editor}`}>{content}</div>
}
