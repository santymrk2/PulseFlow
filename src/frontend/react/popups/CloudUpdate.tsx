import { Loader } from "../main/Loader"
import { activePopup, popupData } from "../../shared/core/stores"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Center } from "../system/Center"
import styles from "./CloudUpdate.module.css"

// Port de components/main/popups/CloudUpdate.svelte. Lee: popupData (lista de cambios, que escribe utils/receivers.ts). Escribe: activePopup = null.
// change.action: "upload" | "download" | "upload_failed" | "download_failed"; change.type: "show" | "config" | "bible"; change.count: shows cambiados.
// Loader es el port React. Las filas no tenían key en el Svelte: se usa la posición.
interface CloudChange {
    name: string
    action: string
    type?: string
    count?: number
}

export function CloudUpdate() {
    const changes: CloudChange[] | undefined = useStore(popupData)

    if (changes && changes.length) {
        return (
            <>
                <div className={styles.changes} style={{ marginBottom: "20px" }}>
                    {changes.map((change, i) => (
                        <p key={i}>
                            <Icon id={change.action} size={1.3} white={change.action.includes("failed")} />
                            <span>{change.name}</span>
                            {change.count ? <span className={styles.count}>{change.count}</span> : null}
                        </p>
                    ))}
                </div>

                <Button variant="outline" icon="check" onClick={() => activePopup.set(null)} />
            </>
        )
    }

    return (
        <div className={styles.loading}>
            <Center>
                <Loader />
            </Center>
        </div>
    )
}
