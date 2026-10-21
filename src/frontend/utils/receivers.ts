import { get } from "svelte/store"
import { CLOUD, CONTROLLER, NDI, OMT, OUTPUT, OUTPUT_STREAM, REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { AudioMicrophone } from "../audio/audioMicrophone"
import { MIN_DB } from "../audio/dBUtils"
import { runAction } from "../components/actions/actions"
import { handleRecorderFrame } from "../components/drawer/live/recorder"
import { getDynamicValue } from "../components/edit/scripts/itemHelpers"
import { clone } from "../components/helpers/array"
import { receiveMainGlobal } from "../IPC/main"
import {
    actions,
    activePopup,
    activeProject,
    activeShow,
    activeTimers,
    alertMessage,
    allOutputs,
    audioChannelsData,
    audioData,
    cachedDynamicValues,
    categories,
    closeAd,
    colorbars,
    customMessageCredits,
    customMetadata,
    driveData,
    dynamicValueData,
    effects,
    events,
    focusMode,
    globalRegexes,
    groups,
    livePrepare,
    media,
    metronome,
    metronomeTimer,
    ndiData,
    omtData,
    outputDisplay,
    outputs,
    outputSlideCache,
    outputState,
    overlays,
    playerVideos,
    playingAudioPaths,
    playingVideoState,
    popupData,
    previewBuffers,
    projects,
    shows,
    showsCache,
    slideTimelineSpeedMultiplier,
    special,
    stageShows,
    styles,
    syncedOutputs,
    templates,
    timeFormat,
    timers,
    transitionData,
    variables,
    visualizerData,
    websiteAction
} from "../stores"
import { newToast } from "./common"
import { syncDrive } from "./drive"
import { setLanguage } from "./language"
import { sendInitialOutputData } from "./listeners"
import { receive, send } from "./request"
import { closeApp, save } from "./save"
import { client } from "./sendData"
import { previewShortcuts } from "./shortcuts"
import { restartOutputs } from "./updateSettings"

let mainReceiversInitialized = false
export function setupMainReceivers() {
    if (mainReceiversInitialized) return
    mainReceiversInitialized = true

    receiveMainGlobal()

    receive(OUTPUT, receiveOUTPUTasMAIN)
    receive(NDI, receiveNDI)
    receive(OMT, receiveOMT)
    receive(CLOUD, receiveCLOUD)
}

let remoteReceiversInitialized = false
export function remoteListen() {
    if (remoteReceiversInitialized) return
    remoteReceiversInitialized = true

    // FROM CLIENT (EXPRESS SERVERS)
    window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
    window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))
    window.api.receive(CONTROLLER, (msg: ClientMessage) => client(CONTROLLER, msg))
    window.api.receive(OUTPUT_STREAM, (msg: ClientMessage) => client(OUTPUT_STREAM, msg))
}

// OUTPUT

const receiveOUTPUTasMAIN: any = {
    BUFFER: ({ id, time, buffer, size }) => {
        // this will infinitely increace if this is not in place
        const timeSinceSent = Date.now() - time
        if (timeSinceSent > 100) return // skip frames if overloaded

        previewBuffers.update((a) => {
            a[id] = { buffer, size }
            return a
        })
    },
    RECORDER_FRAME: ({ id, buffer, size }: { id: string; buffer: ArrayBuffer | Uint8Array; size: { width: number; height: number } }) => {
        handleRecorderFrame(id, buffer, size)
    },
    OUTPUTS: (a: any) => outputs.set(a),
    RESTART: ({ id }) => restartOutputs(id),
    // DISPLAY: (a: any) => outputDisplay.set(a.enabled),
    OUTPUT_STATE: (newStates: { id: string; active: boolean | "invisible" }[]) => {
        outputState.update((a) => {
            newStates.forEach((newState) => {
                const stateIndex = a.findIndex((state) => state.id === newState.id)
                if (stateIndex < 0) a.push(newState)
                else a[stateIndex] = newState
            })

            // only enabled ones & not invisible
            a = a.filter((state) => get(outputs)[state.id]?.enabled && !get(outputs)[state.id]?.invisible)

            const getVisibleState = [...new Set(a.filter((state) => typeof state.active === "boolean").map((state) => state.active) as boolean[])]
            if (getVisibleState.length === 1) outputDisplay.set(getVisibleState[0])

            return a
        })
    },
    ACTION_MAIN: (a: { id: string }) => runAction(get(actions)[a.id], { source: "remote" }),
    MOVE: (data) => {
        outputs.update((a) => {
            if (!a[data.id] || a[data.id].boundsLocked) return a

            a[data.id].bounds = data.bounds
            if (data.screen) a[data.id].screen = data.screen
            return a
        })
    },
    UPDATE_OUTPUTS_DATA: ({ key, value, id, autoSave }) => {
        outputs.update((a) => {
            const ids = id ? [id] : Object.keys(get(outputs))
            ids.forEach((outputId) => {
                if (a[outputId]) a[outputId][key] = value
            })
            return a
        })
        if (autoSave) save()
    },
    REQUEST_DATA_MAIN: () => sendInitialOutputData(),
    MAIN_LOG: (msg: any) => console.info(msg),
    ALERT_MAIN: (data: string) => {
        if (!data) return

        alertMessage.set(data)
        activePopup.set("alert")
    },
    MAIN_SHORTCUT: (data: { key: string }) => {
        if (previewShortcuts[data.key]) {
            previewShortcuts[data.key]({ ...data, preventDefault: () => "" })
        }
    },
    MAIN_SHOWS_DATA: () => send(OUTPUT, ["SHOWS_DATA"], get(shows)),

    MAIN_REQUEST_DYNAMIC_VALUE: (data: { dynamicId: string }) => {
        if (!data?.dynamicId) return
        send(OUTPUT, ["REQUEST_DYNAMIC_VALUE"], { dynamicId: data.dynamicId, value: getDynamicValue(data.dynamicId) })
    },
    MAIN_REQUEST_VOLUME: (data: { deviceId: string }) => {
        if (!data?.deviceId) return
        const chData = (get(audioChannelsData) || {})[data.deviceId]
        const value = Math.round(chData?.dB ?? MIN_DB)
        send(OUTPUT, ["REQUEST_VOLUME"], { deviceId: data.deviceId, value })
    }
}

// NDI

const receiveNDI: any = {
    SEND_DATA: (msg) => {
        if (!msg?.id) return

        ndiData.update((a) => {
            a[msg.id] = msg

            return a
        })
    }
}

// OMT

const receiveOMT: any = {
    SEND_DATA: (msg) => {
        if (!msg?.id) return

        omtData.update((a) => {
            a[msg.id] = msg

            return a
        })
    }
}

// CLOUD

const receiveCLOUD = {
    DRIVE_CONNECT: ({ status, error }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (status !== "connected") return

        // WIP set connected status, and see in settings

        if (get(driveData)?.mainFolderId) {
            driveData.update((a) => {
                a.initializeMethod = "done"
                return a
            })

            syncDrive(false, false, true)
            return
        }

        send(CLOUD, ["GET_MAIN_FOLDER"], { method: get(driveData).initializeMethod })
    },
    GET_MAIN_FOLDER: ({ id, error, existingData }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (!id) return

        driveData.update((a) => {
            a.mainFolderId = id
            return a
        })

        let method = get(driveData).initializeMethod
        if (get(driveData).disableUpload) method = "download"
        if (!method) {
            // this is not needed for the shows, but for all the other data
            if (existingData) {
                activePopup.set("cloud_method")
                return
            }

            driveData.update((a) => {
                a.initializeMethod = existingData ? "done" : "upload"
                return a
            })
        }

        syncDrive(true)
    },
    SYNC_DATA: ({ changes, closeWhenFinished }) => {
        if (changes.error) {
            newToast(changes.error)
            if (!closeWhenFinished) return
        }

        if (closeWhenFinished) {
            popupData.set(changes)
            activePopup.set("cloud_update")

            // timeout so user can see the sync has finished before it closes!
            setTimeout(closeApp, 800)
            return
        }

        driveData.update((a) => {
            a.initializeMethod = "done"
            return a
        })

        if (!changes.length) {
            newToast("cloud.sync_complete")

            if (get(activePopup) !== "cloud_update") return

            popupData.set({})
            activePopup.set(null)

            return
        }

        // reload shows cache (because there could be some changes)
        if (!get(focusMode)) showsCache.set({})
        activeShow.set(null)

        // show completed toast
        newToast("cloud.sync_complete")

        // show popup if manually syncing
        if (get(activePopup) === "cloud_update") {
            popupData.set(changes)
            // activePopup.set("cloud_update")
        }

        // hide sync popup on startup/close sync
        // popupData.set({})
        // activePopup.set(null)
    }
}
