import { cn } from "../../../shared/core/lib/utils"
import { keysToID, sortObject } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { isHiddenLegacyLibrary } from "../../../components/show/leftSource"
import { activeProfile, categories, drawerTabsData, leftSource, shows } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { useStore } from "../../hooks/useStore"
import { DropArea } from "../../system/DropArea"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { HiddenInput } from "../../ui/hidden-input/HiddenInput"
import { LeftPanel } from "./LeftPanel"
import styles from "./LibrariesPanel.module.css"

// Port de components/show/left/LibrariesPanel.svelte: sólo la lista de bibliotecas (categorías de shows).
// Usa los mismos ids que la pestaña Shows del cajón para conservar renombrar, menú contextual y arrastre.
const UNLABELED = "unlabeled"

interface ShowsAccess {
    global?: string
    [id: string]: string | undefined
}

export function LibrariesPanel() {
    const profileId = useStore(activeProfile)
    const categoriesValue = useStore(categories)
    const showsValue = useStore(shows)
    const source = useStore(leftSource)

    const profile = (profileId ? getAccess("shows") : {}) as ShowsAccess
    const readOnly = profile.global === "read"

    const visibleShows = Object.values(showsValue).filter((a) => a && !a.private && profile[a.category || ""] !== "none")
    const counts = visibleShows.reduce<Record<string, number>>((result, show) => {
        const key = show.category && categoriesValue[show.category] ? show.category : UNLABELED
        result[key] = (result[key] || 0) + 1
        return result
    }, {})
    // los shows sin biblioteca no pueden quedar inalcanzables: aparece "Sin etiqueta" sólo si hace falta
    const activeLibrary = source?.type === "library" ? source.id : null
    const showUnlabeled = !!counts[UNLABELED] || activeLibrary === UNLABELED

    const all = keysToID(categoriesValue).filter((a) => profile[a.id] !== "none" && !isHiddenLegacyLibrary(a.id, counts, activeLibrary))
    const libraries = [
        ...sortObject(
            all.filter((a) => !a.isArchive),
            "name"
        ),
        ...sortObject(
            all.filter((a) => a.isArchive),
            "name"
        )
    ]

    function select(id: string) {
        leftSource.set({ type: "library", id })
        // "nuevo show" toma la biblioteca de esta sub-pestaña
        drawerTabsData.update((a) => {
            const next = { ...a }
            next.shows = { ...(a.shows || { enabled: true }), activeSubTab: id }
            return next
        })
    }

    function newLibrary() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    }

    function rename(id: string, value: string) {
        categories.update((a) => {
            if (!a[id]) return a
            const next = { ...a }
            const entry = { ...a[id] }
            delete entry.default
            entry.name = value
            next[id] = entry
            return next
        })
    }

    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    return (
        <LeftPanel title={translateText("ui.libraries")} count={libraries.length} actions={<Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.new_library" disabled={readOnly} onNativeClick={newLibrary} />}>
            <DropArea id="navigation" selectChildren>
                {libraries.map((library) => {
                    const isReadOnly = readOnly || profile[library.id] === "read"
                    const active = activeLibrary === library.id
                    return (
                        <SelectElem key={library.id} id="category_shows" data={library.id} selectable trigger="column" borders="center" style={{ width: "100%" }}>
                            <button type="button" className={cn(styles.libraryRow, "library-row context", `#category_shows_button${isReadOnly ? "_readonly" : ""}`, active && "active", active && styles.active)} aria-current={active ? "true" : undefined} onClick={() => select(library.id)}>
                                <span className={styles.name}>
                                    <HiddenInput value={label(library.name)} id={`category_shows_${library.id}`} onEdit={({ value }) => rename(library.id, value)} allowEdit={!isReadOnly} />
                                </span>
                                <span className={styles.count}>{counts[library.id] || 0}</span>
                            </button>
                        </SelectElem>
                    )
                })}
                {showUnlabeled ? (
                    <button type="button" className={cn(styles.libraryRow, "library-row", activeLibrary === UNLABELED && "active", activeLibrary === UNLABELED && styles.active)} onClick={() => select(UNLABELED)}>
                        <span className={styles.name}>{translateText("category.unlabeled")}</span>
                        <span className={styles.count}>{counts[UNLABELED] || 0}</span>
                    </button>
                ) : null}
            </DropArea>
        </LeftPanel>
    )
}
