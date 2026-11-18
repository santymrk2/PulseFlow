import { type CSSProperties, type SyntheticEvent } from "react"
import { encodeFilePath } from "../../../components/helpers/media"
import { Card } from "../Card"
import { Icon } from "../../helpers/Icon"
import styles from "./Folder.module.css"

// Port de components/drawer/media/Folder.svelte.
export interface FolderProps {
    name: string
    path: string
    mode: "grid" | "list"
    previewPaths?: string[]
    folderFilesCount?: { folder: number; audio: number; video: number; image: number }
    className?: string
    style?: CSSProperties
    onOpen?: (path: string) => void
}

export function Folder({ name, path, mode, previewPaths = [], folderFilesCount = { folder: 0, audio: 0, video: 0, image: 0 }, className, style, onOpen }: FolderProps) {
    const removeBrokenImg = (e: SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.style.display = "none"
    }

    const count = folderFilesCount.folder + folderFilesCount.video + folderFilesCount.image

    return (
        <Card resolution={{ width: 16, height: 9 }} onClick={() => onOpen?.(path)} width={100} title={name} label={name} count={count} icon={mode === "grid" ? "folder" : null} color={mode === "grid" ? "var(--primary-lighter)" : ""} mode={mode} className={className} style={style}>
            <div className={styles.flex} style={{ width: "100%", height: "100%" }}>
                <div className={styles.grid} key={path}>
                    {mode === "grid" && previewPaths.length ? (
                        <div className={styles.images}>
                            {previewPaths.slice(0, 4).map((p, i) => (
                                <img key={i} loading="lazy" src={encodeFilePath(p)} onError={removeBrokenImg} />
                            ))}
                        </div>
                    ) : null}
                    <Icon size={mode === "list" ? 2 : 3} id="folder" white={mode === "list"} />
                </div>
            </div>
        </Card>
    )
}
