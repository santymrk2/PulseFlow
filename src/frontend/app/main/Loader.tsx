import styles from "./Loader.module.css"

export interface LoaderProps {
    size?: number
}

export function Loader({ size = 1 }: LoaderProps) {
    const px = 40 * size
    return <div className={styles.loader} style={{ width: `${px}px`, height: `${px}px` }} />
}
