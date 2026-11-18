import { useEffect, useRef, useState } from "react"
import { get } from "../../lib/store"
import type { ContentProviderId } from "../../../types/ContentProvider"
import { Main } from "../../../types/IPC/Main"
import { getTimeFromInterval, joinTimeBig } from "../../components/helpers/time"
import { requestMain, sendMain } from "../../IPC/main"
import { activePopup, alertMessage, autosave, cloudSyncData, dataPath, driveData, driveKeys, providerConnections, saved, special, statusIndicator } from "../../stores"
import { changeTeam, setupCloudSync, socketDisconnect, updateCloudDeviceName } from "../../utils/cloudSync"
import { previousAutosave, startAutosave, wait } from "../../utils/common"
import { validateKeys } from "../../utils/drive"
import { translateText } from "../../utils/language"
import { save } from "../../utils/save"
import { convertAutosave } from "../../values/autosave"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { FileField } from "../ui/file-field/FileField"
import { FolderField } from "../ui/folder-field/FolderField"
import { InputRow } from "../ui/input-row/InputRow"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { Title } from "../ui/title/Title"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Files.module.css"

// Port de components/settings/tabs/Files.svelte (F24.12). Los handlers leen los stores con get() al ejecutarse,
// igual que el `$store` del Svelte, que siempre vale lo último (también después de un await).
function updateSpecial(value: unknown, key: string) {
    special.update((a) => {
        if (!value) delete a[key]
        else a[key] = value

        return a
    })
}

// NOTE: monthly is misspelled as "mothly"
const autobackupValues = ["never", "daily", "weekly", "mothly"]
const autosaveValues = ["2min", "5min", "10min", "15min", "30min", "60min", "120min"]

function updateValue(value: string | null, key: string) {
    if (!value) return

    // mainFolderId: It seems the character length is 33 for drive folders and 44 for files.
    driveData.update((a) => {
        a[key] = value
        return a
    })
}

function toggleData(checked: boolean, key: string, invert = false) {
    driveData.update((a) => {
        a[key] = invert ? !checked : checked
        return a
    })
}

function updateAutosave(value: string | null) {
    autosave.set(value ?? "")
    startAutosave()
}

async function receiveKeysFile(value: string | string[]) {
    const path = Array.isArray(value) ? value[0] : value
    if (!path) {
        driveKeys.set({})
        driveData.set({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })
        return
    }

    const contents = ((await requestMain(Main.READ_FILE, { path })) || {}).content
    if (contents) validateKeys(contents)
}

async function updateDataPath(newPath: string) {
    if (!get(saved)) {
        // save files first and backup just in case
        save(false, { backup: true, isAutoBackup: true })
        await wait(1500)
    }

    const oldPath = get(dataPath)

    sendMain(Main.UPDATE_DATA_PATH, { newPath, oldPath })
    dataPath.set(newPath)

    sendMain(Main.REFRESH_SHOWS)
}

// CLOUD

function updateCloudData(key: string, value: unknown) {
    cloudSyncData.update((a) => ({ ...a, [key]: value }))

    if (key === "deviceName") updateCloudDeviceName()
}

function toggleSync(enabled: boolean) {
    if (enabled) {
        setupCloudSync()
    } else {
        updateCloudData("enabled", false)
    }
}

function syncNow() {
    saved.set(false)
    save(false, { autosave: true })
}

async function restoreCloudBackupState() {
    const sync = get(cloudSyncData)
    if (!sync.id || !sync.team?.churchId || !sync.team?.id) return

    const result = await requestMain(Main.RESTORE_CLOUD_BACKUP, { id: "churchApps", churchId: sync.team.churchId, teamId: sync.team.id })

    alertMessage.set(result?.success ? "Cloud backup restored." : result?.error || "Could not restore cloud backup.")
    activePopup.set("alert")
}

const infoStyle = "color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;"

export function Files() {
    const autosaveValue = useStore(autosave)
    const specialValue = useStore(special)
    const dataPathValue = useStore(dataPath)
    const providerConnectionsValue = useStore(providerConnections)
    const cloudSyncDataValue = useStore(cloudSyncData)
    const statusIndicatorValue = useStore(statusIndicator)
    const driveKeysValue = useStore(driveKeys)
    const driveDataValue = useStore(driveData)
    const activePopupValue = useStore(activePopup)

    // get times
    const [nextAutosave, setNextAutosave] = useState(0)
    const [nextAutobackup, setNextAutobackup] = useState(0)
    // checkTimes lee el valor anterior (si ya venció se queda en -1): hace falta síncrono, no el del último render
    const nextAutobackupRef = useRef(0)
    const [mediaFolderPath, setMediaFolderPath] = useState("")
    const [disconnecting, setDisconnecting] = useState(false)
    const [resetValue, setResetValue] = useState(0)
    const bundled = useRef(false)

    useEffect(() => {
        function setAutobackup(value: number) {
            nextAutobackupRef.current = value
            setNextAutobackup(value)
        }

        function checkTimes() {
            const now = Date.now()

            // autosave
            const as = get(autosave) || "15min"
            if (previousAutosave && as !== "never") {
                const saveInterval = convertAutosave[as as keyof typeof convertAutosave]
                setNextAutosave(now - previousAutosave - saveInterval)
            } else {
                setNextAutosave(0)
            }

            // auto backup
            const current = get(special)
            const interval = current.autoBackup || "weekly"
            if (interval === "never" || get(activePopup) === "initialize") {
                setAutobackup(0)
                return
            }
            if (nextAutobackupRef.current < 0) return
            const lastBackup = current.autoBackupPrevious || 0
            const minTimeToBackup = getTimeFromInterval(interval)
            let next = minTimeToBackup - (now - lastBackup)
            if (next < 0) next = -1
            setAutobackup(next)
        }

        checkTimes()
        const updater = setInterval(checkTimes, 1000)

        if (get(cloudSyncData).enabled && get(special).cloudSyncMediaFolder) {
            requestMain(Main.GET_MEDIA_FOLDER_PATH).then((path) => setMediaFolderPath(path || ""))
        }

        return () => clearInterval(updater)
    }, [])

    // abrir cualquier popup remonta el interruptor de sincronización (descarta su estado si se canceló)
    useEffect(() => {
        if (activePopupValue) setResetValue((value) => value + 1)
    }, [activePopupValue])

    const autosaveList = [{ value: "never", label: translateText("settings.never") }, ...autosaveValues.map((value) => ({ value, label: translateText(`${value.replace("min", "")} settings.minutes`) }))]
    const autobackupList = autobackupValues.map((value) => ({ value, label: translateText(value === "never" ? "settings.never" : `interval.${value}`) }))

    const validKeys = typeof driveKeysValue === "object" && Object.keys(driveKeysValue).length
    const autosaveInfo = nextAutosave ? `<span style="${infoStyle}">${joinTimeBig(nextAutosave / 1000)}<span>` : ""
    const autoBackupInfo = nextAutobackup ? `<span style="${infoStyle}">${joinTimeBig(nextAutobackup < 0 ? 0 : nextAutobackup / 1000)}<span>` : ""
    const autoBackup = specialValue.autoBackup || "weekly"

    async function updateMediaFolderPath(value: string) {
        let path = value || ""
        setMediaFolderPath(path)
        sendMain(Main.SET_MEDIA_FOLDER_PATH, path)

        // get default path again if reset
        if (!path) {
            path = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) || ""
            setMediaFolderPath(path)
        } else sendMain(Main.BUNDLE_MEDIA_FILES, { outputPath: path })
    }

    async function contentProviderConnect(providerId: ContentProviderId) {
        if (!get(providerConnections)[providerId]) {
            cloudSyncData.set({})
            special.update((a) => {
                a.churchAppsCloudOnly = true
                return a
            })

            sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId, cloudOnly: true })
        } else {
            if (providerId === "churchApps" && !get(special).churchAppsCloudOnly) {
                const enabled = !get(cloudSyncData).enabled
                cloudSyncData.set({ enabled, id: "churchApps" })
                toggleSync(enabled)
                return
            }

            setDisconnecting(true)
            await socketDisconnect()
            requestMain(Main.PROVIDER_DISCONNECT, { providerId }, (a) => {
                setDisconnecting(false)
                if (!a?.success) return
                providerConnections.update((c) => {
                    c[providerId] = false
                    return c
                })
            })

            if (get(cloudSyncData).id === providerId) cloudSyncData.set({})
        }
    }

    async function toggleMediaFolder(checked: boolean) {
        updateSpecial(checked, "cloudSyncMediaFolder")

        if (checked) {
            if (bundled.current) return
            bundled.current = true

            // alertMessage.set("media.media_sync_folder_tip")
            // activePopup.set("alert")

            let path = mediaFolderPath
            if (!path) {
                path = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) || ""
                setMediaFolderPath(path)
            }
            sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true, outputPath: path })
        }
    }

    return (
        <>
            <SelectField label={`settings.autosave${autosaveInfo}`} value={autosaveValue} defaultValue="15min" options={autosaveList} onChange={updateAutosave} />
            <SelectField label={`settings.auto_backup${autoBackupInfo}`} value={autoBackup} defaultValue="weekly" options={autobackupList} onChange={(value) => updateSpecial(value, "autoBackup")} />

            <FolderField label="settings.data_location" value={dataPathValue} onChange={updateDataPath} />

            {/* cloud */}
            <Title label="settings.cloud" icon="cloud" title="cloud.info" />

            {!providerConnectionsValue.churchApps || (!specialValue.churchAppsCloudOnly && !cloudSyncDataValue.enabled) ? (
                <InputRow>
                    <Button onClick={() => contentProviderConnect("churchApps")} style={{ flex: 1 }} icon="login">
                        <T id="settings.connect_to" replace={["ChurchApps"]} />
                    </Button>
                </InputRow>
            ) : (
                <>
                    <InputRow>
                        <Button disabled={disconnecting} onClick={() => contentProviderConnect("churchApps")} className={styles.connected} icon="logout">
                            <T id="settings.disconnect_from" replace={["ChurchApps"]} />
                        </Button>
                        {cloudSyncDataValue.enabled ? (
                            <Button icon="cloud_sync" disabled={statusIndicatorValue === "syncing"} onClick={syncNow}>
                                <T id="cloud.sync" />
                            </Button>
                        ) : null}
                    </InputRow>

                    <InputRow
                        arrow={cloudSyncDataValue.enabled}
                        menu={
                            <>
                                <TextField label="settings.device_name" value={cloudSyncDataValue.deviceName || ""} onChange={(value) => updateCloudData("deviceName", value)} />

                                {/* changing team directly without toggling "Enable sync" off/on */}
                                <ToggleField label="cloud.read_only" title="cloud.readonly_tip" checked={cloudSyncDataValue.cloudMethod === "read_only"} defaultValue={false} onChange={(checked) => updateCloudData("cloudMethod", checked ? "read_only" : "merge")} />

                                {/* Documents/PulseFlow/Media */}
                                {/* This should only be needed if no custom media management is already existing */}
                                {/* Custom drives should work without as long as the path location is the same */}
                                {/* Files in this folder will automatically be checked to find missing files */}
                                <ToggleField label="media.media_sync_folder" title="media.media_sync_folder_tip" style={{ width: "100%" }} checked={specialValue.cloudSyncMediaFolder} defaultValue={false} onChange={toggleMediaFolder} />

                                {specialValue.cloudSyncMediaFolder ? <FolderField label="media.media_sync_folder" value={mediaFolderPath} onChange={updateMediaFolderPath} allowEmpty={!mediaFolderPath.endsWith("Documents\\PulseFlow\\Media") && !mediaFolderPath.endsWith("Documents/PulseFlow/Media")} /> : null}

                                {/* <Button variant="outline" icon="delete" on:click={deleteCloudData} red white>Delete cloud data</Button> */}

                                <Button variant="outline" icon="import" disabled={statusIndicatorValue === "syncing"} onClick={restoreCloudBackupState}>
                                    <p>
                                        <T id="cloud.restore_weekly_backup" />
                                    </p>
                                </Button>
                            </>
                        }
                    >
                        <InputRow style={{ flex: 1 }}>
                            <ToggleField key={resetValue} label="cloud.enable_sync" data={cloudSyncDataValue.team?.name} checked={cloudSyncDataValue.enabled} style={{ flex: 1 }} onChange={toggleSync} />

                            {cloudSyncDataValue.enabled && (cloudSyncDataValue.team?.count || 0) > 1 ? (
                                <Button variant="outline" icon="people" onClick={() => changeTeam()}>
                                    <T id="cloud.change_team" />
                                </Button>
                            ) : null}
                        </InputRow>
                    </InputRow>
                </>
            )}

            {/* DEPRECATED: */}

            {!providerConnectionsValue.churchApps && validKeys ? (
                <>
                    <FileField label="Google API service account key" title="Import keys file" value="Update keys file" filter={{ name: "Key file", extensions: ["json"] }} icon="key" onChange={receiveKeysFile} allowEmpty />
                    <ToggleField label="Disable uploading data" checked={driveDataValue.disableUpload} defaultValue={false} onChange={(checked) => toggleData(checked, "disableUpload")} />

                    <ToggleField label="cloud.enable" checked={!driveDataValue.disabled} defaultValue={true} onChange={(checked) => toggleData(checked, "disabled", true)} />
                    <TextField label={`Set main folder manually${driveDataValue?.mainFolderId ? `<span style="margin-left: 10px;font-size: 0.7em;opacity: 0.5;color: var(--text);">drive.google.com/drive/folders/</span>` : ""}`} value={driveDataValue?.mainFolderId || ""} onChange={(value) => updateValue(value, "mainFolderId")} />
                </>
            ) : null}
        </>
    )
}
