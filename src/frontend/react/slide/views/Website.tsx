import { useEffect, useRef, useState } from "react"
import { attachPersistentWebview, type PersistentWebviewOptions } from "../../../components/slide/views/websiteDomPool"
import { Icon } from "../../../shared/ui/helpers/Icon"
import styles from "./Website.module.css"

interface WebviewAction {
    update: (options: PersistentWebviewOptions) => void
    destroy: () => void
}

export interface WebsiteProps {
    src: string
    zoom?: number
    disablePreview?: boolean
    outputId?: string
}

// (F24.18a). La acción `use:attachPersistentWebview` se reproduce
// con un ref: se crea al montar, se le llama a `update` al cambiar las opciones y se destruye al desmontar.
export function Website({ src, zoom, disablePreview = false, outputId = "" }: WebsiteProps) {
    const [parsedSrc, setParsedSrc] = useState("")
    const host = useRef<HTMLDivElement>(null)
    const action = useRef<WebviewAction | null>(null)

    useEffect(() => {
        let valid = false
        const normalized = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
        const withProtocol = normalized.includes("://") ? normalized : `http://${normalized}`

        try {
            new URL(withProtocol)
            valid = true
        } catch (err) {
            console.error(err)
        }

        setParsedSrc(valid ? withProtocol : "")
    }, [src])

    useEffect(() => {
        if (!host.current || !parsedSrc) return
        const options = { src: parsedSrc, zoom, outputId }
        if (action.current) action.current.update(options)
        else action.current = (attachPersistentWebview(host.current, options) as WebviewAction | undefined) ?? null
    }, [parsedSrc, zoom, outputId])

    useEffect(() => {
        return () => {
            action.current?.destroy()
            action.current = null
        }
    }, [])

    if (disablePreview) {
        return (
            <div className={styles.iconPreview}>
                <Icon id="web" size={3} white />
            </div>
        )
    }

    if (!parsedSrc) return null

    return (
        <div className={styles.website}>
            <div ref={host} className={styles["webview-container"]} />
        </div>
    )
}
