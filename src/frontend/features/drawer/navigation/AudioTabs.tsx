import { useEffect, useState } from "react"
import { uid } from "uid"
import type { Playlist } from "../../../../types/Audio"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import type { Category } from "../../../../types/Tabs"
import { AudioPlaylist } from "../../../shared/audio/audioPlaylist"
import { keysToID, sortObject } from "../../../shared/utils/helpers/array"
import { addDrawerFolder } from "../../../shared/utils/helpers/dropActions"
import { countFolderMediaItems } from "../../../shared/utils/helpers/media"
import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../shared/core/ipc/main"
import { activeRename, audioFolders, audioPlaylists, drawerTabsData, effectsLibrary, labelsDisabled, media } from "../../../shared/core/stores"
import { cn } from "../../../shared/core/lib/utils"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { Button } from "../../../shared/ui/kit/button/Button"
import { NavigationSections, type NavCategory, type NavSection } from "./NavigationSections"
import styles from "./AudioTabs.module.css"

interface Access {
    global?: string
    [id: string]: string | undefined
}

// Port de components/drawer/navigation/AudioTabs.svelte
export function AudioTabs() {
    const readOnly = (getAccess("audio") as Access).global === "read"

    const drawerTabs = useStore(drawerTabsData)
    const folders = useStore(audioFolders)
    const playlistsValue = useStore(audioPlaylists)
    const library = useStore(effectsLibrary)
    const mediaValue = useStore(media)
    const labelsOff = useStore(labelsDisabled)

    const [PICK_ID] = useState(() => uid())
    const [counts, setCounts] = useState<{ all: number; lengths: Record<string, number> }>({ all: 0, lengths: {} })

    const activeSubTab = drawerTabs.audio?.activeSubTab || ""
    const foldersList = keysToID(folders)
    const favoritesListLength = Object.values(mediaValue).filter((a) => a.audio && a.favourite).length
    const effectsLength = library.length
    const playlists = !!Object.keys(playlistsValue).length

    // `$: if (foldersList.length) getCounts()`
    useEffect(() => {
        const folderPaths = keysToID(folders).map((a) => a.path || "")
        if (!folderPaths.length) return

        let cancelled = false
        async function getCounts() {
            const data = keysToID((await requestMain(Main.READ_FOLDER, { path: folderPaths })) || {})
            const newFolderLengths: Record<string, number> = {}
            let all = 0

            folderPaths.forEach((folderPath) => {
                const count = countFolderMediaItems(folderPath, data)
                newFolderLengths[folderPath] = count.folder + count.audio
                all += count.audio
            })

            if (!cancelled) setCounts({ all, lengths: newFolderLengths })
        }
        getCounts()
        return () => {
            cancelled = true
        }
    }, [folders])

    // selector de carpeta del sistema
    useEffect(() => {
        const listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
            if (data.channel !== PICK_ID || !data.path) return
            addDrawerFolder(data, "audio")
        })
        return () => destroyMain(listenerId)
    }, [PICK_ID])

    function getAudioPlaylists(playlistUpdater: Record<string, Playlist>): NavCategory[] {
        if (!Object.keys(playlistUpdater).length) return []

        const sorted = sortObject(keysToID(playlistUpdater), "name")
        return sorted.map((a) => ({
            id: a.id,
            label: a.name,
            icon: "playlist",
            count: a.songs?.length,
            onDoubleClick: () => AudioPlaylist.start(a.id),
            boxedIcon: true
        }))
    }

    function convertToButton(categories: Array<Category & { id: string }>, lengths: Record<string, number>): NavCategory[] {
        return sortObject(categories, "name").map((a) => ({
            id: a.id,
            label: a.name,
            icon: a.icon || "folder",
            count: lengths[a.path || ""],
            boxedIcon: true
        }))
    }

    const sections: NavSection[] = [
        [
            { id: "all", label: "category.all", icon: "all", count: counts.all },
            {
                id: "favourites",
                label: "category.favourites",
                icon: "star",
                count: favoritesListLength,
                hidden: !favoritesListLength && activeSubTab !== "favourites"
            }
        ],
        [{ id: "inputs", label: "emitters.inputs", icon: "input" }, "SEPARATOR", { id: "metronome", label: "audio.metronome", icon: "metronome" }],
        [{ id: "effects_library", label: "category.sound_effects", icon: "effect", count: effectsLength, hidden: !effectsLength && activeSubTab !== "effects_library" }],
        [{ id: "TITLE", label: "audio.playlists" }, ...getAudioPlaylists(playlistsValue)],
        [{ id: "TITLE", label: "media.folders" }, ...convertToButton(foldersList, counts.lengths)]
    ]

    function addFolder() {
        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID })
    }

    function updateName({ id, value }: { id: string; value: string }) {
        if (playlistsValue[id]) {
            audioPlaylists.update((a) => {
                const next = { ...a }
                next[id] = { ...a[id], name: value }
                return next
            })
            return
        }

        audioFolders.update((a) => {
            if (!a[id]) return a
            const next = { ...a }
            const entry = { ...a[id] }
            delete entry.default
            entry.name = value
            next[id] = entry
            return next
        })
    }

    function createPlaylist() {
        const playlistId = uid()
        audioPlaylists.update((a) => {
            const next = { ...a }
            next[playlistId] = { name: "", songs: [] }
            return next
        })

        drawerTabsData.update((a) => {
            const next = { ...a }
            next.audio = { ...a.audio, activeSubTab: playlistId }
            return next
        })

        activeRename.set("category_audio_" + playlistId)
    }

    return (
        <NavigationSections
            sections={sections}
            active={activeSubTab}
            onRename={updateName}
            section3={
                <div className={cn(styles.slot, playlists && styles.spaced)}>
                    <Button title="new.playlist" variant="outline" disabled={readOnly} onClick={createPlaylist} size="xs" className={styles.addButton}>
                        <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
                        {!labelsOff ? <T id="new.playlist" /> : null}
                    </Button>
                </div>
            }
            section4={
                <div className={cn(styles.slot, foldersList.length && styles.spaced)}>
                    <Button title="new.system_folder" variant="outline" disabled={readOnly} onClick={addFolder} size="xs" className={styles.addButton}>
                        <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
                        {!labelsOff ? <T id="new.system_folder" /> : null}
                    </Button>
                </div>
            }
        />
    )
}
