import { useEffect, useRef, useState } from "react"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { activeProject, outLocked, outputs, presentationData, projects, special } from "../../../shared/core/stores"
import { getFileName, removeExtension } from "../../../components/helpers/media"
import { getAllActiveOutputIds } from "../../../components/helpers/output"
import { triggerClickOnEnterSpace } from "../../helpers/triggerClickOnEnterSpace"
import { Window as WindowView } from "../../output/Window"
import { T } from "../../helpers/T"
import { Center } from "../../system/Center"
import { useStore } from "../../hooks/useStore"
import styles from "./ScreenCapture.module.css"

export interface ScreenCaptureProps {
    path?: string
}

interface WindowInfo {
    id: string
    name: string
}

// (F24.20a).
export function ScreenCapture({ path = "" }: ScreenCaptureProps) {
    const currentPresentationData = useStore(presentationData)
    const currentProjects = useStore(projects)
    const currentActiveProject = useStore(activeProject)
    const currentSpecial = useStore(special)
    const locked = useStore(outLocked)
    const [chooseWindow, setChooseWindow] = useState<WindowInfo[]>([])
    const [chosenWindow, setChosenWindow] = useState<WindowInfo | null>(null)
    const findWindowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const currentPath = useRef(path)
    currentPath.current = path

    function receiveWindows(windows: WindowInfo[] | undefined) {
        setChosenWindow(null)
        const list = windows || []
        const projectShows = currentProjects[currentActiveProject || ""]?.shows || []
        const savedScreen = projectShows.find((show) => show.id === path)?.data?.screenName as string | undefined
        if (savedScreen) {
            const found = list.find((window) => window.name === savedScreen)
            if (found) {
                selectWindow(found)
                return
            }
        }

        const fileName = getFileName(path)
        const appName = (currentSpecial.presentationApp || "PowerPoint").split(" ")[0]
        let candidates = list.filter((window) => window.name.includes(appName) && window.name.includes(fileName) && !window.name.includes(`${fileName} - ${appName}`))
        if (!candidates.length) candidates = list.filter((window) => window.name.includes(removeExtension(fileName)) && window.name.includes(appName))
        if (!candidates.length) candidates = list.filter((window) => window.name.toLowerCase().includes(appName.toLowerCase()) || window.name.toLowerCase().includes(removeExtension(fileName).toLowerCase()))

        if (candidates.length === 1) {
            selectWindow(candidates[0])
        } else if (candidates.length > 1) {
            setChooseWindow(candidates)
        } else {
            setChooseWindow(candidates)
            if (findWindowTimeout.current) clearTimeout(findWindowTimeout.current)
            findWindowTimeout.current = setTimeout(() => requestMain(Main.GET_WINDOWS, undefined, receiveWindows), 800)
        }
    }

    function requestWindows() {
        if (findWindowTimeout.current) clearTimeout(findWindowTimeout.current)
        // Da tiempo a que se abra la ventana de presentación cuando el modo ya estaba activo.
        findWindowTimeout.current = setTimeout(() => requestMain(Main.GET_WINDOWS, undefined, receiveWindows), currentPresentationData?.id === path ? 1800 : 0)
    }

    useEffect(() => {
        if (path) requestWindows()
        return () => {
            if (findWindowTimeout.current) clearTimeout(findWindowTimeout.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path])

    function selectWindow(screenData: WindowInfo, save = false) {
        if (findWindowTimeout.current) clearTimeout(findWindowTimeout.current)
        setChosenWindow(screenData)

        if (save) {
            projects.update((all) => {
                const projectId = currentActiveProject || ""
                const project = all[projectId]
                const index = project?.shows?.findIndex((show) => show.id === currentPath.current) ?? -1
                if (index < 0 || !project?.shows) return all
                project.shows[index].data = { screenName: screenData.name }
                return all
            })
        }

        if (locked) return
        const outputIds = getAllActiveOutputIds()
        outputs.update((all) => {
            outputIds.forEach((id) => {
                const output = all[id]
                if (output?.out?.slide?.type !== "ppt") return
                output.out.slide.screen = screenData
            })
            return all
        })
    }

    function windowView(window: WindowInfo) {
        return <WindowView id={window.id} class="media" style="width: 100%;height: 100%;pointer-events: none;position: absolute;" />
    }

    if (chosenWindow) return <div style={{ width: "100%", height: "100%" }}>{windowView(chosenWindow)}</div>

    if (chooseWindow.length) {
        return (
            <div className={styles.choose}>
                <p style={{ padding: "0 10px" }}>
                    <T id="presentation_control.choose_window" />:
                </p>
                <div className={styles.list}>
                    {chooseWindow.map((screen) => (
                        <div key={screen.id} className={styles.screen} role="button" tabIndex={0} onClick={() => selectWindow(screen, true)} onKeyDown={triggerClickOnEnterSpace}>
                            {windowView(screen)}
                            <p data-title={screen.name}>{screen.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <Center faded>
            <T id="remote.loading" />
        </Center>
    )
}
