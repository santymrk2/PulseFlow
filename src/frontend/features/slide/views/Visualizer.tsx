import { useEffect, useRef } from "react"
import { OUTPUT } from "../../../../types/Channels"
import type { Item } from "../../../../types/Show"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { currentWindow as currentWindowStore, visualizerData } from "../../../shared/core/stores"
import { send } from "../../../shared/utils/request"
import { drawKaleidoscope } from "../logic/views/visualizerKaleidoscope"
import { drawParticles } from "../logic/views/visualizerParticles"
import { useStore } from "../../../shared/ui/hooks/useStore"
import styles from "./Visualizer.module.css"

export interface VisualizerProps {
    item: Item
    preview?: boolean
    edit?: boolean
}

interface AnalyserLike {
    frequencyBinCount: number
    fftSize: number
    getByteFrequencyData(array: Uint8Array<ArrayBuffer>): void
}

interface Bar {
    height: number
    percentage: number
}

function getAnalysers(): AnalyserLike[] {
    return (AudioAnalyser.getAnalysers() as AnalyserLike[] | undefined) || []
}

// Port (F24.18a).
export function Visualizer({ item, preview = false, edit = false }: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const canvasInstanceRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const renderingRef = useRef(0)
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const analysersRef = useRef<AnalyserLike[] | null>(null)
    if (analysersRef.current === null) analysersRef.current = getAnalysers()
    const lastTimeRef = useRef(0)
    const frameCounterRef = useRef(0)

    const currentWindowValue = useStore(currentWindowStore)
    const visualizerDataFrame = useStore(visualizerData)

    const color = item?.visualizer?.color || null
    const padding = (item?.visualizer?.padding || 0) - 0.5
    const visualizerType = item?.visualizer?.type || "bars"

    const configRef = useRef({ color, padding, visualizerType, edit, preview, currentWindow: currentWindowValue })
    configRef.current = { color, padding, visualizerType, edit, preview, currentWindow: currentWindowValue }
    const frameDataRef = useRef(visualizerDataFrame)
    frameDataRef.current = visualizerDataFrame

    function ensureCanvas() {
        const canvas = canvasRef.current
        if (!canvas) return null
        canvasInstanceRef.current = canvas
        const targetWidth = Math.ceil(canvas.clientWidth) || window.innerWidth
        const targetHeight = Math.ceil(canvas.clientHeight) || window.innerHeight

        if (!ctxRef.current || canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth
            canvas.height = targetHeight
            ctxRef.current = canvas.getContext("2d")
        }
        return ctxRef.current
    }

    function stopLoop() {
        if (renderingRef.current) {
            cancelAnimationFrame(renderingRef.current)
            renderingRef.current = 0
        }
    }

    function drawWithBars(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, bars: Bar[], count: number) {
        const { color: activeColorOption, padding: currentPadding, visualizerType: type, edit: isEdit } = configRef.current
        const WIDTH = canvas.width
        const HEIGHT = canvas.height
        const barWidth = (WIDTH / count - currentPadding) * 1.42

        if (type === "kaleidoscope") {
            drawKaleidoscope({ ctx, bars, width: WIDTH, height: HEIGHT, color: activeColorOption, padding: currentPadding, edit: isEdit })
        } else if (type === "particles") {
            drawParticles({ ctx, bars, width: WIDTH, height: HEIGHT, color: activeColorOption, padding: currentPadding, edit: isEdit })
        } else {
            let x = 0
            const activeColor = activeColorOption === "rgb(0 0 0 / 0)" ? "" : activeColorOption
            for (let i = 0; i < count; i++) {
                const percentage = bars[i]?.percentage || 0
                const r = 255 * percentage
                const barHeight = HEIGHT * percentage
                ctx.fillStyle = activeColor || `rgb(${r}, 5, 150)`
                ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
                x += barWidth + currentPadding
            }
        }
    }

    function drawEditMode() {
        const canvas = canvasRef.current
        const ctx = ensureCanvas()
        if (!ctx || !canvas) return

        const HEIGHT = canvas.height
        const bufferLength = 128
        const mockBars: Bar[] = []
        for (let i = 0; i < bufferLength; i++) {
            const sineFactor = Math.abs(Math.sin((1 - i / bufferLength) * Math.PI * 8))
            const barHeight = HEIGHT * (0.5 * sineFactor + 0.5) * ((bufferLength - i) / bufferLength)
            mockBars.push({ height: barHeight, percentage: sineFactor })
        }

        ctx.clearRect(0, 0, canvas.width, HEIGHT)
        drawWithBars(ctx, canvas, mockBars, bufferLength)
    }

    function renderOutputFrame() {
        const data = frameDataRef.current
        if (!data) return
        const canvas = canvasRef.current
        const ctx = ensureCanvas()
        if (!ctx || !canvas) return

        const bufferLength = data.buffers || 128
        const bars: Bar[] = data.bars || []

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawWithBars(ctx, canvas, bars, bufferLength)
    }

    function startLoop() {
        if (renderingRef.current) return

        function renderFrame(timestamp = 0) {
            const { preview: isPreview, currentWindow: inOutput } = configRef.current
            if (!analysersRef.current?.length && !frameDataRef.current) {
                const canvas = canvasRef.current
                if (ctxRef.current && canvas) ctxRef.current.clearRect(0, 0, canvas.width, canvas.height)
                stopLoop()
                if (isPreview) send(OUTPUT, ["VISUALIZER_DATA"], null)
                return
            }

            renderingRef.current = requestAnimationFrame(renderFrame)

            // Throttle main window analyzer and IPC send to ~30fps
            if (timestamp - lastTimeRef.current < 30) return
            lastTimeRef.current = timestamp

            const ctx = ensureCanvas()
            const canvas = canvasRef.current
            if (!ctx || !canvas) return

            const analysers = analysersRef.current || []
            const WIDTH = canvas.width
            const HEIGHT = canvas.height
            const bufferLength = analysers[0]?.frequencyBinCount || 128
            const maxHeightValue = analysers[0]?.fftSize || 256
            const { color: activeColorOption, padding: currentPadding, visualizerType: type } = configRef.current

            const shouldDraw = frameCounterRef.current % 5 === 0
            frameCounterRef.current++

            if (shouldDraw) ctx.clearRect(0, 0, WIDTH, HEIGHT)

            const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))
            analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i] as Uint8Array<ArrayBuffer>))

            const bars: Bar[] = []
            let x = 0
            const activeColor = activeColorOption === "rgb(0 0 0 / 0)" ? "" : activeColorOption

            for (let i = 0; i < bufferLength; i++) {
                const sum = (dataArrays[0]?.[i] || 0) + (dataArrays[1]?.[i] || 0)
                const percentage = Math.round(sum / (dataArrays.length || 1)) / maxHeightValue
                const barHeight = HEIGHT * percentage

                bars.push({ height: barHeight, percentage })

                if (shouldDraw && type === "bars") {
                    const r = 255 * percentage
                    const barWidth = (WIDTH / bufferLength - currentPadding) * 1.42
                    ctx.fillStyle = activeColor || `rgb(${r}, 5, 150)`
                    ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
                    x += barWidth + currentPadding
                }
            }

            if (shouldDraw && type !== "bars") {
                drawWithBars(ctx, canvas, bars, bufferLength)
            }

            if (isPreview && !inOutput) {
                send(OUTPUT, ["VISUALIZER_DATA"], { bars, buffers: bufferLength })
            }
        }

        renderingRef.current = requestAnimationFrame(renderFrame)
    }

    // En la vista previa sin analizadores, esperar a que el audio se inicialice.
    useEffect(() => {
        if (!(preview && !currentWindowValue) || analysersRef.current?.length) return
        const interval = setInterval(() => {
            analysersRef.current = getAnalysers()
            if (analysersRef.current?.length) {
                clearInterval(interval)
                checkIntervalRef.current = null
                startLoop()
            }
        }, 800)
        checkIntervalRef.current = interval
        return () => {
            clearInterval(interval)
            checkIntervalRef.current = null
        }
    }, [preview, currentWindowValue])

    // Reaccionar a cambios de edición, ventana y datos del visualizador.
    useEffect(() => {
        if (edit) {
            stopLoop()
            drawEditMode()
        } else if (!currentWindowValue && ((analysersRef.current?.length || 0) > 0 || visualizerDataFrame)) {
            startLoop()
        } else if (currentWindowValue && visualizerDataFrame) {
            renderOutputFrame()
        }
    }, [edit, currentWindowValue, visualizerDataFrame, item])

    // Limpieza al desmontar, equivalente a onDestroy del Svelte original.
    useEffect(() => {
        return () => {
            stopLoop()
            const canvas = canvasInstanceRef.current
            if (ctxRef.current && canvas) ctxRef.current.clearRect(0, 0, canvas.width, canvas.height)
            visualizerData.set(null)
            if (preview) send(OUTPUT, ["VISUALIZER_DATA"], null)
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current)
                checkIntervalRef.current = null
            }
        }
    }, [])

    return <canvas ref={canvasRef} className={styles.canvas} />
}
