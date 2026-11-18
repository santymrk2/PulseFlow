import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react"
import { cn } from "../../../lib/utils"
import { encodeFilePath, isLocalFile } from "../../../components/helpers/media"
import styles from "./Image.module.css"

// Port de components/drawer/media/Image.svelte.
export interface ImageProps {
    src: string
    updater?: number
    alt: string
    transition?: boolean | number
    className?: string
    style?: CSSProperties
}

export function Image({ src, updater = 0, alt, transition = false, className, style }: ImageProps) {
    const [loaded, setLoaded] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const imageRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        if (imageRef.current?.complete) setLoaded(true)
    }, [])

    useEffect(() => {
        setRetryCount(0)
    }, [src])

    function reload(e: SyntheticEvent<HTMLImageElement>) {
        e.currentTarget.style.display = "none"
        if (retryCount > 5 || isLocalFile(src)) {
            setLoaded(true)
            return
        }
        setLoaded(false)
        const time = 500 * (retryCount + 1)
        setTimeout(() => {
            setRetryCount((c) => c + 1)
        }, time)
    }

    function hasLoaded(e: SyntheticEvent<HTMLImageElement>) {
        e.currentTarget.style.display = ""
        setLoaded(true)
    }

    if (!src) return null

    const transitionStyle = transition ? `opacity ${typeof transition === "number" ? transition : 500}ms ease-out` : undefined
    const mergedStyle: CSSProperties = {
        ...style,
        ...(transitionStyle ? { transition: transitionStyle } : {})
    }

    return <img key={retryCount} ref={imageRef} style={mergedStyle} src={`${encodeFilePath(src)}${updater ? "?" + updater : ""}`} alt={alt} draggable={false} className={cn(styles.image, className, loaded && styles.loaded)} onLoad={hasLoaded} onError={reload} />
}
