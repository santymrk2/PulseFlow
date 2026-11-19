import { useEffect, useRef } from "react"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"

export interface WindowProps {
    id: string
    class?: string
    style?: string
    onLoaded?: (detail: boolean) => void
}

interface DesktopMediaConstraints {
    video: {
        mandatory: {
            chromeMediaSource: string
            chromeMediaSourceId: string
            maxWidth: number
            maxHeight: number
            maxFrameRate: number
        }
    }
}

// Port de components/output/Window.svelte (F24.20b). El video sigue siendo el mismo elemento DOM que usaba el Svelte.
export function Window({ id, class: className, style, onLoaded }: WindowProps) {
    const videoElem = useRef<HTMLVideoElement | null>(null)

    function loaded() {
        // WIP not working!!!
        console.log("window loaded")
        if (!videoElem.current) return

        void videoElem.current.play()
        onLoaded?.(true)
    }

    useEffect(() => {
        let destroyed = false
        let currentStream: MediaStream | null = null
        // getUserMedia acepta estas claves de Chromium aunque no estén en el tipo DOM estándar
        const constraints = {
            video: {
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: id,
                    maxWidth: 1920,
                    maxHeight: 1080,
                    maxFrameRate: 60
                }
            }
        } as DesktopMediaConstraints as unknown as MediaStreamConstraints

        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                if (destroyed || !videoElem.current) {
                    stream.getTracks().forEach((track) => track.stop())
                    return
                }

                currentStream = stream
                videoElem.current.srcObject = stream
                videoElem.current.onloadedmetadata = loaded
            })
            .catch((err: unknown) => {
                if (err instanceof Error) console.error(`${err.name}: ${err.message}`)
                else console.error(err)
            })

        return () => {
            destroyed = true
            currentStream?.getTracks().forEach((track) => track.stop())
            if (videoElem.current) videoElem.current.onloadedmetadata = null
        }
        // `loaded` se redefine en cada render; los efectos sólo necesitan el id de la pantalla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    return (
        <video ref={videoElem} className={className} style={style ? cssTextToStyle(style) : undefined}>
            <track kind="captions" />
        </video>
    )
}
