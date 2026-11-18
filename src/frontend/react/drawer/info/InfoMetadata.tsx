import { dateToString } from "../../../components/helpers/time"
import { translateText } from "../../../utils/language"
import { Link } from "../../ui/link/Link"
import styles from "./InfoMetadata.module.css"

// Port de components/drawer/info/InfoMetadata.svelte.
export interface InfoMetadataEntry {
    label: string
    value: string | number | undefined | null
    type?: string
}

export interface InfoMetadataProps {
    title?: string
    info: InfoMetadataEntry[]
}

function removeExtra(link: string) {
    let next = link.replace("https://", "")
    const extra = next.indexOf("?")
    if (extra > -1) next = next.slice(0, extra)
    if (next.endsWith("/")) next = next.slice(0, next.length - 1)
    return next
}

export function InfoMetadata({ title, info }: InfoMetadataProps) {
    return (
        <>
            <div className={styles.metadata}>
                <h2 data-title={title}>{title?.length ? title : <span style={{ opacity: 0.5 }}>{translateText("main.unnamed")}</span>}</h2>
                <div className={styles.table}>
                    {info.map((data, i) => (
                        <p key={`${data.label}-${i}`}>
                            <span className={styles.label}>{translateText(data.label)}</span>
                            <span className={typeof data.value === "string" && data.value.includes(".") ? styles.default : undefined}>{data.value ? data.type === "date" ? dateToString(data.value, true) : data.type === "url" && typeof data.value === "string" ? <Link url={data.value}>{removeExtra(data.value)}</Link> : typeof data.value === "string" ? translateText(data.value) : data.value : "—"}</span>
                        </p>
                    ))}
                </div>
            </div>
        </>
    )
}
