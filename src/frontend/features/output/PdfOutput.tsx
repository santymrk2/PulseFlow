import { useEffect, useRef, useState } from "react"
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist"
import type { Transition } from "../../../types/Show"
import { encodeFilePath, locateMediaFile } from "../../shared/utils/helpers/media"
import { OutputTransition } from "./OutputTransition"
import styles from "./PdfOutput.module.css"

GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

interface PdfSlide {
    id?: string
    page?: number
}

export interface PdfOutputProps {
    slide: PdfSlide
    currentStyle?: unknown
    transition: Transition
}

// Port de components/output/layers/PdfOutput.svelte (F24.20c).
export function PdfOutput({ slide, transition }: PdfOutputProps) {
    const canvasElem = useRef<HTMLCanvasElement | null>(null)
    const loadingTask = useRef<PDFDocumentLoadingTask | null>(null)
    const loadedDoc = useRef<PDFDocumentProxy | null>(null)
    const loadedPath = useRef("")
    const renderTask = useRef<RenderTask | null>(null)
    const [update, setUpdate] = useState(0)
    const prevSlide = useRef("")

    const slideKey = `${slide?.id}_${slide?.page}`
    useEffect(() => {
        if (prevSlide.current !== slideKey) {
            prevSlide.current = slideKey
            setUpdate((value) => value + 1)
        }
    }, [slideKey])

    useEffect(() => {
        const canvas = canvasElem.current
        const currentPath = slide?.id
        const pageNum = (slide?.page || 0) + 1
        if (!canvas || !currentPath) return
        let cancelled = false

        async function loadPage() {
            renderTask.current?.cancel()
            const located = await locateMediaFile(currentPath!)
            const targetPath = located?.path || currentPath!

            if (loadedPath.current !== targetPath || !loadedDoc.current) {
                loadingTask.current?.destroy()
                loadingTask.current = getDocument(encodeFilePath(targetPath))
                loadedDoc.current = await loadingTask.current.promise
                loadedPath.current = targetPath
            }
            if (cancelled || !loadedDoc.current || canvas !== canvasElem.current) return

            const page = await loadedDoc.current.getPage(pageNum)
            const context = canvas!.getContext("2d")
            if (cancelled || !context || canvas !== canvasElem.current) return

            const viewportAtScale1 = page.getViewport({ scale: 1 })
            const scaleW = (window.innerWidth * window.devicePixelRatio) / viewportAtScale1.width
            const scaleH = (window.innerHeight * window.devicePixelRatio) / viewportAtScale1.height
            const scale = Math.min(scaleW, scaleH)

            const viewport = page.getViewport({ scale })
            canvas!.height = viewport.height
            canvas!.width = viewport.width

            renderTask.current = page.render({ canvas, canvasContext: context, viewport })
            try {
                await renderTask.current.promise
            } catch {
                // render cancelado: otro slide tomó su lugar
            }
        }
        void loadPage()
        return () => {
            cancelled = true
        }
    }, [slideKey, update])

    useEffect(() => {
        return () => {
            renderTask.current?.cancel()
            void loadingTask.current?.destroy()
        }
    }, [])

    return (
        <OutputTransition key={update} transition={transition} inTransition={transition.in} outTransition={transition.out}>
            <canvas ref={canvasElem} className={styles.canvas} />
        </OutputTransition>
    )
}

export default PdfOutput
