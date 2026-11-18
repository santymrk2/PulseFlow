import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react"
import { activePopup, os } from "../../../stores"
import { MENU_BAR_HEIGHT } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import styles from "./ModalBase.module.css"

// Port del marco de components/main/Modal.svelte (F12.1). Los modales FULL_MODALS montados desde reactPopups
// no reciben un cascarón, así que traen su propio backdrop, tarjeta, header y cierre (Esc / clic afuera).
export interface ModalBaseProps {
    title: string
    width?: number
    height?: number
    closable?: boolean
    lockOutsideClick?: boolean
    managesPopup?: boolean
    blockEscape?: boolean
    children?: ReactNode
}

export function ModalBase({ title, width = 960, height = 620, closable = true, lockOutsideClick = true, managesPopup = true, blockEscape = false, children }: ModalBaseProps) {
    const osValue = useStore(os)
    const isWindows = osValue.platform === "win32"

    const card = useRef<HTMLDivElement>(null)
    // El handler de window se registra una sola vez: lee siempre la configuración más reciente.
    const close = useRef<() => void>(() => {})
    useEffect(() => {
        close.current = () => {
            if (!closable) return
            if (managesPopup) activePopup.set(null)
        }
    })

    useEffect(() => {
        card.current?.focus()
    }, [])

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || blockEscape) return
            e.preventDefault()
            e.stopPropagation()
            close.current()
        }
        window.addEventListener("keydown", onKeydown, true)
        return () => window.removeEventListener("keydown", onKeydown, true)
    }, [blockEscape])

    function backdropMousedown(e: MouseEvent<HTMLDivElement>) {
        if (lockOutsideClick) return
        if (e.target === e.currentTarget) close.current()
    }

    const cardStyle = { "--modal-width": `${width}px`, "--modal-height": `${height}px` } as CSSProperties

    return (
        <div className={styles.backdrop} style={isWindows ? { height: `calc(100% - ${MENU_BAR_HEIGHT}px)` } : undefined} onMouseDown={backdropMousedown}>
            <div ref={card} className={styles.modal} tabIndex={-1} role="dialog" aria-modal="true" aria-label={translateText(title)} style={cardStyle}>
                <header className={styles.header}>
                    <span className={styles.title}>{translateText(title)}</span>
                    {closable ? (
                        <button type="button" className={styles.close} title={translateText("actions.close [esc]")} onClick={() => close.current()}>
                            <Icon id="close" size={1.1} />
                        </button>
                    ) : null}
                </header>
                <div className={styles.body}>{children}</div>
            </div>
        </div>
    )
}
