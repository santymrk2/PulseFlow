import type { CSSProperties, MouseEvent } from "react"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { cn } from "../../../shared/core/lib/utils"
import { activePopup, playingAudio, popupData, special } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { AudioMeter } from "../../drawer/audio/AudioMeter"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import type { ColumnType, PortType } from "./routingLogic"
import styles from "./AudioRoutingNode.module.css"

// Port de components/settings/tabs/AudioRoutingNode.svelte (F24.13b). AudioMeter es un port React directo (F24.24b).
export interface AudioRoutingNodeProps {
    id: string
    name: string
    type: string
    icon?: string | null
    color?: string
    autoColor?: string
    nodeType: ColumnType

    isSubNode?: boolean
    isExpanded?: boolean
    hasSubNodes?: boolean
    channels?: number
    isEnabled?: boolean
    isMuted?: boolean
    hasEffects?: boolean
    hasInputConnection?: boolean

    onToggleEnabled?: (enabled: boolean) => void

    hoverTargetId?: string | null
    isConnecting?: boolean
    dragStartId?: string | null
    dragStartType?: string | null
    dragStartPortType?: PortType | null

    onToggleExpand?: () => void
    onMouseDown: (e: MouseEvent<HTMLElement>, portType: PortType, chIdx?: number) => void
    onMouseEnter: (e: MouseEvent<HTMLElement>) => void
    onMouseLeave: () => void
    onMouseEnterPort?: (e: MouseEvent<HTMLElement>, portType?: PortType, chIdx?: number) => void
    onMouseLeavePort?: () => void
    onHoverPort?: (e: MouseEvent<HTMLElement>, portType: PortType, chIdx?: number) => void
    onHoverPortEnd?: () => void
    onPortContextMenu?: (e: MouseEvent<HTMLElement>, portType: PortType, chIdx?: number) => void
}

const NODE_ICONS: Record<string, string> = {
    drawer_audio: "audio",
    playlist: "playlist",
    mic: "mic",
    metronome: "timer",
    desktop_audio: "volume",
    output_window: "display_settings",
    speaker: "volume",
    icecast: "cloud"
}

// Clases literales (las busca AudioRouting con querySelector/closest) + las del módulo
const portClass = (...names: string[]) =>
    cn(
        names,
        names.map((n) => styles[n])
    )

export function AudioRoutingNode({
    id,
    name,
    type,
    icon = null,
    color,
    autoColor,
    nodeType,
    isSubNode = false,
    isExpanded = false,
    hasSubNodes = false,
    channels = 0,
    isEnabled = true,
    isMuted = false,
    hasEffects = false,
    hasInputConnection = true,
    onToggleEnabled,
    hoverTargetId = null,
    isConnecting = false,
    dragStartId = null,
    dragStartType = null,
    dragStartPortType = null,
    onToggleExpand = () => {},
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    onMouseEnterPort = () => {},
    onMouseLeavePort = () => {},
    onHoverPort = () => {},
    onHoverPortEnd = () => {},
    onPortContextMenu = () => {}
}: AudioRoutingNodeProps) {
    const playing = useStore(playingAudio)
    const specialValue = useStore(special)

    const getIcon = (nodeTypeKey: string): string => icon || NODE_ICONS[nodeTypeKey] || ""

    const activeColor = color || autoColor

    const isChannel = nodeType === "channel"
    const isInputCol = nodeType === "input"
    const isOutputCol = nodeType === "output"
    const isStartChannel = dragStartType === "channel"

    const hasInPort = nodeType !== "input" && (type !== "network" || isSubNode) && (!isSubNode || nodeType === "output")
    const hasOutPort = nodeType !== "output" && (type !== "output_window" || isSubNode)

    const hasValidPort = (dragStartType === "input" && hasInPort) || (dragStartType === "output" && hasOutPort) || (isStartChannel && ((dragStartPortType === "in" && hasOutPort) || (dragStartPortType === "out" && (hasInPort || (isChannel && id !== dragStartId))) || (dragStartPortType === "sidechain" && ((isChannel && id !== dragStartId) || isInputCol) && hasOutPort)))
    const isValidHover = isConnecting && id !== dragStartId && ((dragStartType === "input" && isChannel) || (dragStartType === "output" && isChannel) || (isStartChannel && ((dragStartPortType === "in" && isInputCol) || (dragStartPortType === "out" && (isOutputCol || isChannel)) || (dragStartPortType === "sidechain" && (isChannel || isInputCol)))))

    // mouseenter/mouseleave/mousedown/contextmenu de un puerto, igual que los cuatro on: del Svelte
    const portEvents = (portType: PortType, chIdx?: number) => ({
        onMouseEnter: (e: MouseEvent<HTMLElement>) => {
            onMouseEnterPort(e, portType, chIdx)
            onHoverPort(e, portType, chIdx)
        },
        onMouseLeave: () => {
            onMouseLeavePort()
            onHoverPortEnd()
        },
        onMouseDown: (e: MouseEvent<HTMLElement>) => onMouseDown(e, portType, chIdx),
        onContextMenu: (e: MouseEvent<HTMLElement>) => onPortContextMenu(e, portType, chIdx)
    })

    const cardStyle: CSSProperties = {}
    if (activeColor) (cardStyle as Record<string, string>)["--port-color"] = activeColor
    if (channels > 1) cardStyle.minHeight = `${channels * 30}px`

    const multiLabel = (chIdx: number) => `${translateText("midi.channel")} ${chIdx + 1}`

    return (
        <div
            id={id}
            className={cn("node-card", styles["node-card"], isChannel ? `context #audio_channel${id === "main" ? "_main" : ""}` : type, isChannel && styles["channel-card"], isSubNode && styles["sub-card"], hoverTargetId === id && hasValidPort && styles["hover-valid"], !isEnabled && (!isInputCol || type === "output_window") && (!isOutputCol || type === "network") && styles.disabled, isConnecting && !isValidHover && id !== dragStartId && styles.invalid)}
            data-node-id={id}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={cardStyle}
        >
            {nodeType !== "input" && type !== "network" && !isSubNode ? (
                <>
                    {/* placed first so ::after area is under the main port */}
                    {isChannel ? <div className={portClass("port", "port-sidechain")} data-title={translateText("audio.sidechain")} {...portEvents("sidechain")}></div> : null}

                    <div className={cn(portClass("port", "port-in"), isChannel && styles.hasSidechainPort)} {...portEvents("in")}></div>
                </>
            ) : null}

            {isSubNode && nodeType === "output" && channels > 1 ? (
                <div className={styles["ports-column-in"]}>
                    {Array.from({ length: channels }, (_, chIdx) => (
                        <div key={chIdx} className={portClass("port", "port-in", "port-multi")} data-ch-index={chIdx} data-port-type="in" data-title={multiLabel(chIdx)} {...portEvents("in", chIdx)}></div>
                    ))}
                </div>
            ) : isSubNode && nodeType === "output" ? (
                <div className={portClass("port", "port-in")} data-port-type="in" {...portEvents("in")}></div>
            ) : null}

            <div className={styles["card-content"]}>
                {hasSubNodes && type !== "output_window" && type !== "network" ? <Button variant="outline" icon={isExpanded ? "expand" : "next"} style={{ padding: "5px" }} onClick={() => onToggleExpand()} /> : null}

                {isChannel ? (
                    <>
                        <span className={styles["card-name"]} data-title={name}>
                            {name}

                            {icon ? <Icon id={icon} size={0.7} style={{ marginLeft: "2px", opacity: 0.2 }} white /> : null}
                        </span>

                        {isMuted ? <Icon id="muted" title={translateText("actions.muted")} size={0.9} style={{ opacity: 0.7 }} white /> : null}
                        {hasEffects ? <Icon id="equalizer" title={translateText("tabs.effects")} size={0.9} style={{ opacity: 0.6 }} white /> : null}
                    </>
                ) : (
                    <>
                        {!hasSubNodes ? <Icon id={getIcon(type)} size={isSubNode ? 0.9 : 1.1} color={color} white /> : null}
                        <span className={cn(styles["card-name"], isSubNode && styles["sub-name"])} data-title={name} dangerouslySetInnerHTML={{ __html: name }} />
                    </>
                )}

                {type === "mic" && isSubNode ? (
                    <ToggleField
                        label=""
                        checked={!!playing[id]}
                        onChange={() => {
                            const micId = id.startsWith("mic_sub_") ? id.slice(8) : id
                            AudioMicrophone.start(micId, { name }, { pauseIfPlaying: true })
                        }}
                        small
                    />
                ) : null}

                {type === "icecast" && specialValue.icecast?.enabled !== undefined ? (
                    <ToggleField
                        label=""
                        checked={specialValue.icecast?.enabled ?? true}
                        onChange={() => {
                            special.update((a) => {
                                if (!a.icecast) a.icecast = {}
                                a.icecast.enabled = !a.icecast.enabled
                                return a
                            })
                        }}
                        small
                    />
                ) : null}

                {type === "desktop_audio" ? <ToggleField label="" checked={isEnabled} onChange={(enabled) => onToggleEnabled?.(enabled)} small /> : null}

                {type === "icecast" || isChannel || (type === "mic" && isSubNode) ? (
                    <Button
                        variant="outline"
                        icon="options"
                        style={{ padding: "5px" }}
                        title="popup.node_options"
                        onClick={() => {
                            popupData.set({ nodeId: id, name, type, channels })
                            activePopup.set("node_options")
                        }}
                    />
                ) : null}
            </div>

            {id !== "network_default" && id !== "output_window" && isEnabled && (nodeType === "input" || hasInputConnection) ? <AudioMeter channelId={id} /> : null}

            {nodeType !== "output" && (type !== "output_window" || isSubNode) ? (
                isSubNode && nodeType === "input" && channels > 1 ? (
                    <div className={styles["ports-column-out"]}>
                        {Array.from({ length: channels }, (_, chIdx) => (
                            <div key={chIdx} className={portClass("port", "port-out", "port-multi")} data-ch-index={chIdx} data-port-type="out" data-title={multiLabel(chIdx)} {...portEvents("out", chIdx)}></div>
                        ))}
                    </div>
                ) : (
                    <div className={portClass("port", "port-out")} data-port-type="out" {...portEvents("out")}></div>
                )
            ) : null}
        </div>
    )
}
