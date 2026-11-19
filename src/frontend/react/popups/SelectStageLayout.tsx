import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { activePage, activePopup, currentOutputSettings, popupData, stageShows } from "../../shared/core/stores"
import { getAccess } from "../../shared/utils/profile"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { SkeletonStageSlide } from "../stage/SkeletonStageSlide"
import { StageSlide } from "../stage/StageSlide"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import styles from "./SelectStageLayout.module.css"

// Port de components/main/popups/SelectStageLayout.svelte. Lee: popupData (active, trigger), stageShows,
// currentOutputSettings y el permiso "stage" del perfil (getAccess, una sola vez como en el Svelte).
// Escribe: el trigger con el id elegido, popupData = { id: "select_stage_layout", value }, activePopup = null
// (y popupData = {} 200 ms después si sigue cerrado), un history UPDATE + activePage = "stage" al crear.
// StageSlide y SkeletonStageSlide son ports React; al no pasar slots se renderizan como hermanos.
export function SelectStageLayout() {
    const stageShowsValue = useStore(stageShows)
    const currentOutputSettingsValue = useStore(currentOutputSettings)
    const [profile] = useState(() => getAccess("stage") as Record<string, string>)
    const [active, setActive] = useState(() => (get(popupData).active || "") as string)
    const [lazyLoader, setLazyLoader] = useState(0)
    const [loaded, setLoaded] = useState(false)

    const stageLayouts = sortByName(keysToID(stageShowsValue)).filter((a) => profile[a.id] !== "none" && Object.values(stageShowsValue[a.id]?.items ?? {}).some((item) => item.currentOutput?.source !== currentOutputSettingsValue))

    useEffect(() => {
        if (loaded || !stageLayouts.length) return
        if (lazyLoader >= stageLayouts.length) {
            setLoaded(true)
            return
        }
        const timeout = setTimeout(
            () => {
                const batch = lazyLoader === 0 ? 2 : Math.min(16, lazyLoader * 2)
                setLazyLoader(lazyLoader + batch)
            },
            lazyLoader === 0 ? 80 : 40
        )
        return () => clearTimeout(timeout)
    }, [loaded, lazyLoader, stageLayouts.length])

    function select(selectedId: string) {
        setActive(selectedId)

        const data = get(popupData)
        if (data.trigger) data.trigger(selectedId)

        popupData.set({ id: "select_stage_layout", value: selectedId })

        setTimeout(() => {
            setTimeout(() => (get(activePopup) === null ? popupData.set({}) : null), 200) // reset después de cerrar
            activePopup.set(null)
        })
    }

    function createNew() {
        const layoutId = uid()
        history({ id: "UPDATE", oldData: { id: layoutId }, location: { page: "stage", id: "stage" } })
        select(layoutId)
        activePage.set("stage")
    }

    return (
        <>
            <Button className="popup-options" icon="add" iconSize={1.3} title="new.style" onClick={createNew} white />

            <div style={{ position: "relative", height: "100%", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)", overflowY: "auto" }}>
                {stageLayouts.length ? (
                    <div className={styles.grid}>
                        {stageLayouts.map((layout, i) => (
                            <div key={layout.id} className={styles.stageLayout} role="button" tabIndex={0} onClick={() => select(layout.id)} onKeyDown={triggerClickOnEnterSpace}>
                                {loaded || i < lazyLoader ? <StageSlide id={layout.id} layout={layout} active={active === layout.id} selectable={false} /> : <SkeletonStageSlide layout={layout} active={active === layout.id} />}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>
        </>
    )
}
