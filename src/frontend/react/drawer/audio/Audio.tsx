import { useEffect, useRef, useState, type CSSProperties } from "react"
import { uid } from "uid"
import { Main } from "../../../../types/IPC/Main"
import type { FileFolder } from "../../../../types/Main"
import { requestMain } from "../../../IPC/main"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { AudioPlaylist } from "../../../audio/audioPlaylist"
import { activePlaylist, activePopup, activeRename, audioFolders, audioPlaylists, drawerTabsData, effectsLibrary, labelsDisabled, media, outLocked, selectAllAudio, selected } from "../../../stores"
import { translateText } from "../../../utils/language"
import { clone, keysToID, sortFilenames } from "../../../components/helpers/array"
import { splitPath } from "../../../components/helpers/get"
import { getExtension, getFileName, getMediaType } from "../../../components/helpers/media"
import { joinTime, secondsToTime } from "../../../components/helpers/time"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Button, type ButtonClickDetail } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { NumberField } from "../../ui/number-field/NumberField"
import { Center } from "../../system/Center"
import { DropArea } from "../../system/DropArea"
import MicrophonesSvelte from "../../../components/drawer/live/Microphones.svelte"
import AudioStreamsSvelte from "../../../components/drawer/live/AudioStreams.svelte"
import { Folder } from "../media/Folder"
import { AudioFile } from "./AudioFile"
import { AudioEffect } from "./effects/AudioEffect"
import { Metronome } from "./Metronome"
import styles from "./Audio.module.css"

// Port de components/drawer/audio/Audio.svelte. Los inputs live siguen como SvelteIsland (se migran en F24.17f).
export interface AudioProps {
    active: string | null
}

interface AudioEntry {
    isFolder: boolean
    path: string
    name: string
    files?: string[]
    stats?: { birthtimeMs?: number; mtimeMs?: number }
}

const DEFAULT_TABS = ["all", "favourites", "effects_library", "inputs", "metronome"]

export function Audio({ active }: AudioProps) {
    const playlists = useStore(audioPlaylists)
    const folders = useStore(audioFolders)
    const tabsData = useStore(drawerTabsData)
    const library = useStore(effectsLibrary)
    const mediaValue = useStore(media)
    const locked = useStore(outLocked)
    const showLabels = useStore(labelsDisabled)
    const currentPlaylist = useStore(activePlaylist)
    const selectAllValue = useStore(selectAllAudio)
    const selectedValue = useStore(selected)

    const playlist = active ? playlists[active] : undefined
    const isDefault = DEFAULT_TABS.includes(active || "")
    const rootPath = isDefault || playlist ? "" : active !== null ? folders[active]?.path || "" : ""

    const [path, setPath] = useState(rootPath)
    const [foldersList, setFoldersList] = useState<AudioEntry[]>([])
    const [filesList, setFilesList] = useState<AudioEntry[]>([])
    const [allRelevantFiles, setAllRelevantFiles] = useState<AudioEntry[]>([])
    const [filteredFiles, setFilteredFiles] = useState<AudioEntry[]>([])
    const [searchedFiles, setSearchedFiles] = useState<AudioEntry[]>([])
    const [selectedFiles, setSelectedFiles] = useState<{ path: string; name: string }[]>([])
    const [playlistSettings, setPlaylistSettings] = useState(false)
    const [updater, setUpdater] = useState(1)
    const [inputsTab, setInputsTab] = useState(tabsData.audio?.openedSubSubTab?.microphones || "microphones")

    const scrollElem = useRef<HTMLDivElement>(null)
    const requesting = useRef(0)
    const prevActive = useRef<null | string>(null)

    const name = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : active === "effects_library" ? "category.sound_effects" : rootPath === path ? (active !== "inputs" && active !== "metronome" && active !== null ? folders[active]?.name || "" : "") : splitPath(path).name
    const pathString = path.replace(rootPath, "").replace(name, "").replaceAll("\\", "/").split("/").filter(Boolean).join("/")

    // $: path = isDefault || playlist ? "" : rootPath
    useEffect(() => {
        setPath(isDefault || playlist ? "" : rootPath)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, rootPath, isDefault, !!playlist])

    function filterFiles(files = filesList, folders = foldersList) {
        if (active === "inputs" || active === "metronome") return
        const localFiles = [...sortFilenames(files as never[]), ...sortFilenames(folders as never[])] as AudioEntry[]
        const next = clone(localFiles)
        setFilteredFiles(next)
        setSearchedFiles(next)
        scrollElem.current?.scrollTo(0, 0)
    }

    // `source` permite usar la lista recién calculada: el state de React todavía no se actualizó cuando se llama.
    function openFolder(folderPath: string, source: AudioEntry[] = allRelevantFiles) {
        if (folderPath === "all" || folderPath === "favourites" || folderPath === "effects_library") {
            const nextFiles = source.filter((a) => !a.isFolder)
            setFoldersList([])
            setFilesList(nextFiles)
            filterFiles(nextFiles, [])
            return
        }

        const folder = source.find((a) => a.isFolder && a.path === folderPath)
        if (!folder) return
        const nextFolders = source.filter((a) => a.isFolder && !!folder.files?.includes(a.path))
        const nextFiles = source.filter((a) => !a.isFolder && !!folder.files?.includes(a.path))
        setFoldersList(nextFolders)
        setFilesList(nextFiles)
        filterFiles(nextFiles, nextFolders)
    }

    async function requestFiles(requestPath: string | string[], depth = 0) {
        if (!requestPath) return
        requesting.current++
        const currentRequest = requesting.current
        const response = await requestMain(Main.READ_FOLDER, { path: requestPath, depth })
        const data = response as Record<string, FileFolder> | undefined
        if (!data || requesting.current !== currentRequest) return

        const relevant = Object.values(data).filter((a) => {
            if (a.isFolder) return a.files.length > 0
            return getMediaType(getExtension(a.name)) === "audio"
        }) as AudioEntry[]
        setAllRelevantFiles(relevant)
        openFolder(active === "all" ? "all" : (requestPath as string), relevant)
    }

    function updateContent() {
        if (active === "favourites") {
            prevActive.current = active
            const favourites = keysToID(mediaValue)
                .filter((a) => a.favourite === true && a.audio === true)
                .map((a) => ({ isFolder: false, path: a.id, name: getFileName(a.id), stats: {} }))
            setAllRelevantFiles(favourites)
            openFolder("favourites", favourites)
        } else if (active === "effects_library") {
            prevActive.current = active
            const files = library.map((a) => ({ isFolder: false, path: a.path, name: a.name, stats: {} }))
            setAllRelevantFiles(files)
            openFolder("effects_library", files)
        } else if (active === "all") {
            if (active === prevActive.current) return
            prevActive.current = active
            void requestFiles(Object.values(folders).map((a) => a.path!))
        } else if (path?.length) {
            if (path === prevActive.current) return
            prevActive.current = path
            void requestFiles(path)
        } else {
            prevActive.current = active
        }
    }

    // $: if (active || path || (active === "effects_library" && $effectsLibrary)) updateContent()
    useEffect(() => {
        if (active || path || (active === "effects_library" && library)) updateContent()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, path, library])

    function goBack() {
        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)
        setPath(folder.length > rootPath.length ? folder || rootPath : rootPath)
    }

    useEffect(() => {
        function keydown(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null
            if (target?.closest?.("input") || target?.closest?.(".edit")) return
            if ((event.ctrlKey || event.metaKey) && event.key === "Backspace") {
                if (rootPath === path) return
                goBack()
            }
        }
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootPath, path])

    function storeSelected() {
        // selected se limpia al hacer click, por eso se guarda en mousedown
        setSelectedFiles(selectedId === "audio" ? clone(selectedData as { path: string; name: string }[]) : [])
    }
    const selectedId = selectedValue?.id
    const selectedData = selectedValue?.data

    function createPlaylist(detail: ButtonClickDetail) {
        let playlistName = ""
        let files = filteredFiles.filter((a) => !a.isFolder) as { path: string; name: string }[]
        if (selectedFiles.length) files = selectedFiles.map((a) => ({ path: a.path, name: a.name }))

        if (detail.ctrl) files = []
        else if (!isDefault) {
            playlistName = name
            if (name.includes(".")) playlistName = translateText(`category.${name.slice(name.indexOf(".") + 1)}`)
        }

        const playlistId = uid()
        audioPlaylists.update((a) => ({ ...a, [playlistId]: { name: playlistName, songs: files.map((a) => a.path) } }))
        drawerTabsData.update((a) => ({ ...a, audio: { ...a.audio, activeSubTab: playlistId } }))
        if (!playlistName || !files.length) activeRename.set("category_audio_" + playlistId)
    }

    function selectAll() {
        if (playlist) {
            selected.set({
                id: "audio",
                data: playlist.songs.map((file, index) => ({ path: file, name: getFileName(file), index }))
            })
            selectAllAudio.set(false)
            return
        }
        selected.set({
            id: "audio",
            data: filteredFiles.filter((a) => getExtension(a.name)).map((file) => ({ path: file.path, name: file.name, index: -1 }))
        })
        selectAllAudio.set(false)
    }

    useEffect(() => {
        if (selectAllValue) selectAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectAllValue])

    useEffect(() => {
        if (!active) return
        const t1 = setTimeout(() => setUpdater((v) => v + 1), 500)
        const t2 = setTimeout(() => setUpdater((v) => v + 1), 2000)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [active])

    function setSubSubTab(id: string) {
        if (!active) return
        drawerTabsData.update((a) => ({
            ...a,
            audio: { ...a.audio, enabled: true, activeSubTab: active, openedSubSubTab: { ...a.audio?.openedSubSubTab, [active]: id } }
        }))
        if (active === "inputs") setInputsTab(id)
    }

    const tabStyle = { flex: 1 } as CSSProperties

    function renderContent() {
        if (active === "inputs") {
            if (inputsTab === "microphones") return <SvelteIsland component={MicrophonesSvelte} />
            if (inputsTab === "audio_streams") return <SvelteIsland component={AudioStreamsSvelte} />
            return null
        }
        if (active === "metronome") return <Metronome />
        if (playlist && playlistSettings) {
            return (
                <div className={styles.settings}>
                    <NumberField label="settings.audio_crossfade (s)" value={playlist.crossfade || 0} max={60} sliderValues={{ max: 10, step: 0.5 }} showSlider onChange={(value) => AudioPlaylist.update(active || "", "crossfade", value)} />
                    <NumberField label="settings.playlist_volume (%)" value={Number(((playlist.volume || 1) * 100).toFixed(2))} min={1} max={100} showSlider onChange={(value) => AudioPlaylist.update(active || "", "volume", (value ?? 0) / 100)} />
                </div>
            )
        }
        if (playlist) {
            return (
                <DropArea id="audio_playlist" selectChildren>
                    {playlist.songs.length ? (
                        playlist.songs.map((song, index) => <AudioFile key={`${song}-${index}`} path={song} name={getFileName(song)} active={active} playlist index={index} />)
                    ) : (
                        <Center faded>
                            <T id="empty.general" />
                        </Center>
                    )}
                </DropArea>
            )
        }
        if (active === "effects_library") {
            return (
                <DropArea id="effects_library" file>
                    {searchedFiles.length ? (
                        <div className={styles.effects}>
                            {searchedFiles.map((file) => (
                                <AudioEffect key={file.path} path={file.path} name={file.name} />
                            ))}
                        </div>
                    ) : (
                        <Center faded>
                            <T id="empty.general" />
                        </Center>
                    )}
                </DropArea>
            )
        }
        if (searchedFiles.length) {
            return searchedFiles.map((file) => (file.isFolder ? <Folder key={file.path} name={file.name} path={file.path} mode="list" onOpen={setPath} /> : <AudioFile key={file.path} path={file.path} name={file.name} active={active} />))
        }
        return (
            <Center style={{ opacity: 0.2 }}>
                <Icon id="noAudio" size={5} white />
            </Center>
        )
    }

    function renderNav() {
        if (active === "effects_library" || active === "metronome") return null
        if (active === "inputs") {
            if (inputsTab !== "audio_streams") return null
            return (
                <FloatingBar onlyOne>
                    <Button icon="add" style={{ flex: 1 }} onClick={() => activePopup.set("audio_stream")} title="new.audio_stream">
                        {!showLabels ? <T id="new.audio_stream" /> : null}
                    </Button>
                </FloatingBar>
            )
        }
        if (playlist) {
            const isPlaying = currentPlaylist?.id === active
            const totalTime = updater && joinTime(secondsToTime(playlist.songs.reduce((sum, song) => sum + AudioPlayer.getDurationSync(song), 0)))
            return (
                <>
                    <FloatingBar side="left">
                        <Button
                            disabled={locked}
                            title={isPlaying ? "media.stop" : "media.play"}
                            onClick={() => {
                                if (locked) return
                                isPlaying ? AudioPlaylist.stop() : AudioPlaylist.start(active || "")
                            }}
                        >
                            <Icon size={1.3} id={isPlaying ? "stop" : "play"} white={!isPlaying} />
                        </Button>

                        <div className="divider" />

                        <Button
                            title="media.toggle_shuffle"
                            onClick={() => {
                                if (!active) return
                                AudioPlaylist.update(active, "mode", playlists[active]?.mode === "shuffle" ? "default" : "shuffle")
                            }}
                        >
                            <Icon size={1.1} id="shuffle_play" white={playlists[active || ""]?.mode !== "shuffle"} />
                        </Button>
                        <Button
                            title={`media._loop${playlists[active || ""]?.loop !== false ? ": settings.enabled" : ""}`}
                            onClick={() => {
                                if (!active) return
                                AudioPlaylist.update(active, "loop", playlists[active]?.loop === undefined ? false : !playlists[active]?.loop)
                            }}
                        >
                            <Icon size={1.1} id="loop" white={playlists[active || ""]?.loop === false} />
                        </Button>
                        <Button
                            title={`media.auto_next${playlists[active || ""]?.autoNext !== false ? ": settings.enabled" : ""}`}
                            onClick={() => {
                                if (!active) return
                                AudioPlaylist.update(active, "autoNext", playlists[active]?.autoNext === undefined ? false : !playlists[active]?.autoNext)
                            }}
                        >
                            <Icon size={1.1} id="auto" white={playlists[active || ""]?.autoNext === false} />
                        </Button>

                        <div className="divider" />

                        <p className={styles.time}>{totalTime}</p>
                    </FloatingBar>

                    <FloatingBar round>
                        <Button isActive={playlistSettings} title="audio.playlist_settings" onClick={() => setPlaylistSettings(!playlistSettings)}>
                            <Icon size={1.1} id="options" white={!playlistSettings} />
                        </Button>
                    </FloatingBar>
                </>
            )
        }
        if (active === "all" || active === "favourites") return null

        return (
            <>
                {rootPath !== path ? (
                    <FloatingBar side="left">
                        <Button disabled={rootPath === path} title="actions.back" onClick={() => goBack()}>
                            <Icon id="back" white />
                        </Button>

                        <div className="divider" />

                        <p style={{ opacity: 0.8, display: "flex", alignItems: "center", padding: "0 15px" }}>
                            <span style={{ opacity: 0.3, fontSize: "0.9em", maxWidth: 500, overflow: "hidden", direction: "rtl" }}>
                                {pathString ? "/" : ""}
                                {pathString}
                            </span>
                            {name}
                        </p>
                    </FloatingBar>
                ) : null}

                {filteredFiles.filter((a) => !a.isFolder).length ? (
                    <FloatingBar onlyOne onMouseDown={storeSelected}>
                        <Button title="new.playlist" onClick={createPlaylist}>
                            <Icon size={1.2} id="playlist_create" />
                            {!showLabels ? (
                                <p>
                                    <T id="new.playlist" />
                                </p>
                            ) : null}
                        </Button>
                    </FloatingBar>
                ) : null}
            </>
        )
    }

    return (
        <>
            {active === "inputs" ? (
                <div className={styles.tabs}>
                    <Button style={tabStyle} isActive={inputsTab === "microphones"} onClick={() => setSubSubTab("microphones")}>
                        <Icon size={1.2} id="microphone" white />
                        <p>
                            <T id="live.microphones" />
                        </p>
                    </Button>
                    <Button style={tabStyle} isActive={inputsTab === "audio_streams"} onClick={() => setSubSubTab("audio_streams")}>
                        <Icon size={1.2} id="audio_stream" white />
                        <p>
                            <T id="live.audio_streams" />
                        </p>
                    </Button>
                </div>
            ) : null}

            <div ref={scrollElem} className={`${styles.scroll} ${active === "inputs" || active === "effects_library" ? styles.full : ""}`} style={{ flex: 1, overflowY: "auto" }}>
                <div className={styles.grid} style={active !== "inputs" && active !== "effects_library" && !playlist && searchedFiles.length ? undefined : { height: "100%" }}>
                    {renderContent()}
                </div>
            </div>

            {renderNav()}
        </>
    )
}
