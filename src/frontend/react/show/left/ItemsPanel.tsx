import { useEffect, useRef, useState } from "react"
import { filterShows, showsOfLibrary, UNLABELED_LIBRARY_ID } from "../../../components/show/leftSource"
import { activePopup, activeProfile, categories, leftSource, projects, sortedShowsList } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Button } from "../../../shared/ui/kit/button/Button"
import { Input } from "../../../shared/ui/kit/input/Input"
import { LibraryAddMenu } from "../LibraryAddMenu"
import { ProjectContentList } from "../ProjectContentList"
import styles from "./ItemsPanel.module.css"
import { LeftPanel } from "./LeftPanel"
import { LibraryShowList } from "./LibraryShowList"
import { PlaylistOptionsMenu } from "./PlaylistOptionsMenu"

// Port de components/show/left/ItemsPanel.svelte: con una biblioteca muestra sus shows y un buscador;
// con una playlist, sus ítems en orden. Nunca queda sin fuente (la resuelve LeftColumn).
interface ItemsAccess {
    global?: string
    [id: string]: string | undefined
}

export function ItemsPanel() {
    const source = useStore(leftSource)
    const profileId = useStore(activeProfile)
    const sortedShows = useStore(sortedShowsList)
    const categoriesValue = useStore(categories)
    const projectsValue = useStore(projects)

    const library = source?.type === "library" ? source.id : null
    const playlistId = source?.type === "playlist" ? source.id : null

    const showsProfile = (profileId ? getAccess("shows") : {}) as ItemsAccess
    const projectsProfile = (profileId ? getAccess("projects") : {}) as ItemsAccess
    const readOnly = library ? showsProfile.global === "read" || showsProfile[library] === "read" : projectsProfile.global === "read"

    // la búsqueda se reinicia al cambiar de fuente
    const sourceKey = source ? `${source.type}:${source.id}` : ""
    const [query, setQuery] = useState("")
    const lastSource = useRef(sourceKey)
    useEffect(() => {
        if (lastSource.current !== sourceKey) {
            lastSource.current = sourceKey
            setQuery("")
        }
    }, [sourceKey])

    const libraryShows = library ? showsOfLibrary(sortedShows, library, categoriesValue, showsProfile) : []
    const visibleShows = filterShows(libraryShows, query)

    const rawName = (name: string | undefined) => (name?.includes(".") ? translateText(name) : name || "")
    const contextName = library ? (library === UNLABELED_LIBRARY_ID ? translateText("category.unlabeled") : rawName(categoriesValue[library]?.name)) : playlistId ? projectsValue[playlistId]?.name || translateText("main.unnamed") : ""
    const count = library ? libraryShows.length : playlistId ? (projectsValue[playlistId]?.shows?.length ?? 0) : null

    return (
        <LeftPanel
            title={translateText("ui.items_title")}
            context={contextName}
            count={count}
            actions={
                <>
                    {playlistId ? <PlaylistOptionsMenu projectId={playlistId} /> : null}
                    {library ? <LibraryAddMenu readOnly={readOnly} /> : playlistId ? <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.add_shows" disabled={readOnly} onNativeClick={() => activePopup.set("add_shows")} /> : null}
                </>
            }
        >
            {library ? (
                <div className={styles.library}>
                    <div className={`library-search ${styles.search}`}>
                        <Input value={query} placeholder={translateText("ui.search_shows")} onInput={(e) => setQuery(e.currentTarget.value)} />
                    </div>
                    <div className={styles.list}>
                        <LibraryShowList shows={visibleShows} searching={!!query.trim() && !visibleShows.length} />
                    </div>
                </div>
            ) : playlistId ? (
                <ProjectContentList tree={[]} recentlyUsedList={[]} />
            ) : null}
        </LeftPanel>
    )
}
