import { useEffect, useRef, type ReactNode } from "react"
import { activePopup, os, special } from "../../stores"
import { MENU_BAR_HEIGHT } from "../../utils/common"
import { translateText } from "../../utils/language"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import styles from "./Modal.module.css"

export interface ModalProps {
    title?: string
    width?: number
    height?: number
    closable?: boolean
    lockOutsideClick?: boolean
    managesPopup?: boolean
    blockEscape?: boolean
    footer?: ReactNode
    children?: ReactNode
    onClose?: () => void
}

export function Modal({ title = "", width = 960, height = 620, closable = true, lockOutsideClick = true, managesPopup = true, blockEscape = false, footer, children, onClose }: ModalProps) {
    const osValue = useStore(os)
    const specialValue = useStore(special)
    const cardRef = useRef<HTMLDivElement>(null)

    const isWindows = osValue.platform === "win32"
    const isOptimized = !!specialValue.optimizedMode

    function close() {
        if (!closable) return
        onClose?.()
        if (managesPopup) activePopup.set(null)
    }

    useEffect(() => {
        function onKeydown(e: KeyboardEvent) {
            if (e.key !== "Escape" || blockEscape) return
            e.preventDefault()
            e.stopPropagation()
            close()
        }

        window.addEventListener("keydown", onKeydown, true)
        cardRef.current?.focus()
        return () => window.removeEventListener("keydown", onKeydown, true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blockEscape, closable, managesPopup, onClose])

    function backdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        if (lockOutsideClick) return
        if (e.target === e.currentTarget) close()
    }

    return (
        <div className={`${styles.modalBackdrop}${isOptimized ? " isOptimized" : ""}`} style={isWindows ? { height: `calc(100% - ${MENU_BAR_HEIGHT}px)` } : undefined} onMouseDown={backdropMouseDown}>
            <div
                ref={cardRef}
                className={styles.modal}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={translateText(title)}
                style={{ ["--modal-width" as string]: `${width}px`, ["--modal-height" as string]: `${height}px` }}
            >
                <header className={styles.modalHeader}>
                    <span className={styles.modalTitle}>{translateText(title)}</span>
                    {closable ? (
                        <button className={styles.modalClose} title={translateText("actions.close [esc]")} onClick={close}>
                            <Icon id="close" size={1.1} />
                        </button>
                    ) : null}
                </header>

                <div className={styles.modalBody}>{children}</div>

                {footer ? <footer className={styles.modalFooter}>{footer}</footer> : null}
            </div>
        </div>
    )
}
