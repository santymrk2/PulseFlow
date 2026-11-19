import qrcode from "qrcode-generator"
import { useEffect, useState, type MouseEvent } from "react"
import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { Tip } from "../../react/main/Tip"
import { sendMain } from "../../shared/core/ipc/main"
import { cn } from "../../shared/core/lib/utils"
import { activePopup, maxConnections, os, outputs, popupData, ports, serverData, special } from "../../shared/core/stores"
import { startRemoteController, stopRemoteController } from "../../app/wiring/remoteController"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { Link } from "../../shared/ui/kit/link/Link"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"
import styles from "./Connect.module.css"

// Port de components/main/popups/Connect.svelte. Lee (al montar): popupData.id/ip/remoteController y special.remoteControllerId; después ports, os, special, serverData, outputs y maxConnections.
// Escribe: popupData = {} al montar; ports[id]; serverData[id][clave] (+ Main.SERVER_DATA con el store completo; la contraseña de companion reinicia el WebSocket); maxConnections;
// special.connectionHostname; y, sin id de control remoto, un id nuevo en special.remoteControllerId (+ startRemoteController; stopRemoteController del anterior al regenerar).
// Un clic en un link cierra el popup. Tip usa el port React. Los NumberField pueden emitir null: se ignora (guarda defensiva).
type PortId = "remote" | "stage" | "controller" | "output_stream" | "companion"

const DEFAULT_PORTS: Record<PortId, number> = { remote: 5510, stage: 5511, controller: 5512, output_stream: 5513, companion: 5505 }
const RESERVED_PORTS: Record<string, number[]> = { nowPlaying: [5502], WebSocket: [5505], REST: [5506], companion: [5505, 5506], remote: [5510], stage: [5511], controller: [5512], output_stream: [5513] }

function newRemoteId() {
    // a string of 6 random characters
    return Math.random().toString(36).substring(2, 8)
}

export function Connect() {
    const [{ id, ip, remoteController }] = useState(() => {
        const data = get(popupData)
        return { id: data.id as PortId, ip: data.ip as string, remoteController: data.remoteController as boolean }
    })
    const [controllerId, setControllerId] = useState<string | undefined>(() => get(special).remoteControllerId)
    const [options, setOptions] = useState(false)
    const [qrImg, setQrImg] = useState("")

    const specialValue = useStore(special)
    const portsValue = useStore(ports)
    const serverDataValue = useStore(serverData)
    const osValue = useStore(os)
    const outputsValue = useStore(outputs)
    const maxConnectionsValue = useStore(maxConnections)

    function setRemoteId() {
        if (controllerId) stopRemoteController(controllerId)

        const newId = newRemoteId()
        setControllerId(newId)
        special.update((a) => ({ ...a, remoteControllerId: newId }))

        startRemoteController(newId)
    }

    useEffect(() => {
        if (!controllerId) setRemoteId()
        popupData.set({})
    }, [])

    const useHostname = specialValue.connectionHostname
    const port = portsValue[id] || DEFAULT_PORTS[id]
    const hostname = `${osValue.name.toLowerCase()}${osValue.platform === "win32" ? ".local" : ""}`
    const url = remoteController ? `https://freeshow.net/control?id=${controllerId}` : `http://${useHostname ? hostname : ip}:${port}`

    // El QR se regenera sólo cuando cambia la url (con las mismas excepciones que el Svelte)
    useEffect(() => {
        if (!url) return
        if (remoteController ? !controllerId : (!useHostname && ip === "localhost") || id === "companion") return

        const qr = qrcode(0, "L")
        qr.addData(url)
        qr.make()
        setQrImg(qr.createImgTag(8, 8))
    }, [url])

    function mouseup(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest("a")) activePopup.set(null)
    }

    const isReserved = !RESERVED_PORTS[id]?.includes(port) && Object.values(RESERVED_PORTS).flat().includes(port)

    function restartCompanion() {
        if (!get(serverData)?.companion?.enabled) return
        sendMain(Main.WEBSOCKET_START, { port: get(ports).companion || 5505, password: get(serverData)?.companion?.password })
    }

    function updatePort(value: number | null) {
        if (value === null) return

        ports.update((a) => {
            a[id] = value
            return a
        })

        if (id === "companion") restartCompanion()
    }

    const outputsList = sortByName(keysToID(clone(outputsValue)).filter((a) => a.enabled === true)).map((a) => ({ label: a.name, value: a.id }))

    function updateData(value: string | boolean | null, key: string) {
        serverData.update((a) => {
            if (!a[id]) a[id] = {}
            a[id][key] = value

            return a
        })

        sendMain(Main.SERVER_DATA, get(serverData))

        if (id === "companion" && key === "password") restartCompanion()
    }

    function toggleAudio(value: boolean) {
        updateData(value, "sendAudio")
        if (value) AudioAnalyser.recorderActivate()
    }

    function updateSpecial(key: string, value: boolean) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    const password = id === "remote" ? serverDataValue?.remote?.password : id === "companion" ? serverDataValue?.companion?.password : undefined

    return (
        <>
            {remoteController ? (
                <Button className="popup-options" icon="reset" iconSize={1.1} title="actions.reset" onClick={setRemoteId} white />
            ) : (
                <>
                    <Button className={cn("popup-options", options && "active")} icon="options" iconSize={1.3} title={options ? "actions.close" : "create_show.more_options"} onClick={() => setOptions(!options)} white />

                    <Button className="popup-reset" icon="help" iconSize={1.1} title="titlebar.help" onClick={() => sendMain(Main.URL, "https://freeshow.app/docs/connecting")} white />
                </>
            )}

            {options ? (
                <>
                    <div className={cn(styles.box, styles.reserved, isReserved && styles.isReserved)}>
                        <NumberField label="settings.port" value={port} defaultValue={RESERVED_PORTS[id]?.[0] ?? null} min={1025} max={65535} onChange={updatePort} />
                    </div>

                    {id === "remote" || id === "companion" ? <TextField label="remote.password" value={serverDataValue?.[id]?.password || ""} onChange={(value) => updateData(value || "", "password")} /> : null}
                    {id === "output_stream" ? (
                        <>
                            <SelectField label="midi.output" options={outputsList} value={serverDataValue?.output_stream?.outputId || ""} onChange={(value) => updateData(value ?? "", "outputId")} allowEmpty />

                            {serverDataValue?.output_stream?.sendAudio ? <ToggleField label="preview.audio" checked={serverDataValue?.output_stream?.sendAudio} defaultValue={false} onChange={toggleAudio} /> : null}
                        </>
                    ) : null}

                    {id !== "companion" ? (
                        <>
                            <hr className={styles.hr} />

                            <NumberField label="settings.max_connections" value={maxConnectionsValue} max={100} onChange={(value) => value !== null && maxConnections.set(value)} />
                            <ToggleField label="settings.use_hostname" checked={specialValue.connectionHostname} defaultValue={false} onChange={(checked) => updateSpecial("connectionHostname", checked)} />
                        </>
                    ) : null}
                </>
            ) : (
                <div className={styles.box} onMouseUp={mouseup}>
                    {id === "companion" ? (
                        <>
                            <Link url="https://freeshow.app/api">
                                API Docs
                                <Icon id="launch" white />
                            </Link>
                            <Link url="https://freeshow.app/docs/companion">
                                Bitfocus Companion Connection
                                <Icon id="launch" white />
                            </Link>
                        </>
                    ) : (
                        <>
                            <p>
                                <T id="settings.connect" />:
                            </p>
                            <Link url={url}>
                                {url}
                                <Icon id="launch" white />
                            </Link>

                            <br />

                            {ip === "localhost" ? (
                                <p style={{ textAlign: "start" }}>
                                    <T id="error.ip" />
                                </p>
                            ) : qrImg ? (
                                <>
                                    <p style={{ marginBottom: "5px" }}>
                                        <T id="settings.connect_qr" />:
                                    </p>
                                    <span dangerouslySetInnerHTML={{ __html: qrImg }} />
                                </>
                            ) : null}
                        </>
                    )}

                    {password ? (
                        <p style={{ paddingTop: "10px", fontSize: "0.9em" }}>
                            <T id="remote.password" />: <b>{password}</b>
                        </p>
                    ) : remoteController ? (
                        <Tip value="With this you don't need to connect to the same router." top={15} />
                    ) : null}
                </div>
            )}
        </>
    )
}
