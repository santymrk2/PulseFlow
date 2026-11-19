import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist"
import { activePopup, activeProject, focusMode, labelsDisabled, outLocked, outputs, popupData, projects, slidesOptions, styles } from "../../../shared/core/stores"
import { triggerClickOnEnterSpace } from "../../../shared/utils/clickable"
import { newToast, wait } from "../../../shared/utils/common"
import { translateText } from "../../../shared/utils/language"
import { encodeFilePath, getFileName, locateMediaFile, removeExtension } from "../../../shared/utils/helpers/media"
import { getActiveOutputs, setOutput, startFolderTimer } from "../../../shared/utils/helpers/output"
import { pdfToImageShow } from "../../import/pdfToImages"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Button } from "../../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../../shared/ui/kit/floating-bar/FloatingBar"
import { ZoomControl } from "../../../shared/ui/kit/zoom-control/ZoomControl"
import { Loader } from "../../../app/main/Loader"
import { clearBackground } from "../../output/logic/clear"
import stylesModule from "./PdfPreview.module.css"

GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

export interface PdfPreviewProps {
    show: { id?: string; name?: string }
    index: number
}

interface RenderTask {
    cancel: () => void
    promise: Promise<unknown>
}

const workerErrors = ["RenderingCancelledException", "Transport destroyed", "Worker was destroyed", "Worker was terminated", "sendWithPromise"]

function isWorkerError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    return error.name === "RenderingCancelledException" || workerErrors.some((message) => error.message.includes(message))
}

function getId(text: string) {
    return typeof text === "string" ? text.replace(/[^a-zA-Z0-9]+/g, "") : ""
}

// (F24.20a).
export function PdfPreview({ show, index }: PdfPreviewProps) {
    const currentActiveProject = useStore(activeProject)
    const currentFocusMode = useStore(focusMode)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOutLocked = useStore(outLocked)
    const currentOutputs = useStore(outputs)
    const currentProjects = useStore(projects)
    const currentSlidesOptions = useStore(slidesOptions)
    const currentStyles = useStore(styles)

    const [resolvedId, setResolvedId] = useState(show.id || "")
    const [pageCount, setPageCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [active, setActive] = useState(-1)
    const canvases = useRef<(HTMLCanvasElement | undefined)[]>([])
    const loadingTask = useRef<PDFDocumentLoadingTask | null>(null)
    const renderTasks = useRef<RenderTask[]>([])
    const currentPath = useRef("")
    const isScrolling = useRef<ReturnType<typeof setTimeout> | null>(null)

    const data = currentProjects[currentActiveProject || ""]?.shows?.[index]?.data
    const path = encodeFilePath(resolvedId)
    const activeOutput = getActiveOutputs(currentOutputs, false, true, true)[0]
    const currentOutput = currentOutputs[activeOutput]
    const transparentOutput = !!currentOutput?.transparent
    const currentStyle = currentStyles[currentOutput?.style || ""] || {}
    const output = { color: currentOutput?.color }
    const timer = data?.timer || 0
    const totalTime = pageCount * timer

    useEffect(() => {
        if (show.id) setResolvedId(show.id)
    }, [show.id])

    useEffect(() => {
        const outSlide = currentOutputs[activeOutput]?.out?.slide
        setActive(outSlide?.type === "pdf" && outSlide?.id === path ? outSlide?.page || 0 : -1)
    }, [activeOutput, currentOutputs, path])

    useEffect(() => {
        if (active === -1) return
        if (isScrolling.current) clearTimeout(isScrolling.current)
        isScrolling.current = setTimeout(() => {
            const slide = document.getElementById("id_" + getId(path) + "_" + active)
            if (!slide) return
            const scrollElem = slide.closest(".grid")
            const slideTop = slide.offsetTop
            const slideHeight = slide.clientHeight
            scrollElem?.scrollTo({ top: slideTop - slideHeight * 0.8, behavior: "smooth" })
            isScrolling.current = null
        }, 50)
        return () => {
            if (isScrolling.current) clearTimeout(isScrolling.current)
        }
    }, [active, path])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        renderTasks.current.forEach((task) => task?.cancel())
        renderTasks.current = []

        async function loadPages() {
            if (loadingTask.current) {
                try {
                    loadingTask.current.destroy()
                } catch {
                    // el worker ya murió
                }
                loadingTask.current = null
                await wait(50)
            }

            if (!show.id || cancelled) {
                setLoading(false)
                return
            }

            const located = await locateMediaFile(show.id)
            if (!located?.path || cancelled) {
                setLoading(false)
                return
            }

            setResolvedId(located.path)
            const loadPath = encodeFilePath(located.path)
            currentPath.current = loadPath

            try {
                const task = getDocument(loadPath)
                loadingTask.current = task
                const pdfDoc = await task.promise
                if (currentPath.current !== loadPath || cancelled) return

                setPageCount(pdfDoc.numPages)
                await wait(10)

                for (let i = 0; i < pdfDoc.numPages; i++) {
                    if (currentPath.current !== loadPath || cancelled) return

                    try {
                        const page = await pdfDoc.getPage(i + 1)
                        if (currentPath.current !== loadPath || cancelled) return

                        const viewportAtScale1 = page.getViewport({ scale: 1 })
                        const maxDim = Math.max(viewportAtScale1.width, viewportAtScale1.height)
                        const scale = Math.max(1.0, Math.min(2.5, 1080 / maxDim))
                        const viewport = page.getViewport({ scale })
                        const canvas = canvases.current[i]
                        const context = canvas?.getContext("2d")
                        if (!canvas || !context) break

                        canvas.height = viewport.height
                        canvas.width = viewport.width

                        const renderTask = page.render({ canvas, canvasContext: context, viewport }) as RenderTask
                        renderTasks.current[i] = renderTask

                        try {
                            await renderTask.promise
                        } catch (error) {
                            if (isWorkerError(error)) continue
                            throw error
                        }

                        setLoading(false)
                    } catch (error) {
                        if (isWorkerError(error)) return
                        throw error
                    }
                }
            } catch (error) {
                if (!isWorkerError(error)) console.error("PDF loading error:", error)
                setLoading(false)
            }
        }

        void loadPages()
        return () => {
            cancelled = true
            renderTasks.current.forEach((task) => task?.cancel())
            try {
                loadingTask.current?.destroy()
            } catch {
                // el worker ya murió
            }
        }
    }, [show.id])

    function outputPdf(event: MouseEvent<HTMLDivElement>, page: number) {
        if (currentOutLocked || event.ctrlKey || event.metaKey || event.shiftKey) return
        const name = show.name || removeExtension(getFileName(path))
        setOutput("slide", { type: "pdf", id: path, page, pages: pageCount, name })
        clearBackground()
        if (timer) startFolderTimer(path, { type: "pdf", path: "" })
    }

    async function convertToImages() {
        if (!pageCount || !canvases.current.filter(Boolean).length) return
        newToast("actions.converting")
        await pdfToImageShow(resolvedId || show.id || "")
    }

    return (
        <>
            <div className={stylesModule.grid}>
                {Array.from({ length: pageCount }, (_page, i) => {
                    const mainStyle: CSSProperties = {
                        ...(output.color ? { outline: `2px solid ${output.color}` } : {}),
                        width: `${100 / (pageCount > 1 ? currentSlidesOptions.columns : 1)}%`
                    }
                    return (
                        <div key={i} id={"id_" + getId(path) + "_" + i} className={`${stylesModule.main} ${active === i ? stylesModule.active : ""}`} style={mainStyle}>
                            <div className={stylesModule.icons}>
                                {timer ? (
                                    <div>
                                        <div className={stylesModule.button}>
                                            <div style={{ padding: 3 }} data-title={translateText("preview.nextTimer")}>
                                                <Icon id="clock" size={0.9} white />
                                            </div>
                                        </div>
                                        <span>
                                            <p>{timer}</p>
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            <div className={stylesModule.slide} style={transparentOutput ? undefined : { backgroundColor: currentStyle.background }} tabIndex={0} role="button" onClick={(event) => outputPdf(event, i)} onKeyDown={(event) => triggerClickOnEnterSpace(event.nativeEvent)}>
                                <canvas
                                    ref={(element) => {
                                        canvases.current[i] = element || undefined
                                    }}
                                    className={stylesModule.canvas}
                                />
                            </div>
                        </div>
                    )
                })}

                {loading ? (
                    <div className={stylesModule.load}>
                        <Loader />
                    </div>
                ) : null}
            </div>

            {!currentFocusMode ? (
                <FloatingBar>
                    <Button icon="image" style={{ whiteSpace: "nowrap" }} onClick={() => void convertToImages()}>
                        {currentLabelsDisabled ? null : <T id="actions.convert_to_images" />}
                    </Button>

                    <div className="divider"></div>

                    <Button
                        disabled={pageCount < 2}
                        title={"popup.next_timer" + (totalTime !== 0 ? `: ${totalTime}s` : "")}
                        onClick={() => {
                            popupData.set({ type: "pdf", value: timer, totalTime, count: pageCount })
                            activePopup.set("next_timer")
                        }}
                    >
                        <Icon size={1.1} id="clock" white={totalTime === 0} />
                    </Button>

                    <div className="divider"></div>

                    <ZoomControl columns={currentSlidesOptions.columns} onChange={(value) => slidesOptions.set({ ...currentSlidesOptions, columns: value })} />
                </FloatingBar>
            ) : null}
        </>
    )
}
