import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import { uid } from "uid"
import type { ContentProviderId } from "../../../../types/ContentProvider"
import { Main } from "../../../../types/IPC/Main"
import type { FileFolder, MediaOptions } from "../../../../types/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { activeDrawerTab, activeEdit, activeFocus, activeMediaTagFilter, activePopup, activeShow, audioFolders, cloudSyncData, drawerTabsData, focusMode, labelsDisabled, media, mediaFolders, mediaOptions, openedMediaFolders, outLocked, outputs, popupData, providerConnections, selectAllMedia, selected, sorted, special } from "../../../shared/core/stores"
import { clone, keysToID, sortFilenames } from "../../../shared/utils/helpers/array"
import { splitPath } from "../../../shared/utils/helpers/get"
import { countFolderMediaItems, getExtension, getFileName, getMediaType, isMediaExtension, removeExtension } from "../../../shared/utils/helpers/media"
import { getFirstActiveOutput, setOutput } from "../../../shared/utils/helpers/output"
import { clearBackground } from "../../../components/output/clear"
import { translateText } from "../../../shared/utils/language"
import { PlayerVideos } from "../player/PlayerVideos"
import { BMDStreams } from "../live/BMDStreams"
import { Cameras } from "../live/Cameras"
import { NDIStreams } from "../live/NDIStreams"
import { OMTStreams } from "../live/OMTStreams"
import { Screens } from "../live/Screens"
import { Windows } from "../live/Windows"
import type { InputSelectDetail } from "../live/types"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Button, type ButtonClickDetail } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Input } from "../../ui/input/Input"
import { ZoomControl } from "../../ui/zoom-control/ZoomControl"
import { Center } from "../../system/Center"
import { VirtualList } from "../VirtualList"
import { CLogo } from "./CLogo"
import { Canva } from "./Canva"
import { ContentLibraryBrowser } from "./ContentLibraryBrowser"
import { Folder } from "./Folder"
import { MediaCard } from "./MediaCard"
import { MediaGrid } from "./MediaGrid"
import { loadFromPixabay } from "../../../components/drawer/media/pixabay"
import { loadFromUnsplash } from "../../../components/drawer/media/unsplash"
import styles from "./Media.module.css"

// Port de components/drawer/media/Media.svelte. Las listas de live/* son ports React.
export interface MediaProps {
    active: string | null
    streams: MediaStream[]
}

interface MediaItem {
    isFolder: boolean
    path: string
    name: string
    extension?: string
    thumbnailPath?: string
    previewUrl?: string
    credits?: unknown
    files?: string[]
    noMedia?: boolean
    stats: { birthtimeMs?: number; mtimeMs?: number }
}

interface ContentProvider {
    providerId: ContentProviderId
    displayName: string
    hasContentLibrary: boolean
}

const SPECIAL_TABS = ["online", "inputs"] as const

export function Media({ active, streams }: MediaProps) {
    const mediaValue = useStore(media)
    const mediaFoldersValue = useStore(mediaFolders)
    const mediaOptionsValue = useStore(mediaOptions)
    const openedFoldersValue = useStore(openedMediaFolders)
    const audioFoldersValue = useStore(audioFolders)
    const cloudSyncValue = useStore(cloudSyncData)
    const specialValue = useStore(special)
    const drawerTabsValue = useStore(drawerTabsData)
    const outputsValue = useStore(outputs)
    const providerConnectionsValue = useStore(providerConnections)
    const activeShowValue = useStore(activeShow)
    const activeEditValue = useStore(activeEdit)
    const activeMediaTagFilterValue = useStore(activeMediaTagFilter)
    const selectAllMediaValue = useStore(selectAllMedia)
    const sortedValue = useStore(sorted)
    const outLockedValue = useStore(outLocked)
    const focusModeValue = useStore(focusMode)
    const labelsDisabledValue = useStore(labelsDisabled)

    const setView = (view: NonNullable<MediaOptions["view"]>) => mediaOptions.update((a) => ({ ...a, view }))

    const [contentProviders, setContentProviders] = useState<ContentProvider[]>([])
    const [inputsTab, setInputsTab] = useState(drawerTabsValue.media?.openedSubSubTab?.cameras || "cameras")
    const [onlineTab, setOnlineTab] = useState(drawerTabsValue.media?.openedSubSubTab?.online || "youtube")
    const [onlineQuery, setOnlineQuery] = useState("")
    const [path, setPath] = useState("")
    const [foldersList, setFoldersList] = useState<MediaItem[]>([])
    const [filesList, setFilesList] = useState<MediaItem[]>([])
    const [allRelevantFiles, setAllRelevantFiles] = useState<MediaItem[]>([])
    const [searchedFiles, setSearchedFiles] = useState<MediaItem[]>([])
    const [hasAudio, setHasAudio] = useState({ count: 0, exists: false })
    const [activeFile, setActiveFile] = useState<number | null>(null)

    const scrollElem = useRef<HTMLDivElement>(null)
    const requesting = useRef(0)
    const prevActive = useRef<null | string>(null)
    const prevActiveFolder = useRef<string>("")
    const prevActiveSubTab = useRef<string | null>(active)
    const prevTab = useRef("")
    const lastPaths = useRef<string[]>([])

    const isProviderSection = contentProviders.some((p) => p.providerId === active)
    const notFolders = ["all", ...SPECIAL_TABS, ...contentProviders.map((p) => p.providerId)]
    const isLocalFolder = !!(active && mediaFoldersValue[active])
    const rootPath = isLocalFolder ? (active ? mediaFoldersValue[active]?.path || "" : "") : ""
    const activeProviderId = (isProviderSection && active ? active : null) as ContentProviderId | null
    const currentOutput = getFirstActiveOutput(outputsValue)
    const activeView = mediaOptionsValue.view || "all"
    const mediaFilesOnly = searchedFiles.filter((a) => !a.isFolder)
    const fileCount = mediaFilesOnly.length
    const folderName = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : rootPath === path ? (active !== null ? mediaFoldersValue[active]?.name || "" : "") : splitPath(path).name
    const pathString = path.replace(rootPath, "").replace(folderName, "").replaceAll("\\", "/").split("/").filter(Boolean).join("/")

    function getProviders() {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((data) => {
            const allProviders = data as ContentProvider[] | undefined
            if (!allProviders) return
            setContentProviders(allProviders.filter((p) => p.hasContentLibrary && !!providerConnectionsValue[p.providerId]))
        })
    }

    // $: if ($providerConnections) getProviders()
    useEffect(getProviders, [providerConnectionsValue])

    // $: if (active !== prevActiveSubTab) …
    useEffect(() => {
        if (active !== prevActiveSubTab.current) {
            if (active !== "online") setView("all")
            if (prevActiveSubTab.current) {
                openedMediaFolders.update((a) => {
                    const next = { ...a }
                    delete next[prevActiveSubTab.current!]
                    return next
                })
            }
            prevActiveSubTab.current = active
        }
    }, [active])

    // $: if (active !== prevActiveFolder || rootPath) …
    useEffect(() => {
        prevActiveFolder.current = active || ""
        if (!isLocalFolder) setPath("")
        else {
            const saved = active ? openedFoldersValue[active] : ""
            setPath(saved && rootPath && saved.startsWith(rootPath) ? saved : rootPath)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, rootPath])

    // $: if (isLocalFolder && active) …
    useEffect(() => {
        if (!isLocalFolder || !active) return
        openedMediaFolders.update((a) => {
            const next = { ...a }
            if (path && rootPath && path !== rootPath && path.startsWith(rootPath)) next[active] = path
            else if (a[active]) delete next[active]
            return next
        })
    }, [isLocalFolder, active, path, rootPath])

    // $: if (notFolders.includes(active || "") && activeView === "folder") setView("image")
    useEffect(() => {
        if (notFolders.includes(active || "") && activeView === "folder") setView("image")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, activeView, contentProviders])

    function openFolder(folderPath: string) {
        if (folderPath === "all" || folderPath === "favourites") {
            setFoldersList([])
            setFilesList(allRelevantFiles.filter((a) => !a.isFolder))
            return
        }
        const folder = allRelevantFiles.find((a) => a.isFolder && a.path === folderPath)
        if (!folder) return
        setFoldersList(allRelevantFiles.filter((a) => a.isFolder && !!folder.files?.includes(a.path)))
        setFilesList(allRelevantFiles.filter((a) => !a.isFolder && !!folder.files?.includes(a.path)))
    }

    function hightlightActive() {
        const activeShowPath = activeShowValue?.type === "image" || activeShowValue?.type === "video" ? activeShowValue?.id : ""
        const index = mediaFilesOnly.findIndex((a) => a.path === activeShowPath)
        setActiveFile(index < 0 ? null : index)
    }

    function filterFiles() {
        if (active === "online" || active === "inputs" || isProviderSection) return

        let localFilteredFiles = clone(filesList)

        if (activeMediaTagFilterValue.length) {
            localFilteredFiles = localFilteredFiles.filter((a) => !!mediaValue[a.path]?.tags?.length && !activeMediaTagFilterValue.find((tagId) => !mediaValue[a.path].tags!.includes(tagId)))
        }

        if (activeView === "folder") localFilteredFiles = clone(foldersList)
        else if (activeView !== "all") localFilteredFiles = localFilteredFiles.filter((a) => activeView === getMediaType(getExtension(a.name)))

        hightlightActive()

        const sortType = sortedValue.media?.type || "name"
        if (sortType === "name") localFilteredFiles = sortFilenames(localFilteredFiles)
        else if (sortType === "name_des") localFilteredFiles = localFilteredFiles.reverse()
        else if (sortType === "created") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : (b.stats.birthtimeMs || 0) - (a.stats.birthtimeMs || 0)))
        else if (sortType === "modified") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : (b.stats.mtimeMs || 0) - (a.stats.mtimeMs || 0)))

        if (activeView === "all") localFilteredFiles = [...sortFilenames(foldersList), ...localFilteredFiles]

        setSearchedFiles(clone(localFilteredFiles))
        scrollElem.current?.scrollTo(0, 0)
    }

    // $: if (activeView || $activeMediaTagFilter || $sorted) filterFiles()
    useEffect(filterFiles, [activeView, activeMediaTagFilterValue, sortedValue, filesList, foldersList, active])

    async function loadFilesAsync() {
        if ((onlineTab !== "pixabay" && onlineTab !== "unsplash") || activeView === "folder") return
        let onlineFiles: MediaItem[] = []
        if (onlineTab === "pixabay") onlineFiles = (await loadFromPixabay(onlineQuery || "landscape", activeView === "video")) as MediaItem[]
        else if (onlineTab === "unsplash") onlineFiles = (await loadFromUnsplash(onlineQuery || "landscape")) as MediaItem[]
        setSearchedFiles(clone(onlineFiles))
    }

    // confirmar búsqueda online con Enter o al cambiar de vista
    useEffect(() => {
        if (active === "online" && (onlineTab === "pixabay" || onlineTab === "unsplash")) void loadFilesAsync()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, onlineTab, activeView])

    async function requestFiles(requestPath: string | string[], depth = 0, captureFolderContent = false) {
        if (!requestPath) return
        if (specialValue.optimizedMode || mediaOptionsValue.mode !== "grid") captureFolderContent = false
        requesting.current++
        const currentRequest = requesting.current
        const response = await requestMain(Main.READ_FOLDER, { path: requestPath, depth, captureFolderContent })
        const data = response as Record<string, MediaItem> | undefined
        if (!data || requesting.current !== currentRequest) return

        if (!Array.isArray(requestPath)) {
            const count = countFolderMediaItems(requestPath, Object.values(data) as FileFolder[])
            const audioFolderExists = !!Object.values(audioFoldersValue).find((a) => a.path === requestPath)
            if (count.audio && (audioFolderExists || count.audio * 2 > count.video + count.image)) setHasAudio({ count: count.audio, exists: audioFolderExists })
            else setHasAudio({ count: 0, exists: false })
        }

        let relevant = Object.values(data).filter((a) => {
            if (a.isFolder) return !a.noMedia && !!a.files?.length
            return isMediaExtension(getExtension(a.name))
        })

        if (cloudSyncValue.enabled && specialValue.cloudSyncMediaFolder) {
            const mediaFolderPath = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) as string | undefined
            if (requestPath === mediaFolderPath) {
                relevant = relevant.map((a) => {
                    if (a.name.includes("_")) a.name = a.name.slice(0, a.name.lastIndexOf("_"))
                    return a
                })
            }
        }

        setAllRelevantFiles(relevant)
        openFolder(active === "all" ? "all" : (requestPath as string))
    }

    function updateContent() {
        if (prevActive.current === "online" && active !== "online") setView("all")
        if (active !== "online") prevTab.current = ""

        if (active === "online") {
            if (onlineTab !== prevTab.current) setView("image")
            prevTab.current = onlineTab
            prevActive.current = active
        } else if (active === "favourites") {
            prevActive.current = active
            const favourites = keysToID(mediaValue)
                .filter((a) => a.favourite === true && a.audio !== true)
                .map((a) => ({ isFolder: false, path: a.id, name: getFileName(a.id), stats: {} as MediaItem["stats"] }))
            setAllRelevantFiles(favourites)
            openFolder("favourites")
        } else if (active === "all") {
            if (active === prevActive.current) return
            prevActive.current = active
            void requestFiles(Object.values(mediaFoldersValue).map((a) => a.path!))
        } else if (path?.length) {
            if (path === prevActive.current) return
            prevActive.current = path
            void requestFiles(path, 0, true)
        } else {
            prevActive.current = active
        }
    }

    // $: if (active || path) updateContent()
    useEffect(updateContent, [active, path])

    function setSubSubTab(id: string) {
        if (!active) return
        drawerTabsData.update((a) => {
            const next = { ...a }
            next.media = { ...a.media, enabled: true, activeSubTab: active, openedSubSubTab: { ...a.media?.openedSubSubTab, [active]: id } }
            return next
        })
        if (active === "inputs") setInputsTab(id)
        else if (active === "online") setOnlineTab(id)
    }

    function clickInput(event: ReactMouseEvent, item: { id: string; name: string; group?: string; cameraGroup?: string }, type: string) {
        if (outLockedValue || event.ctrlKey || event.metaKey) return
        if (currentOutput?.out?.background?.id === item.id) clearBackground()
        else setOutput("background", { name: item.name, id: item.id, cameraGroup: item.group || item.cameraGroup, type })
    }

    function selectMedia() {
        if (activeFile === null) return
        const mediaPath = mediaFilesOnly[activeFile]?.path || ""
        if (!mediaPath) return
        activeEdit.set({ id: mediaPath, type: "media", items: [] })
        const name = removeExtension(getFileName(mediaPath))
        const type = getMediaType(getExtension(mediaPath))
        if (focusModeValue) activeFocus.set({ id: mediaPath, type })
        else activeShow.set({ id: mediaPath, name, type })
    }

    // $: if (activeFile !== null) selectMedia()
    useEffect(() => {
        if (activeFile !== null) selectMedia()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile])

    // $: showUpdate($activeShow)
    useEffect(() => {
        if (activeShowValue?.type !== "video" && activeShowValue?.type !== "image") setActiveFile(null)
    }, [activeShowValue])

    function goForward() {
        if (!lastPaths.current.length) return
        const next = lastPaths.current.pop() || rootPath
        setPath(next)
        lastPaths.current = lastPaths.current.filter((a) => a.includes(next))
    }

    function goBack(withCtrl = false) {
        if (withCtrl) {
            lastPaths.current.push(path)
            setPath(rootPath)
            return
        }
        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)
        lastPaths.current.push(path)
        setPath(folder.length > rootPath.length ? folder || rootPath : rootPath)
    }

    function keydown(event: KeyboardEvent) {
        if (!fileCount) return
        const target = event.target as HTMLElement | null
        if (target?.closest?.("input") || target?.closest?.(".edit") || activeEditValue.items.length) return
        if (!(event.ctrlKey || event.metaKey)) return
        if (event.key === "ArrowRight") {
            if (activeFile === null || activeFile < fileCount - 1) setActiveFile(activeFile === null ? 0 : activeFile + 1)
        } else if (event.key === "ArrowLeft") {
            if (activeFile === null || activeFile > 0) setActiveFile(activeFile === null ? fileCount - 1 : activeFile - 1)
        } else if (event.key === "Backspace") {
            if (rootPath !== path) goBack()
        } else if (event.key === "[") goBack()
        else if (event.key === "]") goForward()
    }

    function mousepress(event: MouseEvent) {
        if (event.button === 3) goBack()
        else if (event.button === 4) goForward()
    }

    // <svelte:window on:keydown on:mouseup>
    useEffect(() => {
        window.addEventListener("keydown", keydown)
        window.addEventListener("mouseup", mousepress)
        return () => {
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("mouseup", mousepress)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileCount, activeFile, rootPath, path, activeEditValue, mediaFilesOnly])

    // $: if ($selectAllMedia) selectAll()
    useEffect(() => {
        if (!selectAllMediaValue) return
        const data = searchedFiles.filter((a) => !a.isFolder).map((file) => ({ name: file.name, path: file.path, type: getMediaType(getExtension(file.name)), contentProvider: false }))
        selected.set({ id: "media", data })
        selectAllMedia.set(false)
    }, [selectAllMediaValue, searchedFiles])

    function openAudioFolder() {
        const tabId = keysToID(audioFoldersValue).find((a) => a.path === path)?.id
        if (!tabId) return
        drawerTabsData.update((a) => {
            const next = { ...a }
            next.audio = { ...a.audio, enabled: true, activeSubTab: tabId }
            return next
        })
        activeDrawerTab.set("audio")
    }

    function createAudioFolder() {
        audioFolders.update((a) => {
            const next = { ...a }
            next[uid()] = { name: getFileName(path), icon: "folder", path }
            return next
        })
        openAudioFolder()
    }

    function changeColumns(columns: number) {
        mediaOptions.set({ ...mediaOptionsValue, columns })
    }

    const tabsStyle = { flex: 1 } as CSSProperties
    const navZoom = <ZoomControl hidden columns={mediaOptionsValue.columns} defaultValue={5} onChange={changeColumns} />

    function renderTabs() {
        if (active === "inputs") {
            const tabs = [
                { id: "cameras", label: "live.cameras", icon: "camera" },
                { id: "screens", label: "live.screens", icon: "screen" },
                { id: "ndi", label: "", icon: "ndi" },
                { id: "omt", label: "", icon: "omt" },
                { id: "blackmagic", label: "", icon: "blackmagic" }
            ]
            return (
                <div className={styles.tabs}>
                    {tabs.map((tab) => (
                        <Button key={tab.id} style={tabsStyle} isActive={inputsTab === tab.id} onClick={() => setSubSubTab(tab.id)}>
                            <Icon size={tab.id === "ndi" ? 1.1 : 1.2} id={tab.icon} white />
                            <p>{tab.label ? <T id={tab.label} /> : tab.id.toUpperCase() === "NDI" ? "NDI" : tab.id === "omt" ? "OMT" : "Blackmagic"}</p>
                        </Button>
                    ))}
                </div>
            )
        }
        if (active === "online") {
            const tabs = [
                { id: "youtube", label: "YouTube", icon: "youtube", fill: "#ff0000" },
                { id: "vimeo", label: "Vimeo", icon: "vimeo", fill: "#17d5ff" },
                { id: "pixabay", label: "Pixabay", icon: "pixabay", fill: "#00ab6b", box: 48 },
                { id: "unsplash", label: "Unsplash", icon: "unsplash", fill: "#bbbbbb" }
            ]
            return (
                <>
                    <div className={styles.tabs}>
                        {tabs.map((tab) => (
                            <Button key={tab.id} style={tabsStyle} isActive={onlineTab === tab.id} onClick={() => setSubSubTab(tab.id)}>
                                <Icon style={onlineTab === tab.id ? { fill: tab.fill } : undefined} size={1.2} id={tab.icon} box={tab.box} white />
                                <p>{tab.label}</p>
                            </Button>
                        ))}
                        <Button style={tabsStyle} isActive={onlineTab === "canva"} onClick={() => setSubSubTab("canva")}>
                            {onlineTab === "canva" ? <CLogo /> : <Icon size={1.2} id="canva" white />}
                            <p>Canva</p>
                        </Button>
                    </div>
                    {onlineTab === "pixabay" || onlineTab === "unsplash" ? (
                        <div className={styles.onlineSearch}>
                            <Input value={onlineQuery} placeholder={translateText("main.search")} onChange={(e) => setOnlineQuery((e.target as HTMLInputElement).value.trim())} />
                        </div>
                    ) : null}
                </>
            )
        }
        return null
    }

    function renderItem(item: MediaItem) {
        const shiftRange = mediaFilesOnly.map((a) => ({ ...a, type: getMediaType(getExtension(a.name)), name: removeExtension(a.name) }))
        if (item.isFolder) {
            const previewPaths = (item.files || [])
                .map((filePath) => allRelevantFiles.find((a) => a.path === filePath)?.thumbnailPath)
                .filter((p): p is string => !!p)
                .slice(0, 4)
            return <Folder name={item.name} path={item.path} mode={mediaOptionsValue.mode as "grid" | "list"} previewPaths={previewPaths} folderFilesCount={countFolderMediaItems(item.path, allRelevantFiles as FileFolder[])} onOpen={setPath} />
        }
        return <MediaCard credits={item.credits || {}} name={item.name || ""} path={item.path} thumbnailPath={item.previewUrl || item.thumbnailPath} loadFullImage={mediaOptionsValue.columns < 3} type={getMediaType(item.extension || getExtension(item.name))} shiftRange={shiftRange} active={active} />
    }

    function renderMain() {
        if (isProviderSection && activeProviderId) return <ContentLibraryBrowser providerId={activeProviderId} columns={mediaOptionsValue.columns} />
        if (active === "online" && (onlineTab === "youtube" || onlineTab === "vimeo")) {
            return (
                <div className={`${styles.gridgap} context #player`}>
                    <PlayerVideos active={onlineTab} />
                </div>
            )
        }
        if (active === "online" && onlineTab === "canva") return <Canva />
        if (active === "inputs") {
            const onInputClick = ({ event, cam, screen }: InputSelectDetail) => clickInput(event, (cam || screen)!, inputsTab === "cameras" ? "camera" : inputsTab === "screens" ? "screen" : inputsTab)
            return (
                <div className={styles.gridgap}>
                    {inputsTab === "cameras" ? <Cameras onClick={onInputClick} /> : null}
                    {inputsTab === "screens" ? <Screens streams={streams} onClick={onInputClick} /> : null}
                    {inputsTab === "screens" ? <Windows streams={streams} onClick={onInputClick} /> : null}
                    {inputsTab === "ndi" ? <NDIStreams onClick={onInputClick} /> : null}
                    {inputsTab === "omt" ? <OMTStreams onClick={onInputClick} /> : null}
                    {inputsTab === "blackmagic" ? <BMDStreams onClick={onInputClick} /> : null}
                </div>
            )
        }
        if (searchedFiles.length) {
            return (
                <div className="context #media" style={{ display: "contents" }}>
                    <div key={searchedFiles.length}>{mediaOptionsValue.mode === "grid" ? <MediaGrid items={searchedFiles} columns={mediaOptionsValue.columns} render={(item) => renderItem(item as MediaItem)} /> : <VirtualList items={searchedFiles} render={(item) => renderItem(item as MediaItem)} />}</div>
                </div>
            )
        }
        return (
            <div className={SPECIAL_TABS.includes(active as (typeof SPECIAL_TABS)[number]) ? "" : "context #media"} style={{ display: "contents" }}>
                <Center style={{ opacity: 0.2 }}>
                    <Icon id="noImage" size={5} white />
                </Center>
            </div>
        )
    }

    function renderNav() {
        if (isProviderSection) return navZoom
        if (active === "online") {
            if (onlineTab === "youtube" || onlineTab === "vimeo") {
                return (
                    <>
                        <FloatingBar onlyOne>
                            <Button
                                title="groups.toggle_global_group"
                                onClick={() => {
                                    popupData.set({ active: onlineTab })
                                    activePopup.set("player")
                                }}
                            >
                                <Icon id="add" />
                                {!labelsDisabledValue ? <T id="settings.add" /> : null}
                            </Button>
                        </FloatingBar>
                        {navZoom}
                    </>
                )
            }
            if (onlineTab !== "canva" || providerConnectionsValue.canva) {
                return (
                    <>
                        <FloatingBar>
                            {onlineTab === "pixabay" ? (
                                <>
                                    <Button title="media.image" onClick={() => setView("image")}>
                                        <Icon size={1.2} id="image" white={activeView === "video"} />
                                    </Button>
                                    <Button title="media.video" onClick={() => setView("video")}>
                                        <Icon size={1.2} id="video" white={activeView !== "video"} />
                                    </Button>
                                </>
                            ) : null}
                        </FloatingBar>
                        {navZoom}
                    </>
                )
            }
            return navZoom
        }
        if (active === "inputs") return navZoom

        const backBar =
            active !== "all" && active !== "favourites" ? (
                rootPath !== path ? (
                    <FloatingBar side="left">
                        <Button disabled={rootPath === path} title="actions.back" onClick={(_detail: ButtonClickDetail) => goBack()}>
                            <Icon id="back" white />
                        </Button>
                        <div className="divider"></div>
                        <p style={{ opacity: 0.8, display: "flex", alignItems: "center", padding: "0 15px" }}>
                            <span style={{ opacity: 0.3, fontSize: "0.9em", maxWidth: "500px", overflow: "hidden", direction: "rtl" }}>
                                {pathString ? "/" : ""}
                                {pathString}
                            </span>
                            {folderName}
                            {fileCount && rootPath !== path ? <span style={{ opacity: 0.5, fontSize: "0.9em", marginInlineStart: "10px" }}>{fileCount}</span> : null}
                        </p>
                    </FloatingBar>
                ) : hasAudio.count ? (
                    <FloatingBar side="left" onlyOne>
                        <Button onClick={() => (hasAudio.exists ? openAudioFolder() : createAudioFolder())}>
                            <Icon id="autofill" />
                            <p>
                                <T id={`audio.${hasAudio.exists ? "open_audio_folder" : "create_audio_folder"}`} />
                                <span style={{ opacity: 0.5, fontSize: "0.8em", marginLeft: "5px" }}>{hasAudio.count}</span>
                            </p>
                        </Button>
                    </FloatingBar>
                ) : null
            ) : null

        return (
            <>
                {backBar}
                {navZoom}
            </>
        )
    }

    return (
        <>
            {renderTabs()}
            <div ref={scrollElem} className="scroll" style={{ flex: 1, overflowY: "auto" }}>
                <div className={styles.grid} style={{ height: "100%" }}>
                    {renderMain()}
                </div>
            </div>
            {renderNav()}
        </>
    )
}
