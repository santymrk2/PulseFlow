import { get } from "svelte/store"
import type { ContentProviderId } from "../../types/ContentProvider"
import { OUTPUT, STARTUP } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { checkStartupActions } from "../components/actions/actions"
import { syncIcsCalendars } from "../components/drawer/calendar/calendars"
import { getTimeFromInterval } from "../components/helpers/time"
import { startLookBridge } from "../components/helpers/looks"
import { checkTimers, startEventTimer, startTimer } from "../components/helpers/timerTick"
import { requestMain, requestMainMultiple, sendMain, sendMainMultiple } from "../IPC/main"
import { cameraManager } from "../media/cameraManager"
import { activePopup, activeProfile, activeTimers, alertMessage, cachePath, closeAd, cloudSyncData, contentProviderData, currentWindow, dataPath, deviceId, disabledServers, driveKeys, events, isDev, language, loaded, loadedState, localeDirection, os, outputDisplay, profiles, providerConnections, shows, special, timers, version, windowState } from "../stores"
import { startTracking } from "./analytics"
import { setupCloudSync } from "./cloudSync"
import { toggleRemoteStream, wait, waitUntilValueIsDefined } from "./common"
import { getDefaultElements } from "./createData"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { autoOpenLastUsedProfile, openProfileByName } from "./profile"
import { remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"

let initialized = false
let startupProfile = ""

export async function startup() {
    if (!window.api) {
        // wait for window.api to be available (preload script might not be ready yet) - not likely
        await waitUntilValueIsDefined(() => window.api, 20, 5000)
        if (!window.api) return console.error("window.api is not available after waiting")
    }

    window.api.receive(
        STARTUP,
        (msg) => {
            if (initialized || msg.channel !== "TYPE") return
            initialized = true // only call this once per window
            destroy(STARTUP, "startup")

            const type = msg.data
            currentWindow.set(type)

            if (type) loaded.set(true)

            if (type === "pdf") return

            startupProfile = msg.autoProfile

            startupMain()
        },
        "startup"
    )

    window.api.send(STARTUP, { channel: "READY" })
}

let appEffectsInitialized = false

/// Timers y listeners globales de la ventana principal (F9.1).
/// Antes vivían como sentencias reactivas en `App.svelte`; acá se suscriben
/// a los stores una sola vez (idempotente, igual que `startup`).
export function startupAppEffects() {
    if (appEffectsInitialized) return
    appEffectsInitialized = true

    // reloj de cuenta regresiva de los timers activos
    activeTimers.subscribe((a) => {
        if (a.length) startTimer()
    })
    timers.subscribe((t) => {
        if (Object.keys(t).length) checkTimers()
    })

    // chequeo de eventos de acción agendados
    events.subscribe((e) => {
        if (Object.keys(e).length) startEventTimer()
    })

    // stream a OutputShow
    loaded.subscribe(checkRemoteStream)
    disabledServers.subscribe(checkRemoteStream)
    outputDisplay.subscribe(checkRemoteStream)

    // cierre del ad de YouTube
    closeAd.subscribe(closeAdNow)

    // dirección e idioma del documento
    localeDirection.subscribe((dir) => document.documentElement.setAttribute("dir", dir))
    language.subscribe((lang) => document.documentElement.setAttribute("lang", lang))
}

function checkRemoteStream() {
    if ((get(loaded) && get(disabledServers).output_stream !== "") || !get(outputDisplay)) setTimeout(toggleRemoteStream, 1000)
}

function closeAdNow(close: boolean) {
    if (close) setTimeout(() => closeAd.set(false), 10)
}

async function startupMain() {
    setLanguage("", true)
    setupMainReceivers()
    getMainData()

    await wait(50)
    getStoredData()

    await waitUntilValueIsDefined(() => get(loaded), 50, 8000)

    if (startupProfile) openProfileByName(startupProfile)
    else autoOpenLastUsedProfile()

    storeSubscriber()
    // F10.2: el bridge mantiene los punteros de outputs sincronizados con el look activo
    startLookBridge()
    remoteListen()

    const hasProfiles = Object.keys(get(profiles)).filter((a) => a !== "admin").length > 0
    if (!hasProfiles || get(activeProfile) !== null) checkStartupActions()

    startTracking()
    contentProviderSync(true)

    // custom alert
    // if (Math.random() < 0.01) {
    //     alertMessage.set("")
    //     activePopup.set("alert")
    // }

    await wait(2000)

    autoBackup()
    await wait(3000)

    unsavedUpdater()
    windowFocusListener()
    cameraManager.initializeCameraWarming()
    syncIcsCalendars()

    // CHECK LISTENERS
    // console.log(window.api.getListeners())

    // RAM MONITOR (every 10 minutes)
    setTimeout(() => checkRamUsage(), 10000)
    setInterval(() => checkRamUsage(), 600000)
}

// window focus state
function windowFocusListener() {
    if (typeof window === "undefined") return

    const updateFocus = () => {
        if (document.hasFocus()) document.body.classList.remove("unfocused")
        else document.body.classList.add("unfocused")
    }

    window.addEventListener("focus", updateFocus)
    window.addEventListener("blur", updateFocus)
    updateFocus()
}

async function checkRamUsage() {
    const ram = await requestMain(Main.CHECK_RAM_USAGE)
    if (ram && (ram.performanceMode ? ram.performanceMode !== get(special).optimizedMode : get(special).optimizedMode)) special.set({ ...get(special), optimizedMode: ram.performanceMode })
}

function autoBackup() {
    const interval = get(special).autoBackup || "weekly"
    if (interval === "never" || get(activePopup) === "initialize") return

    const now = Date.now()
    const lastBackup = get(special).autoBackupPrevious || 0
    const minTimeToBackup = getTimeFromInterval(interval)

    if (now - lastBackup > minTimeToBackup) {
        save(false, { backup: true, isAutoBackup: true })
    }
}

const lastProviderSyncs: Partial<Record<ContentProviderId, number>> = {}
export function contentProviderSync(startup = false, remainingOnly = false) {
    const isCloudSyncEnabled = get(cloudSyncData).enabled && get(cloudSyncData).id

    if (isCloudSyncEnabled && !remainingOnly) {
        setupCloudSync(startup)
        return
    }

    const providers = [
        { providerId: "churchApps" as ContentProviderId, scope: "plans", data: { shows: get(shows), categories: get(contentProviderData).churchApps?.syncCategories || [] } },
        { providerId: "amazinglife" as ContentProviderId, scope: "openid profile email" },
        { providerId: "onstage" as ContentProviderId, scope: "presenter", data: get(contentProviderData).onstage || {}, autoSync: get(contentProviderData).onstage?.autoSync !== false }
    ]

    providers.forEach(({ providerId, scope, data, autoSync }) => {
        if (startup && autoSync === false) return

        // make sure the same provider does not run multiple times at once
        const now = Date.now()
        const lastSync = lastProviderSyncs[providerId] || 0
        if (now - lastSync < 5000) return
        lastProviderSyncs[providerId] = now

        const cloudOnly = providerId === "churchApps" && get(special).churchAppsCloudOnly
        sendMain(Main.PROVIDER_STARTUP_LOAD, { providerId, scope, data, cloudOnly })
    })

    setTimeout(() => {
        if (get(cloudSyncData).id) return

        const hasDriveSync = typeof get(driveKeys) === "object" && Object.keys(get(driveKeys)).length
        if (!Object.keys(get(providerConnections)).length && !get(activePopup) && Math.random() < (hasDriveSync ? 0.2 : 0.001)) {
            alertMessage.set("You can now set up free cloud sync with ChurchApps! Go to Settings>Files to log in." + (hasDriveSync ? "<br>It's recommended to switch over from your current Google Sync!" : ""))
            activePopup.set("alert")
        }
    }, 2000)
}

function getMainData() {
    requestMainMultiple({
        [Main.VERSION]: (a) => (a ? version.set(a) : null),
        [Main.IS_DEV]: (a) => isDev.set(a || false),
        [Main.GET_OS]: (a) => (a ? os.set(a) : null),
        [Main.GET_CACHE_PATH]: (a) => cachePath.set(a || ""),
        [Main.DEVICE_ID]: (a) => deviceId.set(a || ""),
        [Main.MAXIMIZED]: (a) => windowState.set({ ...get(windowState), maximized: a ?? false }),
        [Main.DATA_PATH]: (a) => (a ? dataPath.set(a) : null),
        // get connected providers, even before the first sync of the session
        [Main.PROVIDER_CONNECTIONS]: (a) => {
            if (!a) return
            providerConnections.update((c) => {
                Object.keys(a).forEach((providerId) => {
                    // churchApps is handled separately, due to cloud sync
                    if (providerId === "churchApps") return

                    c[providerId as ContentProviderId] = true
                })
                return c
            })
        }
    })
}

async function getStoredData() {
    sendMainMultiple([Main.SYNCED_SETTINGS, Main.STAGE, Main.PROJECTS, Main.OVERLAYS, Main.TEMPLATES, Main.EVENTS, Main.MEDIA, Main.THEMES, Main.DRIVE_API_KEY, Main.HISTORY, Main.CACHE, Main.USAGE])

    await waitUntilValueIsDefined(() => get(loadedState).includes("synced_settings"), 200, 8000)
    sendMain(Main.SETTINGS)

    // LOAD SHOWS FROM FOLDER
    sendMain(Main.SHOWS)

    getDefaultElements()
}
