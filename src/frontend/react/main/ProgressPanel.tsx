import { useEffect, useState } from "react"
import { mediaDownloads, pdfImports } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import styles from "./ProgressPanel.module.css"

export function ProgressPanel() {
    const downloads = useStore(mediaDownloads)
    const importsMap = useStore(pdfImports)
    const [dismissed, setDismissed] = useState(false)
    const [seenUrls, setSeenUrls] = useState<Set<string>>(new Set())
    const [errorPaths] = useState(() => new Set<string>())

    const rawMediaEntries = Array.from(downloads.entries())
    const mediaEntries = rawMediaEntries.filter(([url, data]) => !(data.status === "error" && errorPaths.has(url)))
    const hasDownloads = mediaEntries.length > 0 && !dismissed

    const rawImports = Array.from(importsMap.entries())
    const imports = rawImports.filter(([filePath, data]) => !(data.status === "error" && errorPaths.has(filePath)))
    const hasPdfImports = imports.length > 0
    const hasProgress = hasDownloads || hasPdfImports

    useEffect(() => {
        const currentUrls = new Set(mediaEntries.map(([url]) => url))
        const hasNewDownload = Array.from(currentUrls).some((url) => !seenUrls.has(url))

        if (hasNewDownload && dismissed) setDismissed(false)
        setSeenUrls(currentUrls)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [downloads, dismissed])

    function getFileName(url: string): string {
        try {
            const urlObj = new URL(url)
            const pathname = urlObj.pathname
            const parts = pathname.split("/")
            const fileName = parts[parts.length - 1] || "media file"
            return decodeURIComponent(fileName).slice(0, 40)
        } catch {
            return "media file"
        }
    }

    function dismiss() {
        setDismissed(true)
    }

    function getPercent(progress: number, total: number) {
        if (!total) return 0
        return Math.max(0, Math.min(100, (progress / total) * 100))
    }

    function getPercentLabel(progress: number, total: number) {
        return `${Math.round(getPercent(progress, total))}%`
    }

    function getStatusLabel(status: string, progress: number, total: number, path?: string) {
        if (status === "error") {
            if (path) errorPaths.add(path)
            return translateText("error.import")
        }
        if (status === "complete") return "100%"
        return getPercentLabel(progress, total)
    }

    if (!hasProgress) return null

    return (
        <div className={styles.container}>
            {hasDownloads ? (
                <>
                    <div className={styles.header}>
                        <Icon id="download" size={0.9} white />
                        <span>
                            <T id="media.downloading" />
                        </span>
                        <Button style={{ padding: "5px" }} icon="close" onClick={() => dismiss()} title="actions.close" white />
                    </div>

                    {mediaEntries.map(([url, data]) => (
                        <div key={url} className={styles.downloadItem}>
                            <div className={styles.pdfTopRow}>
                                <div className={styles.fileName} title={data.name || getFileName(url)}>
                                    {data.name || getFileName(url)}
                                </div>
                                <span className={`${styles.status} ${data.status === "error" ? styles.error : data.status === "complete" ? styles.ok : ""}`}>{getStatusLabel(data.status, data.progress, data.total, url)}</span>
                            </div>

                            {data.status !== "error" ? (
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: `${getPercent(data.progress, data.total)}%` }} />
                                </div>
                            ) : null}
                        </div>
                    ))}
                </>
            ) : null}

            {hasPdfImports ? (
                <>
                    <div className={`${styles.header}${hasDownloads ? ` ${styles.section}` : ""}`}>
                        <Icon id="pdf" size={0.9} white />
                        <span>
                            <T id="popup.importing" /> PDF
                        </span>
                    </div>

                    {imports.map(([filePath, data]) => (
                        <div key={filePath} className={styles.downloadItem}>
                            <div className={styles.pdfTopRow}>
                                <div className={styles.fileName} title={data.name}>
                                    {data.name}
                                </div>
                                <span className={`${styles.status} ${data.status === "error" ? styles.error : data.status === "complete" ? styles.ok : ""}`}>{getStatusLabel(data.status, data.progress, data.total, filePath)}</span>
                            </div>

                            {data.status === "importing" ? (
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: `${getPercent(data.progress, data.total)}%` }} />
                                </div>
                            ) : data.status === "error" ? (
                                <div className={`${styles.progressText} ${styles.errorText}`} title={data.message}>
                                    {data.message || translateText("error.import")}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </>
            ) : null}
        </div>
    )
}
