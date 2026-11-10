import { useEffect, useState, type ReactNode } from "react"
import { get } from "svelte/store"
import BMDStreams from "../../components/drawer/live/BMDStreams.svelte"
import Cameras from "../../components/drawer/live/Cameras.svelte"
import NDIStreams from "../../components/drawer/live/NDIStreams.svelte"
import OMTStreams from "../../components/drawer/live/OMTStreams.svelte"
import Screens from "../../components/drawer/live/Screens.svelte"
import Windows from "../../components/drawer/live/Windows.svelte"
import { activePopup, popupData } from "../../stores"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import styles from "./ChooseMediaInput.module.css"

// Port de components/main/popups/ChooseMediaInput.svelte. Lee: popupData.active || popupData.value (pestaña inicial, cada vez que popupData cambia) y popupData.trigger.
// Escribe: al elegir, trigger(device) o popupData = { ...popupData, value: device }; después activePopup = null.
// Las listas (Cameras, Screens, Windows, NDI, OMT, Blackmagic) siguen siendo Svelte (islas). `streams` (bind en Screens/Windows) sólo se llena con push y nadie lo lee: un array compartido.
interface Device {
    id: string
    name: string
    type: string
    group?: string
}
interface CameraDetail {
    cam: { id: string; name: string; group?: string }
}
interface StreamDetail {
    screen: { id: string; name: string }
}

const TYPES = ["cameras", "screens", "ndi", "omt", "blackmagic"] as const

// `$: if (initialDevice?.type) activeType = …`: sin tipo conocido la pestaña no cambia
function typeFromData(data: { active?: Device; value?: Device }): string | null {
    const type = (data.active || data.value)?.type
    if (!type) return null
    if (type === "camera") return "cameras"
    if (type === "screen") return "screens"
    return type
}

function selectDevice(device: Device) {
    const data = get(popupData)
    if (data.trigger) data.trigger(device)
    else popupData.set({ ...data, value: device })

    activePopup.set(null)
}

function selectCamera({ detail }: CustomEvent<CameraDetail>) {
    const camera = detail.cam
    selectDevice({ id: camera.id, name: camera.name, group: camera.group, type: "camera" })
}

const selectStream = (type: string) => (event: CustomEvent<StreamDetail>) => {
    const screen = event.detail.screen
    selectDevice({ id: screen.id, name: screen.name, type })
}

export function ChooseMediaInput() {
    const [activeType, setActiveType] = useState<string>(() => typeFromData(get(popupData)) ?? "cameras")
    const data = useStore(popupData)
    const [streams] = useState<MediaStream[]>(() => [])

    // cada `popupData.set` reevalúa el tipo, como el `$:` del Svelte
    useEffect(() => {
        const type = typeFromData(data)
        if (type) setActiveType(type)
    }, [data])

    const tab = (type: (typeof TYPES)[number], icon: string, size: number, label: ReactNode) => (
        <Button key={type} style={{ flex: 1 }} isActive={activeType === type} onClick={() => setActiveType(type)}>
            <Icon size={size} id={icon} white />
            <p>{label}</p>
        </Button>
    )

    return (
        <div className={styles.chooseInputWrapper}>
            <div className={styles.tabs}>
                {tab("cameras", "camera", 1.2, <T id="live.cameras" />)}
                {tab("screens", "screen", 1.2, <T id="live.screens" />)}
                {tab("ndi", "ndi", 1.1, "NDI")}
                {tab("omt", "omt", 1.2, "OMT")}
                {tab("blackmagic", "blackmagic", 1.2, "Blackmagic")}
            </div>

            <div className={styles.devices}>
                {activeType === "cameras" ? <SvelteIsland key="cameras" component={Cameras} props={{ showPlayOnHover: false }} events={{ click: selectCamera }} /> : null}
                {activeType === "screens" ? (
                    <>
                        <SvelteIsland key="screens" component={Screens} props={{ streams: streams }} events={{ click: selectStream("screen") }} />
                        <div style={{ width: "100%", height: "10px" }} />
                        <SvelteIsland key="windows" component={Windows} props={{ streams: streams }} events={{ click: selectStream("screen") }} />
                    </>
                ) : null}
                {activeType === "ndi" ? <SvelteIsland key="ndi" component={NDIStreams} events={{ click: selectStream("ndi") }} /> : null}
                {activeType === "omt" ? <SvelteIsland key="omt" component={OMTStreams} events={{ click: selectStream("omt") }} /> : null}
                {activeType === "blackmagic" ? <SvelteIsland key="blackmagic" component={BMDStreams} events={{ click: selectStream("blackmagic") }} /> : null}
            </div>
        </div>
    )
}
