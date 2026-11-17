import { useEffect, useRef } from "react"
import { Main } from "../../../types/IPC/Main"
import { activePopup, saved } from "../../stores"
import { sendMain } from "../../IPC/main"
import { closeApp, save, saveComplete } from "../../utils/save"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import styles from "./Unsaved.module.css"

// Port de components/main/popups/Unsaved.svelte. Lee: saved. Escribe: activePopup al cancelar y, al salir, closeApp/save/saveComplete.
// Cerrar sin salir (N/Esc/clic afuera/X) avisa Main.CLOSE_CANCELLED al backend en la limpieza del efecto, como el onDestroy del Svelte.
export function Unsaved() {
    const savedValue = useStore(saved)
    const quitting = useRef(false)

    useEffect(() => {
        return () => {
            if (!quitting.current) sendMain(Main.CLOSE_CANCELLED)
        }
    }, [])

    function cancel() {
        activePopup.set(null)
    }
    function quit() {
        quitting.current = true
        closeApp()
    }
    function saveAndQuit() {
        quitting.current = true
        if (savedValue) saveComplete({ closeWhenFinished: true })
        else save(true)
    }

    const actions: Record<string, () => void> = { n: cancel, q: quit, y: saveAndQuit }
    const live = useRef(actions)
    useEffect(() => {
        live.current = actions
    })

    function keydown(e: KeyboardEvent) {
        const action = live.current[e.key]
        if (action) {
            e.preventDefault()
            action()
        }
    }

    useEffect(() => {
        const handler = (e: KeyboardEvent) => keydown(e)
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    return (
        <div className={styles.list}>
            <Button variant="outline" style={{ width: "100%" }} onClick={cancel}>
                <T id="popup.cancel" />
                <span>N</span>
            </Button>
            {savedValue ? (
                <Button variant="default" style={{ marginTop: "8px", width: "100%" }} onClick={saveAndQuit}>
                    <T id="main.quit" />
                    <span>Y</span>
                </Button>
            ) : (
                <>
                    <Button variant="outline" style={{ width: "100%" }} onClick={quit}>
                        <div style={{ opacity: 0.7 }}>
                            <T id="popup.quit" />
                        </div>
                        <span>Q</span>
                    </Button>
                    <Button variant="default" style={{ marginTop: "8px", width: "100%" }} onClick={saveAndQuit}>
                        <T id="popup.save_quit" />
                        <span>Y</span>
                    </Button>
                </>
            )}
        </div>
    )
}
