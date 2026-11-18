import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { activeStage, labelsDisabled, outputs, stageShows } from "../../stores"
import { getAccess } from "../../utils/profile"
import { keysToID, sortByName } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Autoscroll } from "../system/Autoscroll"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { SkeletonStageSlide } from "./SkeletonStageSlide"
import { StageSlide } from "./StageSlide"
import styles from "./StageLayouts.module.css"

// (F24.19a).
export function StageLayouts() {
    const currentActiveStage = useStore(activeStage)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOutputs = useStore(outputs)
    const currentStageShows = useStore(stageShows)

    const [lazyLoader, setLazyLoader] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const [offset, setOffset] = useState(-1)

    const scrollRef = useRef<HTMLDivElement | null>(null)
    const profile = getAccess("stage") as Record<string, string>
    const readOnly = profile.global === "read"
    const sortedStageSlides = sortByName(keysToID(currentStageShows)).filter((show) => profile[show.id] !== "none")

    // lazy loader
    useEffect(() => {
        if (loaded || !sortedStageSlides.length) return
        if (lazyLoader >= sortedStageSlides.length) {
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
    }, [loaded, lazyLoader, sortedStageSlides.length])

    useEffect(() => {
        if (currentActiveStage.id !== null || !Object.keys(currentStageShows).length) return
        const activeStageOutput = Object.values(currentOutputs).find((output) => output.enabled && output.stageOutput)?.stageOutput
        const firstStageLayout = activeStageOutput || sortedStageSlides[0]?.id
        activeStage.set({ id: firstStageLayout, items: [] })
    }, [currentActiveStage.id, currentStageShows, currentOutputs, sortedStageSlides])

    useEffect(() => {
        function keydown(event: KeyboardEvent) {
            if ((event.target instanceof Element && event.target.closest(".edit")) || event.ctrlKey || event.metaKey) return
            if (currentActiveStage.items.length) return

            const currentTabIndex = sortedStageSlides.findIndex((show) => show.id === currentActiveStage.id)
            let nextTab = -1
            if (event.key === "ArrowDown") nextTab = Math.min(sortedStageSlides.length - 1, currentTabIndex + 1)
            else if (event.key === "ArrowUp") nextTab = Math.max(0, currentTabIndex - 1)
            if (nextTab < 0 || !sortedStageSlides[nextTab]) return
            activeStage.set({ id: sortedStageSlides[nextTab].id, items: [] })
        }
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [currentActiveStage, sortedStageSlides])

    // Auto scroll
    useEffect(() => {
        if (!currentActiveStage.id) return
        const timeout = setTimeout(() => {
            const grid = scrollRef.current?.querySelector(".grid")
            const index = Math.max(
                0,
                [...(grid?.children || [])].findIndex((child) => child?.classList.contains("active"))
            )
            setOffset(((grid?.children?.[index] as HTMLElement)?.offsetTop || 5) - 80)
        }, 10)
        return () => clearTimeout(timeout)
    }, [currentActiveStage.id, lazyLoader, loaded])

    function addSlide() {
        history({ id: "UPDATE", location: { page: "stage", id: "stage" } })
    }

    function select(id: string, event: ReactMouseEvent<HTMLDivElement>) {
        if (event.ctrlKey || event.metaKey || document.activeElement?.closest?.(".edit")) return
        activeStage.update((as) => {
            as.id = id
            return as
        })
    }

    return (
        <div className={`main ${styles.main}`}>
            {sortedStageSlides.length ? (
                <Autoscroll scrollElem={scrollRef} offset={offset} timeout={150} smoothTimeout={0}>
                    <div className={`grid ${styles.grid}`}>
                        {sortedStageSlides.map((show, index) => (loaded || index < lazyLoader ? <StageSlide key={show.id} id={show.id} layout={show} active={currentActiveStage.id === show.id} onClick={(event) => select(show.id, event)} /> : <SkeletonStageSlide key={show.id} layout={show} active={currentActiveStage.id === show.id} onClick={(event) => select(show.id, event)} />))}
                        <div className="padding" style={{ height: "60px", width: "1px" }} />
                    </div>
                </Autoscroll>
            ) : (
                <Center faded>
                    <T id="empty.layouts" />
                </Center>
            )}

            <FloatingBar onlyOne>
                <Button disabled={readOnly} icon="add" title="show.new_layout" onClick={addSlide}>
                    {currentLabelsDisabled ? null : <T id="show.new_layout" />}
                </Button>
            </FloatingBar>
        </div>
    )
}
