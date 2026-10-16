// ----- FreeShow -----
// Panel de Hardware (Bloque 12): MIDI, NDI y Blackmagic DeckLink.
//
// Consulta los comandos de Rust y muestra el estado de cada subsistema. Los
// runtimes nativos (NDI/DeckLink) pueden no estar instalados, en cuyo caso los
// comandos devuelven `available: false` con un mensaje descriptivo.

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Cable, Radio, Video } from "lucide-react"
import {
    blackmagicDevices,
    blackmagicStatus,
    getMidiInputs,
    getMidiOutputs,
    ndiSources,
    ndiStatus,
    type BlackmagicDevice,
    type BlackmagicStatus,
    type MidiPort,
    type NdiSource,
    type NdiStatus,
} from "@/IPC/system"
import { cn } from "@/lib/utils"

function StatusDot({ available }: { available: boolean }) {
    return (
        <span className={cn("size-2 rounded-full", available ? "bg-emerald-400" : "bg-zinc-600")} />
    )
}

function Section({
    icon: Icon,
    title,
    onRefresh,
    children,
}: {
    icon: typeof Cable
    title: string
    onRefresh?: () => void
    children: React.ReactNode
}) {
    return (
        <section className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                    <Icon className="size-3.5" />
                    {title}
                </span>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        title="Actualizar"
                        className="flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                        <RefreshCw className="size-3.5" />
                    </button>
                )}
            </div>
            {children}
        </section>
    )
}

function List({ items, empty }: { items: string[]; empty: string }) {
    if (!items.length) return <p className="text-xs text-zinc-600">{empty}</p>
    return (
        <ul className="flex flex-col gap-0.5">
            {items.map((item, index) => (
                <li key={`${item}-${index}`} className="truncate rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800/60">
                    {item}
                </li>
            ))}
        </ul>
    )
}

export default function HardwarePanel() {
    const [inputs, setInputs] = useState<MidiPort[]>([])
    const [outputs, setOutputs] = useState<MidiPort[]>([])
    const [ndi, setNdi] = useState<NdiStatus | null>(null)
    const [sources, setSources] = useState<NdiSource[]>([])
    const [bm, setBm] = useState<BlackmagicStatus | null>(null)
    const [devices, setDevices] = useState<BlackmagicDevice[]>([])

    const refreshMidi = useCallback(() => {
        void getMidiInputs().then(setInputs)
        void getMidiOutputs().then(setOutputs)
    }, [])

    const refreshNdi = useCallback(() => {
        void ndiStatus().then(setNdi)
        void ndiSources().then(setSources)
    }, [])

    const refreshBlackmagic = useCallback(() => {
        void blackmagicStatus().then(setBm)
        void blackmagicDevices().then(setDevices)
    }, [])

    useEffect(() => {
        refreshMidi()
        refreshNdi()
        refreshBlackmagic()
    }, [refreshMidi, refreshNdi, refreshBlackmagic])

    return (
        <div className="flex flex-col gap-3">
            <Section icon={Cable} title="MIDI" onRefresh={refreshMidi}>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="mb-1 text-[10px] tracking-wider text-zinc-600 uppercase">Entradas</p>
                        <List items={inputs.map((port) => port.name)} empty="Sin entradas MIDI" />
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] tracking-wider text-zinc-600 uppercase">Salidas</p>
                        <List items={outputs.map((port) => port.name)} empty="Sin salidas MIDI" />
                    </div>
                </div>
            </Section>

            <Section icon={Radio} title="NDI" onRefresh={refreshNdi}>
                <div className="flex items-center gap-2">
                    <StatusDot available={!!ndi?.available} />
                    <span className="text-xs text-zinc-400">{ndi?.message ?? "Comprobando…"}</span>
                </div>
                {ndi?.library && <p className="truncate text-[10px] text-zinc-600">{ndi.library}</p>}
                <List items={sources.map((source) => source.name || source.url)} empty="Sin fuentes NDI" />
            </Section>

            <Section icon={Video} title="Blackmagic DeckLink" onRefresh={refreshBlackmagic}>
                <div className="flex items-center gap-2">
                    <StatusDot available={!!bm?.available} />
                    <span className="text-xs text-zinc-400">{bm?.message ?? "Comprobando…"}</span>
                </div>
                {bm?.library && <p className="truncate text-[10px] text-zinc-600">{bm.library}</p>}
                <List items={devices.map((device) => `[${device.index}] ${device.name}`)} empty="Sin tarjetas DeckLink" />
            </Section>
        </div>
    )
}
