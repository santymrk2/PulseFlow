import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { ContentProviderId } from "../../../types/ContentProvider"
import { Main } from "../../../types/IPC/Main"
import { checkWindowCapture } from "../../components/helpers/output"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePage, activePopup, activeShow, activeTriggerFunction, cloudSyncData, connections, contentProviderData, disabledServers, maxConnections, notFound, obsData, outputs, popupData, ports, providerConnections, saved, serverData, special } from "../../shared/core/stores"
import { startRemoteController, stopRemoteController } from "../../utils/remoteController"
import { contentProviderSync } from "../../utils/startup"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Tip } from "../main/Tip"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import { Title } from "../ui/title/Title"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Connection.module.css"

// Port de components/settings/tabs/Connection.svelte (F24.13a).
const servers = [
    { id: "remote", name: "RemoteShow", icon: "connection", enabledByDefault: true },
    { id: "stage", name: "StageShow", icon: "stage", enabledByDefault: true },
    { id: "controller", name: "ControlShow", icon: "connection", enabledByDefault: false },
    // ...(($special.optimizedMode && $disabledServers.output_stream !== false) ? [] : [{ id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false }]),
    { id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false },
    // Bitfocus Companion (WebSocket/REST)
    { id: "companion", name: "API", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/companion" }
    // { id: "rest", name: "REST Listener", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/api" },
]
// Camera
// Answer / Guess / Poll

const providerOriginOptions = [
    { value: "", label: "Ask when existing show is found" },
    { value: "local", label: "Always use local instance" },
    { value: "online", label: "Always use online instance" }
]

const flexButton = { flex: 1, justifyContent: "space-between" } as const
const rowLabel = { display: "flex", alignItems: "center", justifyContent: "center", gap: "15px" } as const
const smallNote = { opacity: 0.5, fontSize: "0.7em", marginLeft: "5px" } as const

export function Connection() {
    const connectionsData = useStore(connections)
    const disabledServersValue = useStore(disabledServers)
    const serverDataValue = useStore(serverData)
    const specialValue = useStore(special)
    const providerConnectionsValue = useStore(providerConnections)
    const cloudSyncDataValue = useStore(cloudSyncData)
    const contentProviderDataValue = useStore(contentProviderData)
    const obsDataValue = useStore(obsData)
    const trigger = useStore(activeTriggerFunction)

    const [ip, setIp] = useState("localhost")

    useEffect(() => {
        requestMain(Main.IP).then((result) => setIp((result || ["localhost"])[0]))
    }, [])

    // WIP reset in popups
    // function reset() {
    //     ports.set({ remote: 5510, stage: 5511 })
    //     maxConnections.set(10)
    //     disabledServers.set({})
    //     serverData.set({ remote: { password: randomNumber(1000, 9999).toString() } })
    // }
    // const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

    function toggleServer(value: boolean, id: string) {
        // La limpieza va ANTES del update: el reinicio (subscribe) corre síncrono dentro de `disabledServers.update`,
        // mientras que el `$:` de Svelte corría después del flush, con `serverData` ya limpio.
        if (id === "output_stream") {
            const data = get(serverData)
            if (data?.output_stream?.outputId && !get(outputs)[data.output_stream.outputId]) {
                serverData.update((a) => {
                    delete a.output_stream.outputId
                    return a
                })
            }
        }

        disabledServers.update((a) => {
            a[id] = !value
            return a
        })

        if (value) {
            popupData.set({ ip, id })
            activePopup.set("connect")
        }

        if (id === "output_stream" && value) checkWindowCapture()
    }

    function toggleCompanion(value: boolean) {
        serverData.update((a) => {
            if (!a.companion) a.companion = {}
            a.companion.enabled = value
            return a
        })
        sendMain(Main.SERVER_DATA, get(serverData))

        if (value) sendMain(Main.WEBSOCKET_START, { port: get(ports).companion, password: get(serverData)?.companion?.password })
        else sendMain(Main.WEBSOCKET_STOP)
    }

    // restart servers on toggle on/off: `$: { $disabledServers; ... }` corre en cada set/update del store (el objeto se muta,
    // así que un efecto con el valor como dependencia no vería el cambio); la primera notificación es la suscripción y se salta.
    useEffect(() => {
        let initial = true
        return disabledServers.subscribe(() => {
            if (initial) initial = false
            else sendMain(Main.START, { ports: get(ports), max: get(maxConnections), disabled: get(disabledServers), data: get(serverData) })
        })
    }, [])

    useEffect(() => {
        if (!trigger.includes("open_connection_") || ip === "localhost") return
        const id = trigger.slice(16)
        popupData.set({ ip, id })
        activePopup.set("connect")
        activeTriggerFunction.set("")
    }, [trigger, ip])

    const cloudOnly: Record<string, boolean> = { churchApps: !!specialValue.churchAppsCloudOnly }
    function contentProviderConnect(providerId: ContentProviderId) {
        if (!providerConnectionsValue[providerId] || cloudOnly[providerId]) {
            if (providerId === "churchApps") {
                special.update((a) => {
                    delete a.churchAppsCloudOnly
                    return a
                })

                if (cloudSyncDataValue.enabled === undefined) {
                    cloudSyncData.set({ enabled: false, id: "churchApps" })
                }
            }

            sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId, cloudOnly: cloudOnly[providerId] || false })
        } else {
            if (cloudSyncDataValue.enabled && providerId === cloudSyncDataValue.id) {
                // should remain connected to cloud
                special.update((a) => {
                    a.churchAppsCloudOnly = true
                    return a
                })
                return
            }

            requestMain(Main.PROVIDER_DISCONNECT, { providerId }, (a) => {
                if (!a?.success) return
                providerConnections.update((c) => {
                    c[providerId] = false
                    return c
                })
            })
        }
    }

    function syncContentProvider() {
        contentProviderSync()

        activeShow.set(null)
        activePage.set("show")
        notFound.set({ show: [], bible: [] })
    }

    function updateProvider(id: ContentProviderId, key: string, value: unknown) {
        contentProviderData.update((a) => {
            if (!a[id]) a[id] = {}
            a[id][key] = value
            return a
        })

        saved.set(false)
    }

    // OnStage

    // OnStage team switching: instant for a team with cached tokens, one preselected browser
    // consent for a new team. The list comes from the connected user's confirmed teams.
    const [onstageTeams, setOnstageTeams] = useState<{ id: string; name: string; current: boolean }[]>([])
    const onstageConnected = !!providerConnectionsValue.onstage
    useEffect(() => {
        if (onstageConnected) loadOnStageTeams()
        else setOnstageTeams([])
    }, [onstageConnected])
    async function loadOnStageTeams() {
        setOnstageTeams((await requestMain(Main.ONSTAGE_GET_TEAMS)) || [])
    }
    const onstageTeamOptions = onstageTeams.map((team) => ({ value: team.id, label: team.name }))
    const onstageCurrentTeamId = onstageTeams.find((team) => team.current)?.id || ""
    async function switchOnStageTeam(teamId: string | null) {
        if (!teamId || teamId === onstageCurrentTeamId) return
        const result = await requestMain(Main.ONSTAGE_SWITCH_TEAM, { teamId })
        if (result?.success) {
            syncContentProvider()
            loadOnStageTeams()
        }
    }

    // Remote Control

    function toggleRemoteController(value: boolean) {
        special.update((a) => ({ ...a, remoteController: value }))

        if (value) {
            popupData.set({ remoteController: true })
            activePopup.set("connect")
            if (get(special).remoteControllerId) startRemoteController()
        } else {
            stopRemoteController()
        }
    }

    // OBS Controller

    const [obsWasDisabled, setObsWasDisabled] = useState(() => !get(obsData).enabled)

    const [obsIP, setObsIP] = useState<string | null>(() => get(obsData).ip || "localhost")
    const [obsPort, setObsPort] = useState<number | null>(() => get(obsData).port || 4455)
    useEffect(() => {
        if (obsIP || obsPort) obsData.update((d) => ({ ...d, ip: obsIP as string, port: obsPort as number }))
    }, [obsIP, obsPort])

    return (
        <>
            {servers.map((server, i) => {
                const disabled = server.id === "companion" ? serverDataValue?.companion?.enabled !== true : server.enabledByDefault ? disabledServersValue[server.id] === true : disabledServersValue[server.id] !== false
                const connectionsCount = Object.keys(connectionsData[server.id.toUpperCase()] || {})?.length || 0

                // sin key en el Svelte (posición)
                return (
                    <InputRow key={i}>
                        <Button
                            style={flexButton}
                            disabled={disabled}
                            onClick={() => {
                                popupData.set({ ip, id: server.id })
                                activePopup.set("connect")
                            }}
                        >
                            <span style={rowLabel}>
                                <Icon id={server.icon} size={1.1} />

                                {server.name}

                                {server.id === "companion" ? <span style={smallNote}>WebSocket/REST/OSC/Companion</span> : null}
                                {connectionsCount ? <span style={smallNote}>{connectionsCount}</span> : null}
                            </span>

                            {server.id === "output_stream" && serverDataValue.output_stream?.sendAudio ? (
                                <span style={{ border: "none", display: "flex", alignItems: "center", justifyContent: "end" }}>
                                    <Icon id="volume" />
                                </span>
                            ) : null}
                        </Button>

                        {server.id === "companion" ? <ToggleField label="" checked={serverDataValue?.companion?.enabled === true} onChange={toggleCompanion} /> : <ToggleField label="" checked={server.enabledByDefault ? disabledServersValue[server.id] !== true : disabledServersValue[server.id] === false} onChange={(value) => toggleServer(value, server.id)} />}
                    </InputRow>
                )
            })}

            <InputRow>
                <Button
                    style={flexButton}
                    disabled={!specialValue.remoteController}
                    onClick={() => {
                        popupData.set({ remoteController: true })
                        activePopup.set("connect")
                    }}
                >
                    <span style={rowLabel}>
                        <Icon id="web" size={1.1} />
                        Remote Clicker
                    </span>
                </Button>

                <ToggleField label="" checked={specialValue.remoteController} onChange={toggleRemoteController} />
            </InputRow>

            {(!providerConnectionsValue.churchApps || cloudOnly.churchApps) && !providerConnectionsValue.amazinglife && !providerConnectionsValue.onstage ? (
                <>
                    {/* No provider connected - show connection options */}
                    <Title label="settings.content_provider" icon="list" />

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("churchApps")} style={{ flex: 1 }} icon="login">
                            <T id="settings.connect_to" replace={["ChurchApps"]} />
                        </Button>
                    </InputRow>

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("amazinglife")} style={{ flex: 1 }} icon="login">
                            <T id="settings.connect_to" replace={["APlay"]} />
                        </Button>
                    </InputRow>

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("onstage")} style={{ flex: 1 }} icon="login">
                            <T id="settings.connect_to" replace={["OnStage"]} />
                        </Button>
                    </InputRow>
                </>
            ) : providerConnectionsValue.churchApps && !cloudOnly.churchApps ? (
                <>
                    {/* ChurchApps connected */}
                    <Title label="Content Provider: ChurchApps" icon="list" />

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("churchApps")} className={styles.connected} icon="logout">
                            <T id="settings.disconnect_from" replace={["ChurchApps"]} />
                        </Button>
                        <Button icon="cloud_sync" onClick={syncContentProvider}>
                            <T id="cloud.sync" />
                        </Button>
                        <Button title="<b>popup.sync_categories:</b> settings.sync_categories_tip" icon="options" onClick={() => activePopup.set("sync_categories")} />
                        <Button onClick={() => sendMain(Main.URL, "https://b1.church")} title="B1.Church" white>
                            <Icon id="launch" white />
                        </Button>
                    </InputRow>

                    <SelectField label="Song origin" options={providerOriginOptions} value={contentProviderDataValue.churchApps?.songOrigin || ""} onChange={(value) => updateProvider("churchApps", "songOrigin", value)} />

                    {cloudSyncDataValue.enabled ? <Tip type="warning" value="This is unrelated to the Cloud sync found in 'Files'. This is for the content manager / curriculum." top={20} /> : null}
                </>
            ) : providerConnectionsValue.amazinglife ? (
                <>
                    {/* APlay connected */}
                    <Title label="Content Provider: APlay" icon="list" />

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("amazinglife")} className={styles.connected} icon="logout">
                            <T id="settings.disconnect_from" replace={["APlay"]} />
                        </Button>
                        {/* Nothing to sync yet */}
                        {/* <Button icon="cloud_sync" on:click={syncContentProvider}>
                            <T id="cloud.sync" />
                        </Button> */}
                    </InputRow>
                </>
            ) : providerConnectionsValue.onstage ? (
                <>
                    {/* OnStage connected */}
                    <Title label="Content Provider: OnStage" icon="list" />

                    <InputRow>
                        <Button onClick={() => contentProviderConnect("onstage")} className={styles.connected} icon="logout">
                            <T id="settings.disconnect_from" replace={["OnStage"]} />
                        </Button>
                        <Button icon="cloud_sync" onClick={syncContentProvider}>
                            <T id="cloud.sync" />
                        </Button>
                        <Button onClick={() => sendMain(Main.URL, "https://getonstage.app")} title="OnStage" white>
                            <Icon id="launch" white />
                        </Button>
                    </InputRow>

                    <ToggleField label="settings.auto_sync_startup" checked={contentProviderDataValue.onstage?.autoSync !== false} onChange={(value) => updateProvider("onstage", "autoSync", value)} />

                    {onstageTeams.length > 1 ? <SelectField label="Team" options={onstageTeamOptions} value={onstageCurrentTeamId} onChange={switchOnStageTeam} /> : null}

                    <SelectField label="Song origin" options={providerOriginOptions} value={contentProviderDataValue.onstage?.songOrigin || ""} onChange={(value) => updateProvider("onstage", "songOrigin", value)} />
                </>
            ) : null}

            {/* OBS Studio Controller */}
            <Title label="OBS Studio" icon="record" />

            <InputRow
                arrow={obsDataValue.enabled}
                menu={
                    <div>
                        <TextField label="IP" value={obsIP ?? ""} defaultValue="localhost" placeholder="localhost" onChange={setObsIP} />
                        <NumberField label="settings.port" value={obsPort ?? 0} defaultValue={4455} placeholder="4455" onChange={setObsPort} />
                    </div>
                }
            >
                <ToggleField
                    label="OBS Studio Controller"
                    style={{ width: "100%" }}
                    checked={obsDataValue.enabled}
                    defaultValue={false}
                    onChange={(value) => {
                        if (!value) setObsWasDisabled(true)
                        obsData.update((a) => ({ ...a, enabled: value }))
                    }}
                />
            </InputRow>

            {obsDataValue.enabled && obsWasDisabled ? <Tip value="edit.position: guide_title.drawer > tabs.functions > OBS Studio" top={15} /> : null}
        </>
    )
}
