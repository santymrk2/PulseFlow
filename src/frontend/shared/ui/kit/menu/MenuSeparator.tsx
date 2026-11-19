import styles from "./MenuSeparator.module.css"

// Port de ui/menu/menu-separator.svelte
export function MenuSeparator() {
    return <div role="separator" data-slot="menu-separator" className={styles.root} />
}
