import styles from "./Captions.module.css"

export interface CaptionsProps {
    item?: unknown
}

// (F24.18a). La ventana webview de salida ya no existe:
// los captions no tienen dónde renderizarse y el componente sigue siendo una previsualización del item.
export function Captions(_props: CaptionsProps) {
    return <div className={`${styles.preview} ${styles.fill}`} />
}
