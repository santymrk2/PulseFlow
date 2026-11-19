import { useEffect, useState } from "react"
import { uid } from "uid"
import type { ContentProviderId } from "../../../../types/ContentProvider"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import type { Category } from "../../../../types/Tabs"
import { keysToID, sortObject } from "../../../components/helpers/array"
import { addDrawerFolder } from "../../../components/helpers/dropActions"
import { countFolderMediaItems } from "../../../components/helpers/media"
import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../shared/core/ipc/main"
import { cn } from "../../../shared/core/lib/utils"
import { drawerTabsData, labelsDisabled, media, mediaFolders, providerConnections, special } from "../../../shared/core/stores"
import { getAccess } from "../../../utils/profile"
import { useStore } from "../../hooks/useStore"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { NavigationSections, type NavCategory, type NavSection } from "./NavigationSections"
import styles from "./MediaTabs.module.css"

interface Access {
    global?: string
    [id: string]: string | undefined
}

interface ContentProviderItem {
    providerId: ContentProviderId
    displayName: string
    hasContentLibrary: boolean
}

// Port de components/drawer/navigation/MediaTabs.svelte
export function MediaTabs() {
    const readOnly = (getAccess("media") as Access).global === "read"

    const drawerTabs = useStore(drawerTabsData)
    const labelsOff = useStore(labelsDisabled)
    const mediaValue = useStore(media)
    const folders = useStore(mediaFolders)
    const connections = useStore(providerConnections)
    const settings = useStore(special) as { churchAppsCloudOnly?: boolean }

    const [PICK_ID] = useState(() => uid())
    const [contentProviders, setContentProviders] = useState<ContentProviderItem[]>([])
    const [counts, setCounts] = useState<{ all: number; lengths: Record<string, number> }>({ all: 0, lengths: {} })

    const activeSubTab = drawerTabs.media?.activeSubTab || ""
    const foldersList = keysToID(folders)
    const favoritesListLength = Object.values(mediaValue).filter((a) => !a.audio && a.favourite).length

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
                newFolderLengths[folderPath] = count.folder + count.video + count.image
                all += count.video + count.image
            })

            if (!cancelled) setCounts({ all, lengths: newFolderLengths })
        }
        getCounts()
        return () => {
            cancelled = true
        }
    }, [folders])

    // content providers con librería y conectados
    useEffect(() => {
        let cancelled = false
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (cancelled || !allProviders) return
            setContentProviders(allProviders.filter((p) => p.hasContentLibrary && connections[p.providerId]))
        })
        return () => {
            cancelled = true
        }
    }, [connections])

    useEffect(() => {
        const listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
            if (data.channel !== PICK_ID || !data.path) return
            addDrawerFolder(data, "media")
        })
        return () => destroyMain(listenerId)
    }, [PICK_ID])

    const curriculumProviders = contentProviders.filter((a) => (a.providerId !== "churchApps" || settings.churchAppsCloudOnly !== true) && a.providerId !== "canva")

    function convertToButton(categories: Array<Category & { id: string }>, lengths: Record<string, number>): NavCategory[] {
        return sortObject(categories, "name").map((a) => {
            const type = a.mediaType
            const option = type ? { title: `clock.type: <b>preview.${type}</b>`, icon: `type_${type}`, style: "opacity: 0.6;" } : null
            return { id: a.id, label: a.name, icon: a.icon || "folder", option, count: lengths[a.path || ""], boxedIcon: true }
        })
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
        ...(curriculumProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...curriculumProviders.map((a) => ({ id: a.providerId, label: a.displayName, icon: "web" }))]] : []),
        [{ id: "inputs", label: "emitters.inputs", icon: "input" }, "SEPARATOR", { id: "online", label: "media.online", icon: "web" }],
        [{ id: "TITLE", label: "media.folders" }, ...convertToButton(foldersList, counts.lengths)]
    ]

    function addFolder() {
        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID })
    }

    function updateName({ id, value }: { id: string; value: string }) {
        mediaFolders.update((a) => {
            if (!a[id]) return a
            const next = { ...a }
            const entry = { ...a[id] }
            delete entry.default
            entry.name = value
            next[id] = entry
            return next
        })
    }

    const addFolderButton = (
        <Button title="new.system_folder" variant="outline" disabled={readOnly} onClick={addFolder} size="xs" className={styles.addButton}>
            <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
            {!labelsOff ? <T id="new.system_folder" /> : null}
        </Button>
    )

    return <NavigationSections sections={sections} active={activeSubTab} onRename={updateName} section2={<div className={cn(!curriculumProviders.length && styles.slotNoCurriculum, foldersList.length && !curriculumProviders.length && styles.spaced)}>{!curriculumProviders.length ? addFolderButton : null}</div>} section3={<div className={cn(styles.slot, foldersList.length && styles.spaced)}>{addFolderButton}</div>} />
}
