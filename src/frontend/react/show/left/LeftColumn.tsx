import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { get } from "svelte/store"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { isSourceValid, resolveInitialSource, UNLABELED_LIBRARY_ID } from "../../../components/show/leftSource"
import { DEFAULT_SIZES, dragSplitter, type PanelSizes } from "../../../components/show/left/panelSizes"
import { cn } from "../../../lib/utils"
import { activeProject, categories, drawerTabsData, leftSource, loaded, projects, projectView, resized } from "../../../stores"
import { useStore } from "../../hooks/useStore"
import { ItemsPanel } from "./ItemsPanel"
import { LibrariesPanel } from "./LibrariesPanel"
import { PlaylistsPanel } from "./PlaylistsPanel"
import styles from "./LeftColumn.module.css"

// Port de components/show/left/LeftColumn.svelte: LIBRARIES · PLAYLISTS · ÍTEMS.
// Resuelve la fuente de ÍTEMS (nunca queda sin una si hay algo que mostrar) y reparte el alto
// con dos divisores arrastrables que se recuerdan en `resized`.
export function LeftColumn() {
    const projectsValue = useStore(projects)
    const categoriesValue = useStore(categories)
    const loadedValue = useStore(loaded)
    const source = useStore(leftSource)
    const currentProject = useStore(activeProject)
    const resizedValue = useStore(resized)

    const playlistIds = sortByName(keysToID(projectsValue))
        .filter((a) => !a.deleted)
        .map((a) => a.id)
    const libraryIds = [...Object.keys(categoriesValue), UNLABELED_LIBRARY_ID]
    const idsKey = `${playlistIds.join(",")}|${libraryIds.join(",")}`

    // espera a que carguen los datos: antes de eso "no hay playlists" sería mentira
    const valid = isSourceValid(source, { playlists: playlistIds, libraries: libraryIds })
    useEffect(() => {
        if (!loadedValue || valid) return

        const last = currentProject ? ({ type: "playlist", id: currentProject } as const) : null
        const next = resolveInitialSource({ last, playlists: playlistIds, libraries: libraryIds })

        if (next?.type === "playlist") {
            activeProject.set(next.id)
            projectView.set(false)
        } else if (next) {
            const id = next.id
            drawerTabsData.update((a) => {
                a.shows = { ...(a.shows || { enabled: true }), activeSubTab: id }
                return a
            })
        }
        leftSource.set(next)
    }, [loadedValue, valid, idsKey, currentProject])

    // Ctrl+1: pasar a una biblioteca (si no hay una elegida) y enfocar el buscador de ÍTEMS
    const column = useRef<HTMLDivElement>(null)
    const [focusRequest, setFocusRequest] = useState(0)
    useEffect(() => {
        if (!focusRequest) return
        column.current?.querySelector<HTMLInputElement>(".library-search input")?.focus()
    }, [focusRequest])

    const focusLibrarySearch = () => {
        if (get(leftSource)?.type !== "library") {
            const libraries = [...Object.keys(get(categories)), UNLABELED_LIBRARY_ID]
            const library = resolveInitialSource({ last: null, playlists: [], libraries })
            if (library) leftSource.set(library)
        }
        setFocusRequest((n) => n + 1)
    }
    const onFocusSearch = useRef<() => void>(() => {})
    useEffect(() => {
        onFocusSearch.current = focusLibrarySearch
    })
    useEffect(() => {
        const listener = () => onFocusSearch.current()
        window.addEventListener("focus-library-search", listener)
        return () => window.removeEventListener("focus-library-search", listener)
    }, [])

    // --- divisores ---
    const [dragSizes, setDragSizes] = useState<PanelSizes | null>(null)
    const sizes: PanelSizes = dragSizes ?? {
        libraries: resizedValue.leftLibraries ?? DEFAULT_SIZES.libraries,
        playlists: resizedValue.leftPlaylists ?? DEFAULT_SIZES.playlists
    }

    function startDrag(handle: "libraries" | "playlists", e: ReactPointerEvent<HTMLDivElement>) {
        const el = column.current
        if (!el) return
        e.preventDefault()
        const startY = e.clientY
        const startSizes = sizes
        const height = el.getBoundingClientRect().height || 1
        let current = startSizes

        const move = (ev: PointerEvent) => {
            current = dragSplitter(startSizes, handle, ((ev.clientY - startY) / height) * 100)
            setDragSizes(current)
        }
        const up = () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", up)
            resized.update((a) => ({ ...a, leftLibraries: current.libraries, leftPlaylists: current.playlists }))
            setDragSizes(null)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
    }

    return (
        <div ref={column} className={styles.column}>
            <div className={styles.panel} style={{ flex: `0 0 ${sizes.libraries}%` }}>
                <LibrariesPanel />
            </div>
            <div className={styles.splitter} role="separator" aria-orientation="horizontal" onPointerDown={(e) => startDrag("libraries", e)} />
            <div className={styles.panel} style={{ flex: `0 0 ${sizes.playlists}%` }}>
                <PlaylistsPanel />
            </div>
            <div className={styles.splitter} role="separator" aria-orientation="horizontal" onPointerDown={(e) => startDrag("playlists", e)} />
            <div className={cn(styles.panel, styles.items)}>
                <ItemsPanel />
            </div>
        </div>
    )
}
