import { useState } from "react"
import { keysToID, sortObject } from "../../../shared/utils/helpers/array"
import { addShowsToProject } from "../logic/project"
import { filterShows, isHiddenLegacyLibrary, showsOfLibrary, toggleId, UNLABELED_LIBRARY_ID } from "../logic/leftSource"
import { cn } from "../../../shared/core/lib/utils"
import { activePopup, activeProfile, categories, leftSource, projects, sortedShowsList } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { T } from "../../../shared/ui/helpers/T"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Button } from "../../../shared/ui/kit/button/Button"
import { Input } from "../../../shared/ui/kit/input/Input"
import { ModalBase } from "./ModalBase"
import styles from "./AddShowsModal.module.css"

// Port de components/show/left/AddShowsModal.svelte: bibliotecas a la izquierda, shows con casillas a la derecha.
// Lo marcado se conserva al cambiar de biblioteca y se agrega al final de la playlist en un solo paso.
// FULL_MODAL: se monta sin cascarón, así que el marco sale de ModalBase.
interface ShowsAccess {
    global?: string
    [id: string]: string | undefined
}

interface LibraryOption {
    id: string
    name?: string
    isArchive?: boolean
}

export function AddShowsModal() {
    const source = useStore(leftSource)
    const profileId = useStore(activeProfile)
    const sortedShows = useStore(sortedShowsList)
    const categoriesValue = useStore(categories)
    const projectsValue = useStore(projects)

    const playlistId = source?.type === "playlist" ? source.id : null
    const profile = (profileId ? getAccess("shows") : {}) as ShowsAccess

    const counts = sortedShows.reduce<Record<string, number>>((result, show) => {
        if (show?.category) result[show.category] = (result[show.category] || 0) + 1
        return result
    }, {})
    const all = keysToID(categoriesValue).filter((a) => profile[a.id] !== "none" && !isHiddenLegacyLibrary(a.id, counts, null))
    const libraries: LibraryOption[] = [
        ...sortObject(
            all.filter((a) => !a.isArchive),
            "name"
        ),
        ...sortObject(
            all.filter((a) => a.isArchive),
            "name"
        ),
        { id: UNLABELED_LIBRARY_ID, name: "category.unlabeled" }
    ]

    const [chosenLibrary, setChosenLibrary] = useState("")
    // Equivale a `$: if (!browsing || !libraries.some(...)) browsing = libraries[0]?.id || ""`
    const browsing = chosenLibrary && libraries.some((a) => a.id === chosenLibrary) ? chosenLibrary : libraries[0]?.id || ""
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState<string[]>([])

    const shown = filterShows(showsOfLibrary(sortedShows, browsing, categoriesValue, profile), query)
    const names = Object.fromEntries(sortedShows.map((a) => [a.id, a.name]))

    function confirm() {
        if (playlistId) addShowsToProject(playlistId, selected)
        activePopup.set(null)
    }

    const label = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")

    return (
        <ModalBase title="ui.add_shows" width={720} height={480} lockOutsideClick={false}>
            <div className={styles.container}>
                <nav className={styles.libraries} aria-label={translateText("ui.libraries")}>
                    {libraries.map((library) => (
                        <button
                            key={library.id}
                            type="button"
                            className={cn(styles.library, browsing === library.id && styles.active)}
                            onClick={() => {
                                setChosenLibrary(library.id)
                                setQuery("")
                            }}
                        >
                            {label(library.name)}
                        </button>
                    ))}
                </nav>

                <div className={styles.shows}>
                    <div className={styles.search}>
                        <Input value={query} placeholder={translateText("ui.search_shows")} onInput={(e) => setQuery(e.currentTarget.value)} />
                    </div>
                    <div className={styles.list}>
                        {shown.length ? (
                            shown.map((show) => (
                                <label key={show.id} className={styles.show}>
                                    <input type="checkbox" className={styles.checkbox} checked={selected.includes(show.id)} onChange={() => setSelected((current) => toggleId(current, show.id))} />
                                    <span className={styles.name}>{show.name}</span>
                                </label>
                            ))
                        ) : (
                            <p className={styles.empty}>{translateText(query.trim() ? "ui.no_results" : "empty.shows")}</p>
                        )}
                    </div>
                    <footer className={styles.footer}>
                        <span className={styles.chosen}>
                            {selected
                                .map((id) => names[id])
                                .filter(Boolean)
                                .slice(0, 3)
                                .join(", ")}
                            {selected.length > 3 ? "…" : ""}
                        </span>
                        <Button variant="outline" onNativeClick={() => activePopup.set(null)}>
                            <T id="popup.cancel" />
                        </Button>
                        <Button disabled={!selected.length || !playlistId || !projectsValue[playlistId]} onNativeClick={confirm}>
                            <T id="ui.add_count" replace={[String(selected.length)]} />
                        </Button>
                    </footer>
                </div>
            </div>
        </ModalBase>
    )
}
