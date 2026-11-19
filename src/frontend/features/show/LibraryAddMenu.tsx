import { useState } from "react"
import { activePopup } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Button } from "../../shared/ui/kit/button/Button"
import { Menu } from "../../shared/ui/kit/menu/Menu"
import { MenuItem } from "../../shared/ui/kit/menu/MenuItem"
import styles from "./LibraryAddMenu.module.css"

export interface LibraryAddMenuProps {
    readOnly?: boolean
}

// Port de components/show/LibraryAddMenu.svelte (F24.20a). El "+" de ÍTEMS cuando la fuente es una biblioteca.
export function LibraryAddMenu({ readOnly = false }: LibraryAddMenuProps) {
    const [open, setOpen] = useState(false)

    function run(action: () => void) {
        setOpen(false)
        action()
    }

    return (
        <div className={styles.anchor}>
            <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="new.show" disabled={readOnly} onClick={() => setOpen(!open)} />
            <Menu open={open} onClose={() => setOpen(false)}>
                <MenuItem onClick={() => run(() => activePopup.set("show"))}>{translateText("new.show")}</MenuItem>
                <MenuItem onClick={() => run(() => activePopup.set("import"))}>{translateText("actions.import")}</MenuItem>
            </Menu>
        </div>
    )
}
