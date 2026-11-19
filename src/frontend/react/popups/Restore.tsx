import { useEffect, useRef, useState } from "react"
import { cn } from "../../shared/core/lib/utils"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import type { Popups } from "../../../types/Main"
import { activePopup, popupData, showsCache } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import styles from "./Restore.module.css"

// Port de components/main/popups/Restore.svelte. Lee: popupData (back) y, al montar, los backups vía requestMain(Main.BACKUPS).
// Escribe: showsCache = {} y sendMain(Main.RESTORE) si no hay backups; sendMain(Main.DELETE_BACKUP) al borrar (5 s, con undo);
// popupData = { prompt, trigger } y activePopup = "confirm" al restaurar uno, o activePopup = popupData.back al volver.
// Icon, T, InputRow y Button ya son React; no quedan islas Svelte.
interface Backup {
    path: string
    name: string
    date: number
    size: number
    isDeleted?: boolean
}

const DAY_MS = 86400000
const DELETE_DELAY = 5000

function getDaysAgo(date: number) {
    const diff = Date.now() - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return translateText("calendar.today")
    return `${days}d`
}

function sizeToString(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function Restore() {
    const data = useStore(popupData)
    // Igual que en Svelte: la lista se muta in place al borrar (isDeleted) y sólo se re-renderiza cuando cambia deletingPath.
    const backupsRef = useRef<Backup[]>([])
    const [backups, setBackups] = useState<Backup[]>([])
    const [deletingPath, setDeletingPath] = useState<string | null>(null)
    const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    function restoreCustom() {
        showsCache.set({})
        sendMain(Main.RESTORE)
    }

    useEffect(() => {
        requestMain(Main.BACKUPS).then((result) => {
            const list = [...((result || []) as Backup[])].sort((a, b) => b.date - a.date)
            backupsRef.current = list
            setBackups(list)
            if (!list.length) restoreCustom()
        })
    }, [])

    useEffect(
        () => () => {
            if (undoTimeout.current) clearTimeout(undoTimeout.current)
        },
        []
    )

    function clear() {
        setDeletingPath(null)
        undoTimeout.current = null
    }

    function deleteBackup(path: string) {
        sendMain(Main.DELETE_BACKUP, { path })
        const backup = backupsRef.current.find((b) => b.path === path)
        if (backup) backup.isDeleted = true
        clear()
    }

    // Mismo comportamiento que el Svelte: clicar el mismo path deshace; clicar otro borra el pendiente y empieza uno nuevo.
    function undoDelete(path: string) {
        if (!undoTimeout.current) return false
        const newPath = !!deletingPath && deletingPath !== path
        if (newPath) deleteBackup(deletingPath as string)
        clearTimeout(undoTimeout.current)
        clear()
        return !newPath
    }

    function requestDeleteBackup(path: string) {
        if (undoDelete(path)) return
        setDeletingPath(path)
        undoTimeout.current = setTimeout(() => deleteBackup(path), DELETE_DELAY)
    }

    function restore(backup: Backup) {
        popupData.set({
            prompt: `<b>${backup.name}</b><br><br>${translateText("settings.restore_confirm")}`,
            trigger: () => sendMain(Main.RESTORE, { path: backup.path })
        })
        activePopup.set("confirm")
    }

    return (
        <>
            {data.back ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => activePopup.set(data.back as unknown as Popups)} /> : null}

            <div className={styles.list}>
                {backups.map((backup) => (
                    <InputRow key={backup.path}>
                        <Button variant="outline" style={{ width: "100%" }} onClick={() => restore(backup)}>
                            <div className={styles.info}>
                                <div className={cn(styles.name, (backup.isDeleted || deletingPath === backup.path) && styles.deleted)}>
                                    {backup.name.endsWith("_auto") ? translateText("settings.auto") : backup.name} <span style={{ opacity: 0.3, fontSize: "0.7em", padding: "0 8px" }}>{sizeToString(backup.size)}</span>
                                </div>
                                <div className={styles.date}>
                                    {getDaysAgo(backup.date)} - {new Date(backup.date).toLocaleString()}
                                </div>
                            </div>
                        </Button>

                        {/* sólo se puede borrar si el backup tiene más de 30 días */}
                        {backup.date < Date.now() - DAY_MS * 30 ? <Button variant="outline" icon={deletingPath === backup.path ? "undo" : "delete"} title="actions.delete" disabled={backup.isDeleted} onClick={() => requestDeleteBackup(backup.path)} /> : null}
                    </InputRow>
                ))}
            </div>

            <Button variant="outline" onClick={restoreCustom}>
                <Icon id="import" size={1.3} />
                <p>
                    <T id="inputs.change_folder" />
                </p>
            </Button>
        </>
    )
}
