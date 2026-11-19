import { useEffect, useState, type SyntheticEvent } from "react"
import type { MediaStyle } from "../../../types/Main"
import { cropImageToBase64, encodeFilePath } from "../../shared/utils/helpers/media"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import styles from "./Image.module.css"

export interface ImageProps {
    path: string
    mediaStyle?: MediaStyle
    onLoaded?: (loaded: boolean) => void
    onError?: (event: SyntheticEvent<HTMLImageElement, Event>) => void
}

export function Image({ path, mediaStyle = {}, onLoaded, onError }: ImageProps) {
    const [croppedImage, setCroppedImage] = useState("")

    const croppingActive = !!(mediaStyle.cropping?.bottom || mediaStyle.cropping?.left || mediaStyle.cropping?.top || mediaStyle.cropping?.right)

    useEffect(() => {
        let cancelled = false
        async function cropImage() {
            if (!croppingActive) {
                setCroppedImage("")
                return
            }
            const result = await cropImageToBase64(path, mediaStyle.cropping)
            if (!cancelled) setCroppedImage(result)
        }
        void cropImage()
        return () => {
            cancelled = true
        }
    }, [path, croppingActive, mediaStyle.cropping])

    const fit = mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"
    const mediaStyleString = `width: 100%;height: 100%;object-fit: ${fit};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});image-rendering: ${mediaStyle.rendering || "initial"};mix-blend-mode: ${mediaStyle.blend || "normal"};`
    const blurAmount = mediaStyle.fitOptions?.blurAmount ?? 6
    const blurOpacity = mediaStyle.fitOptions?.blurOpacity || 0.3
    const mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${blurAmount}px) opacity(${blurOpacity});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});image-rendering: ${mediaStyle.rendering || "initial"};`

    const src = croppingActive ? croppedImage : encodeFilePath(path)

    return (
        <>
            {mediaStyle.fit === "blur" ? <img className={`media ${styles.img}`} style={cssTextToStyle(mediaStyleBlurString)} src={src} alt="" draggable={false} /> : null}
            <img className={`media ${styles.img}`} style={cssTextToStyle(mediaStyleString)} src={src} alt="" draggable={false} onError={onError} onLoad={() => onLoaded?.(true)} />
        </>
    )
}
