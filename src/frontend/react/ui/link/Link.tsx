import type { ReactNode } from "react"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import styles from "./Link.module.css"

// Port de ui/link/link.svelte: abre la URL en el navegador del sistema. Conserva href="#void" del original.
export interface LinkProps {
    url: string
    children?: ReactNode
}

export function Link({ url, children }: LinkProps) {
    return (
        <a
            href="#void"
            className={styles.link}
            onClick={() => {
                sendMain(Main.URL, url)
            }}
        >
            {children}
        </a>
    )
}
