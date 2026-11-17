import { useEffect, useRef, useState } from "react"
import LibraryAddMenu from "../../../components/show/LibraryAddMenu.svelte"
import ProjectContentList from "../../../components/show/ProjectContentList.svelte"
import { filterShows, showsOfLibrary, UNLABELED_LIBRARY_ID } from "../../../components/show/leftSource"
import { activePopup, activeProfile, categories, leftSource, projects, sortedShowsList } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { Input } from "../../ui/input/Input"
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
                    {library ? <SvelteIsland component={LibraryAddMenu} props={{ readOnly }} /> : playlistId ? <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.add_shows" disabled={readOnly} onNativeClick={() => activePopup.set("add_shows")} /> : null}
                </>
            }
        >
            {/* ItemsPanel.svelte no tiene bloque <style>: las clases son utilidades de Tailwind. */}
            {library ? (
                <div className="flex h-full flex-col">
                    <div className="library-search shrink-0 border-b border-border p-2">
                        <Input value={query} placeholder={translateText("ui.search_shows")} onInput={(e) => setQuery(e.currentTarget.value)} />
                    </div>
                    <div className="min-h-0 flex-1">
                        <LibraryShowList shows={visibleShows} searching={!!query.trim() && !visibleShows.length} />
                    </div>
                </div>
            ) : playlistId ? (
                <SvelteIsland component={ProjectContentList} props={{ tree: [], recentlyUsedList: [] }} />
            ) : null}
        </LeftPanel>
    )
}
