import type { AudioRoutingConfig, AudioRoutingConnection } from "../../../../types/AudioRouting"

// Lógica pura del ruteo de audio, portada de components/settings/tabs/AudioRouting.svelte (F24.13b).

export type PortType = "in" | "out" | "sidechain"
export type ColumnType = "input" | "channel" | "output"

export interface AudioDevice {
    value: string
    label: string
    channels: number
}

export interface RenderedLine {
    fromId: string
    toId: string
    channelIndex: number
    fromChannelIndex?: number
    toChannelIndex?: number
    type?: "audio" | "sidechain"
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface HoveredPort {
    nodeId: string
    portType: PortType
    channelIndex?: number
}

export const PARENT_PREFIX_MAP: Record<string, { parentId: string; prefix: string }> = {
    playlist_sub_: { parentId: "playlists_default", prefix: "playlist_sub_" },
    mic_sub_: { parentId: "mic_default", prefix: "mic_sub_" },
    drawer_sub_: { parentId: "drawer_audio", prefix: "drawer_sub_" },
    speaker_sub_: { parentId: "speaker_default", prefix: "speaker_sub_" },
    network_sub_: { parentId: "network_default", prefix: "network_sub_" },
    output_win_sub_: { parentId: "output_window", prefix: "output_win_sub_" }
}

export const FIXED_INPUTS = [
    { id: "drawer_audio", nameKey: "tabs.audio", type: "drawer_audio" },
    { id: "playlists_default", nameKey: "audio.playlists", type: "playlist" },
    { id: "mic_default", nameKey: "live.microphones", type: "mic" },
    { id: "metronome", nameKey: "audio.metronome", type: "metronome" },
    { id: "desktop_default", nameKey: "audio.desktop_audio", type: "desktop_audio" },
    { id: "output_window", nameKey: "settings.display_settings", type: "output_window" }
]

export const FIXED_OUTPUTS = [
    { id: "speaker_default", nameKey: "audio.speakers", type: "speaker" },
    { id: "network_default", nameKey: "settings.network_output", type: "network" },
    { id: "icecast", nameKey: "", type: "icecast" }
]

export const nodeHue = (index: number) => (275 + (index >= 0 ? index : 0) * 6) % 360

export function connectionPath(line: RenderedLine): string {
    const isSidechain = line.type === "sidechain"
    const isBackward = isSidechain && line.x1 >= line.x2
    const dy = Math.abs(line.y2 - line.y1)
    const dx = isBackward ? Math.max(120, dy * 0.7) : Math.max(20, Math.abs(line.x2 - line.x1) / 2)
    const c1x = line.x1 + dx
    const c2x = line.x2 - dx
    return `M ${line.x1} ${line.y1} C ${c1x} ${line.y1}, ${c2x} ${line.y2}, ${line.x2} ${line.y2}`
}

export function dragPath(from: { x: number; y: number }, current: { x: number; y: number }, dragStartPortType: PortType | null): string {
    const dx = Math.max(20, Math.abs(current.x - from.x) / 2)
    const sign = dragStartPortType === "out" ? 1 : -1
    return `M ${from.x} ${from.y} C ${from.x + dx * sign} ${from.y}, ${current.x - dx * sign} ${current.y}, ${current.x} ${current.y}`
}

export function lineKey(line: RenderedLine): string {
    return line.fromId + "-" + line.toId + "-" + (line.fromChannelIndex ?? line.channelIndex ?? 0) + "-" + (line.toChannelIndex ?? line.channelIndex ?? 0) + "-" + (line.type || "audio")
}

export function isLineConnectedToPort(line: RenderedLine, port: HoveredPort | null): boolean {
    if (!port) return false
    if (port.portType === "out") {
        if (line.fromId !== port.nodeId) return false
        return port.channelIndex !== undefined ? (line.fromChannelIndex ?? line.channelIndex ?? 0) === port.channelIndex : true
    }
    if (port.portType === "sidechain") return line.toId === port.nodeId && line.type === "sidechain"
    if (port.portType === "in") {
        if (line.toId !== port.nodeId || line.type === "sidechain") return false
        return port.channelIndex !== undefined ? (line.channelIndex ?? 0) === port.channelIndex : true
    }
    return false
}

export interface ValidationContext {
    channelIds: string[]
    dragStartPortType: PortType | null
    hoverTargetPortType: PortType | null
}

export function isValidConnection(fromId: string, toId: string, ctx: ValidationContext): { valid: boolean; from: string; to: string } {
    const isInput = (id: string) => FIXED_INPUTS.some((i) => i.id === id) || id.startsWith("playlist_sub_") || id.startsWith("mic_sub_") || id.startsWith("output_win_sub_")
    const isChannel = (id: string) => ctx.channelIds.includes(id)
    const isOutput = (id: string) => FIXED_OUTPUTS.some((o) => o.id === id) || id.startsWith("speaker_sub_") || id.startsWith("network_sub_")

    // Channel-to-channel sidechain (cannot connect to self)
    if (isChannel(fromId) && isChannel(toId) && fromId !== toId) {
        const isSidechain = ctx.dragStartPortType === "sidechain" || ctx.hoverTargetPortType === "sidechain"
        if (isSidechain) {
            // If dragging from sidechain port, target channel is the source (from), dragging channel is target (to)
            if (ctx.dragStartPortType === "sidechain") return { valid: true, from: toId, to: fromId }
            // Otherwise dragging from channel out to channel sidechain port
            return { valid: true, from: fromId, to: toId }
        }
    }

    if ((isInput(fromId) && isChannel(toId)) || (isChannel(fromId) && isOutput(toId))) {
        return { valid: true, from: fromId, to: toId }
    }
    if ((isOutput(fromId) && isChannel(toId)) || (isChannel(fromId) && isInput(toId))) {
        return { valid: true, from: toId, to: fromId }
    }
    return { valid: false, from: fromId, to: toId }
}

export interface DropContext {
    fromId: string
    toId: string
    isSidechain: boolean
    dragStartId: string
    dragStartChannelIndex: number | undefined
    hoverTargetId: string | null
    // `dataset.chIndex` del puerto bajo el mouse
    hoverChIndex: string | undefined
    availableInputs: AudioDevice[]
    availableOutputs: AudioDevice[]
    notify: (message: string) => void
}

const getConnFromCh = (conn: AudioRoutingConnection) => conn.fromChannelIndex ?? (conn.from?.startsWith("mic_sub_") ? conn.channelIndex : undefined)
const getConnToCh = (conn: AudioRoutingConnection) => conn.toChannelIndex ?? (conn.to?.startsWith("speaker_sub_") ? conn.channelIndex : undefined)

function isRelatedInput(connFrom: string, id: string) {
    if (connFrom === id) return true
    for (const [, { parentId, prefix }] of Object.entries(PARENT_PREFIX_MAP)) {
        if (connFrom.startsWith(prefix) && id === parentId) return true
        if (id.startsWith(prefix) && connFrom === parentId) return true
    }
    return false
}

// Cuerpo del `updateConfig` de handleGlobalMouseUp: conectar / desconectar al soltar un arrastre. Muta `c`.
export function applyDrop(c: AudioRoutingConfig, x: DropContext): void {
    const { fromId, toId, isSidechain, dragStartId, hoverTargetId } = x
    const connType = isSidechain ? "sidechain" : "audio"
    const oppositeType = isSidechain ? "audio" : "sidechain"

    const isMicSub = fromId.startsWith("mic_sub_")
    const micChCount = isMicSub ? x.availableInputs.find((m) => m.value === fromId)?.channels || 2 : 0
    const sourceChIndex = dragStartId === fromId ? x.dragStartChannelIndex : hoverTargetId === fromId && x.hoverChIndex !== undefined ? parseInt(x.hoverChIndex) : undefined

    const isSpeakerSub = toId.startsWith("speaker_sub_")
    const deviceId = isSpeakerSub ? toId.replace("speaker_sub_", "") : ""
    const speakerChCount = x.availableOutputs.find((s) => s.value === deviceId)?.channels || 2
    const targetChIndex = dragStartId === toId ? x.dragStartChannelIndex : hoverTargetId === toId && x.hoverChIndex !== undefined ? parseInt(x.hoverChIndex) : undefined

    if (isSidechain) {
        if (fromId === toId) return
        if (c.connections.some((conn) => conn.from === toId && conn.to === fromId && conn.type === "sidechain")) {
            x.notify("Cannot create circular sidechain.")
            return
        }
    }

    // Multi-channel mic dropped on card (connect/toggle all channels)
    if (isMicSub && micChCount > 1 && sourceChIndex === undefined) {
        const activeConns = c.connections.filter((conn) => conn.from === fromId && conn.to === toId && (conn.type || "audio") === connType)
        if (activeConns.length >= micChCount) {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId && (conn.type || "audio") === connType))
        } else {
            let addedAny = false
            for (let ch = 0; ch < micChCount; ch++) {
                const hasConflict = c.connections.some((conn) => conn.to === toId && (conn.type || "audio") === oppositeType && isRelatedInput(conn.from, fromId) && (conn.from === fromId ? (getConnFromCh(conn) ?? 0) === ch : true))
                if (hasConflict) continue

                if (!c.connections.some((conn) => conn.from === fromId && conn.to === toId && (conn.type || "audio") === connType && (getConnFromCh(conn) ?? 0) === ch)) {
                    c.connections.push({ from: fromId, to: toId, type: connType, channelIndex: ch, fromChannelIndex: ch })
                    addedAny = true
                }
            }
            if (!addedAny && activeConns.length === 0) {
                x.notify(`This source already has a ${oppositeType === "sidechain" ? "sidechain" : "regular audio"} connection to this channel.`)
            }
        }
        return
    }

    // Multi-channel speaker dropped on card (audio only)
    if (!isSidechain && isSpeakerSub && speakerChCount > 1 && targetChIndex === undefined) {
        const activeConns = c.connections.filter((conn) => conn.from === fromId && conn.to === toId && conn.type !== "sidechain")
        if (activeConns.length >= speakerChCount) {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === toId && conn.type !== "sidechain"))
        } else {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === "speaker_default"))
            for (let ch = 0; ch < speakerChCount; ch++) {
                if (!c.connections.some((conn) => conn.from === fromId && conn.to === toId && conn.type !== "sidechain" && (getConnToCh(conn) ?? 0) === ch)) {
                    c.connections.push({ from: fromId, to: toId, channelIndex: ch, toChannelIndex: ch })
                }
            }
        }
        return
    }

    // Specific channel pin or single-channel node
    const sCh = sourceChIndex ?? 0
    const tCh = targetChIndex ?? 0
    const existingIndex = c.connections.findIndex((conn) => {
        if (conn.from !== fromId || conn.to !== toId || (conn.type || "audio") !== connType) return false
        if (isMicSub && sourceChIndex !== undefined && (getConnFromCh(conn) ?? 0) !== sCh) return false
        if (isSpeakerSub && (getConnToCh(conn) ?? 0) !== tCh) return false
        return true
    })

    if (existingIndex !== -1) {
        c.connections.splice(existingIndex, 1)
        return
    }

    const hasConflict = c.connections.some((conn) => {
        if (conn.to !== toId || (conn.type || "audio") !== oppositeType) return false
        if (!isRelatedInput(conn.from, fromId)) return false
        if (isMicSub && sourceChIndex !== undefined && conn.from === fromId) {
            return (getConnFromCh(conn) ?? 0) === sCh
        }
        return true
    })

    if (hasConflict) {
        x.notify(`This source channel already has a ${oppositeType === "sidechain" ? "sidechain" : "regular audio"} connection to this channel.`)
        return
    }

    if (!isSidechain) {
        for (const [, { parentId, prefix }] of Object.entries(PARENT_PREFIX_MAP)) {
            if (fromId.startsWith(prefix)) {
                c.connections = c.connections.filter((conn) => !(conn.from === parentId && conn.to === toId && conn.type !== "sidechain"))
            } else if (fromId === parentId) {
                c.connections = c.connections.filter((conn) => !(conn.from.startsWith(prefix) && conn.to === toId && conn.type !== "sidechain"))
            }
            if (toId.startsWith(prefix)) {
                c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === parentId && conn.type !== "sidechain"))
            } else if (toId === parentId) {
                c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to.startsWith(prefix) && conn.type !== "sidechain"))
            }
        }

        if (isSpeakerSub) {
            c.connections = c.connections.filter((conn) => !(conn.from === fromId && conn.to === "speaker_default"))
        }
    }

    c.connections.push({
        from: fromId,
        to: toId,
        type: connType,
        ...(isSpeakerSub ? { channelIndex: tCh, toChannelIndex: tCh } : {}),
        ...(isMicSub ? { channelIndex: sCh, fromChannelIndex: sCh } : {})
    })
}

// Clic derecho en un puerto: qué conexiones se quedan
export function keepAfterPortContext(conn: AudioRoutingConnection, nodeId: string, portType: PortType, channelIndex: number): boolean {
    if (portType === "sidechain") return !(conn.to === nodeId && conn.type === "sidechain")
    if (portType === "in") {
        if (conn.to !== nodeId) return true
        if (conn.type === "sidechain") return true
        return nodeId.startsWith("speaker_sub_") ? (conn.channelIndex ?? 0) !== channelIndex : false
    }
    if (portType === "out") {
        if (conn.from !== nodeId) return true
        return nodeId.startsWith("mic_sub_") ? (conn.fromChannelIndex ?? conn.channelIndex ?? 0) !== channelIndex : false
    }
    return conn.from !== nodeId
}

// ¿Es válido soltar sobre este nodo? (mismo criterio que handleNodeMouseEnter)
export function isValidHoverTarget(nodeId: string, columnType: ColumnType, dragStartType: ColumnType | null, dragStartPortType: PortType | null): boolean {
    if (dragStartType === "input" && columnType === "channel") return true
    if (dragStartType === "output" && columnType === "channel") return true
    if (dragStartType === "channel") {
        if (dragStartPortType === "in" && columnType === "input" && nodeId !== "output_window") return true
        if (dragStartPortType === "sidechain" && (columnType === "channel" || (columnType === "input" && nodeId !== "output_window"))) return true
        if (dragStartPortType === "out") {
            if (columnType === "output" && nodeId !== "network_default") return true
            if (columnType === "channel") return true
        }
    }
    return false
}
