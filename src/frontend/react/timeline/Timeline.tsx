import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { uid } from "uid"
import type { TimelineAction } from "../../../types/Show"
import { createWaveform } from "../../audio/audioWaveform"
import { activeEdit, activePopup, activeShow, activeTriggerFunction, dictionary, resized, selected, showsCache, special, timecode, timeline as timelineStore } from "../../shared/core/stores"
import { DEFAULT_WIDTH } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { actionData } from "../../components/actions/actionData"
import { clone } from "../../shared/utils/helpers/array"
import { getActiveTimelinePlayback, TimelinePlayback } from "../../components/timeline/TimelinePlayback"
import { ShowTimeline } from "../../components/timeline/ShowTimeline"
import { TimelineActions, type TimelineType } from "../../components/timeline/TimelineActions"
import { formatTime, getActionsAtPosition, getProjectShowDurations, getTickInterval, getTimelineSections, parseTime, TIMELINE_SECTION_GAP, TIMELINE_SECTION_HEIGHT, TIMELINE_SECTION_TOP, timelineSections, timelineZoom } from "../../components/timeline/timeline"
import { cn } from "../../shared/core/lib/utils"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { Button } from "../../shared/ui/kit/button/Button"
import { TimelineEasing } from "./TimelineEasing"
import styles from "./Timeline.module.css"

const SECTION_GAP = TIMELINE_SECTION_GAP
const SECTION_HEIGHT = TIMELINE_SECTION_HEIGHT
const USED_HEADER_WIDTH = 120
const WAVEFORM_SETTINGS = { height: 2.2, samples: 256, type: "line" as const, fill: true, fillOpacity: 0.3 }
const BUTTON_STYLE = cssTextToStyle("min-width: 40px;padding: 10px;")
const CORNER_STYLE = cssTextToStyle("border-bottom: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1);")
const EASING_BUTTON_STYLE = cssTextToStyle("padding: 8px;margin-left: 30px;position: absolute;right: 5px;background-color: var(--primary-darker);")
const FLOATING_LEFT_STYLE = cssTextToStyle("margin-bottom: 8px;margin-left: 120px;")
const FLOATING_STYLE = cssTextToStyle("margin-bottom: 8px;")

interface TimelineSectionData {
    name: string
    icon: string
    hasData: boolean
}

type SelectionRect = { x: number; y: number; w: number; h: number }

// Valores de props/stores que los handlers imperativos necesitan leer siempre actualizados.
interface Latest {
    type: TimelineType
    isClosed: boolean
    selectedItemIndexes: number[]
    disablePlayback: boolean
    projectTimelineActive: boolean
    projectShowDurations: Record<string, number>
}

interface Setters {
    setActions: (actions: TimelineAction[]) => void
    setGroupedActions: (groups: TimelineAction[][]) => void
    setMaxTrackIndex: (count: number) => void
    setSelectedActionIds: (ids: string[]) => void
    setSelectionRect: (rect: SelectionRect | null) => void
    setCurrentTime: (time: number) => void
    setTimelineDuration: (duration: number) => void
    setZoomLevel: (zoom: number) => void
    setScrollLeft: (left: number) => void
    setContainerWidth: (width: number) => void
    setIsPlaying: (playing: boolean) => void
    setShouldLoop: (loop: boolean) => void
    setIsRecording: (recording: boolean) => void
}

// Toda la lógica imperativa del Svelte original vive aquí: los handlers son referencias estables,
// así los listeners de window se pueden quitar y volver a poner sin closures stale.
class TimelineEngine {
    readonly player: TimelinePlayback
    readonly timeline: TimelineActions
    private readonly set: Setters
    private readonly latest: { current: Latest }
    private readonly type: TimelineType
    private readonly sections: Record<string, TimelineSectionData>

    private isDestroyed = false
    private updateTimer = 0
    private autoFollow = true
    private isProgrammaticScroll = false
    private autoScrollFrameId: number | null = null
    private autoScrollTimeout: ReturnType<typeof setTimeout> | null = null
    private lastMouseX = 0
    private wasPlaying = false
    private lastMouseEvent: MouseEvent | null = null
    private isScrubbing = false
    private draggingActionId: string | null = null
    private dragTimeOffset = 0
    private dragInitialTimes = new Map<string, number>()
    private isSelecting = false
    private selectionStart = { x: 0, y: 0 }
    private selectionStartIds: string[] = []

    actions: TimelineAction[] = []
    groupedActions: TimelineAction[][] = []
    selectedActionIds: string[] = []
    tabIds: string[]
    maxTrackIndex: number
    currentTime = 0
    timelineDuration = 60000 * 5
    zoomLevel = 10
    isPlaying = false
    shouldLoop = false
    isRecording = false
    trackWrapper: HTMLDivElement | null = null
    rulerContainer: HTMLDivElement | null = null
    headersContainer: HTMLDivElement | null = null

    constructor(type: TimelineType, set: Setters, latest: { current: Latest }) {
        this.type = type
        this.set = set
        this.latest = latest
        this.sections = clone(timelineSections[type] || {}) as Record<string, TimelineSectionData>
        this.tabIds = Object.keys(this.sections)
        this.maxTrackIndex = this.tabIds.length

        this.player = new TimelinePlayback(type)
        this.timeline = new TimelineActions(type, (actions, data) => this.onActionsChanged(actions, data))

        this.player.onPlay(() => {
            this.setPlaying(true)
            this.autoFollow = true
            if (this.currentTime === 0 && !this.actions.length && !this.isRecording) this.toggleRecording()
        })
        this.player.onPause(() => this.setPlaying(false))
        this.player.onStop(() => {
            this.setPlaying(false)
            if (this.isRecording) this.toggleRecording()
        })
        this.player.onDuration((duration) => {
            this.timelineDuration = duration
            this.set.setTimelineDuration(duration)
        })
        this.player.onTime((time) => {
            this.updateTime(time)
            this.updateTimer++
            if (this.updateTimer > 10) {
                this.checkAutoScroll()
                this.updateTimer = 0
            }
        })
        this.timeline.onUpdate(() => {
            this.updateTime(0)
            this.resetView()
        })
    }

    get snapInterval() {
        return (getTickInterval(this.zoomLevel) * 1000) / 10
    }

    private setPlaying(playing: boolean) {
        this.isPlaying = playing
        this.set.setIsPlaying(playing)
    }

    private updateTime(time: number) {
        this.currentTime = time
        this.set.setCurrentTime(time)
    }

    private setZoom(zoom: number) {
        this.zoomLevel = zoom
        this.set.setZoomLevel(zoom)
    }

    private setSelection(ids: string[]) {
        this.selectedActionIds = ids
        this.set.setSelectedActionIds(ids)
    }

    syncRecording(recording: boolean) {
        this.isRecording = recording
        this.set.setIsRecording(recording)
    }

    private onActionsChanged(actions: TimelineAction[], data?: { shouldLoop: boolean }) {
        if (this.isDestroyed) return

        this.shouldLoop = data?.shouldLoop || false
        this.set.setShouldLoop(this.shouldLoop)
        this.player.setLoopState(this.shouldLoop)

        this.actions = actions
        this.set.setActions(actions)
        this.player.setActions(actions)
        this.tabIds = getTimelineSections(this.sections, actions)

        if (this.type !== "slide") return

        const newGroups = new Map<string, TimelineAction[]>()
        actions.forEach((action) => {
            const groupKey = `${action.data?.type}_${action.data?.key}`
            if (!newGroups.has(groupKey)) newGroups.set(groupKey, [])
            newGroups.get(groupKey)?.push(action)
        })

        this.groupedActions = Array.from(newGroups.values()).sort((a, b) => (a[0].data?.type || "").localeCompare(b[0].data?.type || ""))
        this.set.setGroupedActions(this.groupedActions)
        this.maxTrackIndex = this.groupedActions.length
        this.set.setMaxTrackIndex(this.maxTrackIndex)
    }

    destroy() {
        this.isDestroyed = true
        if (this.autoScrollTimeout) clearTimeout(this.autoScrollTimeout)
        if (this.autoScrollFrameId) cancelAnimationFrame(this.autoScrollFrameId)
        this.removeDragListeners()
        window.removeEventListener("mousemove", this.updateScrub)
        window.removeEventListener("mouseup", this.endScrub)
        this.player.close()
        this.timeline.close()
    }

    attachTrackWrapper(node: HTMLDivElement | null) {
        this.trackWrapper = node
    }

    attachRuler(node: HTMLDivElement | null) {
        this.rulerContainer = node
    }

    attachHeaders(node: HTMLDivElement | null) {
        this.headersContainer = node
    }

    getTrackData(index: number): TimelineSectionData {
        return this.sections[this.tabIds[index]] || { name: "Unknown", icon: "unknown", hasData: false }
    }

    getActionTrack(action: TimelineAction): number {
        if (this.type === "slide") return this.groupedActions.findIndex((group) => group[0].data?.type === action.data?.type && group[0].data?.key === action.data?.key)
        return this.tabIds.indexOf(action.type)
    }

    getActionBaseY(action: TimelineAction): number {
        return TIMELINE_SECTION_TOP + this.getActionTrack(action) * (SECTION_HEIGHT + SECTION_GAP)
    }

    resetView() {
        this.setZoom(10)
        this.autoFollow = true
        queueMicrotask(() => this.centerPlayhead())
    }

    centerPlayhead() {
        if (!this.trackWrapper) return
        this.isProgrammaticScroll = true
        const playheadPixelPos = (this.currentTime / 1000) * this.zoomLevel
        this.trackWrapper.scrollLeft = Math.max(0, playheadPixelPos - this.trackWrapper.clientWidth / 2)
    }

    async handleWheel(e: WheelEvent, zoom: boolean = false) {
        const shouldZoom = zoom || e.ctrlKey || e.metaKey
        if (shouldZoom) {
            const currentZoom = this.zoomLevel
            this.setZoom(await timelineZoom(e, currentZoom))
            if (!this.trackWrapper) return

            const rect = this.trackWrapper.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const timeAtMouse = ((mouseX + this.trackWrapper.scrollLeft) / currentZoom) * 1000
            queueMicrotask(() => {
                if (!this.trackWrapper) return
                this.isProgrammaticScroll = true
                this.trackWrapper.scrollLeft = (timeAtMouse / 1000) * this.zoomLevel - mouseX
            })
            return
        }

        if (e.deltaY !== 0) this.autoFollow = false
        if (e.shiftKey && e.deltaY !== 0 && this.trackWrapper) {
            e.preventDefault()
            this.trackWrapper.scrollLeft += e.deltaY * (e.altKey ? 4 : 1)
        }
    }

    startRulerScrub(e: MouseEvent) {
        if (this.latest.current.disablePlayback || e.button !== 0) return
        this.isScrubbing = true
        this.wasPlaying = this.isPlaying
        this.player.pause()

        this.lastMouseX = e.clientX
        this.updateScrub(e)
        this.autoScrollTimeout = setTimeout(() => this.autoScrollLoop(), 300)
        window.addEventListener("mousemove", this.updateScrub)
        window.addEventListener("mouseup", this.endScrub)
    }

    updateScrub = (e: MouseEvent) => {
        if (!this.isScrubbing || !this.trackWrapper) return
        this.lastMouseX = e.clientX

        const rect = this.trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + this.trackWrapper.scrollLeft
        const seekTime = (offsetX / this.zoomLevel) * 1000
        const snappedTime = this.latest.current.isClosed ? Math.round(seekTime / 10) * 10 : Math.round(seekTime / this.snapInterval) * this.snapInterval
        this.player.setTime(Math.max(0, Math.min(snappedTime, this.timelineDuration)), true)
    }

    endScrub = () => {
        this.isScrubbing = false
        if (this.autoScrollTimeout) clearTimeout(this.autoScrollTimeout)
        if (this.autoScrollFrameId) cancelAnimationFrame(this.autoScrollFrameId)
        window.removeEventListener("mousemove", this.updateScrub)
        window.removeEventListener("mouseup", this.endScrub)
        if (this.wasPlaying) this.player.play()
    }

    startContentInteraction(e: MouseEvent) {
        if (e.button !== 0) return
        if ((e.target as Element | null)?.closest(".easing")) return
        if (!this.trackWrapper) return

        selected.set({ id: null, data: [] })
        const rect = this.trackWrapper.getBoundingClientRect()
        this.selectionStart = { x: e.clientX - rect.left + this.trackWrapper.scrollLeft, y: e.clientY - rect.top + this.trackWrapper.scrollTop }
        this.isSelecting = true
        this.set.setSelectionRect({ ...this.selectionStart, w: 0, h: 0 })

        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            this.setSelection([])
            this.selectionStartIds = []
        } else {
            this.selectionStartIds = [...this.selectedActionIds]
        }

        this.lastMouseEvent = e
        this.lastMouseX = e.clientX
        this.autoScrollTimeout = setTimeout(() => this.autoScrollLoop(), 300)
        window.addEventListener("mousemove", this.updateSelection)
        window.addEventListener("mouseup", this.endSelection)
    }

    updateSelection = (e: MouseEvent) => {
        if (!this.isSelecting || !this.trackWrapper) return
        this.lastMouseX = e.clientX
        this.lastMouseEvent = e

        const rect = this.trackWrapper.getBoundingClientRect()
        const currentOffsetX = e.clientX - rect.left + this.trackWrapper.scrollLeft
        const currentOffsetY = e.clientY - rect.top + this.trackWrapper.scrollTop
        const w = currentOffsetX - this.selectionStart.x
        const h = currentOffsetY - this.selectionStart.y
        const box: SelectionRect = { x: w < 0 ? currentOffsetX : this.selectionStart.x, y: h < 0 ? currentOffsetY : this.selectionStart.y, w: Math.abs(w), h: Math.abs(h) }
        this.set.setSelectionRect(box)

        const newSelectedIds = getActionsAtPosition(e, this.trackWrapper, this.actions, this.latest.current.type === "slide" ? this.groupedActions : this.tabIds, this.zoomLevel, box, this.latest.current.projectShowDurations)
        this.setSelection(this.selectionStartIds.length > 0 ? Array.from(new Set([...this.selectionStartIds, ...newSelectedIds])) : newSelectedIds)
        this.selectOnlyActiveActions()
    }

    private selectOnlyActiveActions() {
        this.setSelection(
            this.selectedActionIds.filter((id) => {
                const action = this.actions.find((a) => a.id === id)
                if (!action) return false
                if (this.type === "slide" && action.type === "style") {
                    const itemIndexes = action.data?.indexes ?? [0]
                    return itemIndexes.some((index) => this.latest.current.selectedItemIndexes.includes(index))
                }
                return true
            })
        )
    }

    clearSelection() {
        this.setSelection([])
    }

    endSelection = () => {
        this.isSelecting = false
        this.set.setSelectionRect(null)
        this.lastMouseEvent = null
        if (this.autoScrollTimeout) clearTimeout(this.autoScrollTimeout)
        if (this.autoScrollFrameId) cancelAnimationFrame(this.autoScrollFrameId)
        window.removeEventListener("mousemove", this.updateSelection)
        window.removeEventListener("mouseup", this.endSelection)
    }

    selectAll() {
        this.setSelection(this.actions.map((a) => a.id))
        this.selectOnlyActiveActions()
    }

    private checkAutoScroll() {
        if (!this.trackWrapper || !this.isPlaying || !this.autoFollow) return

        const playheadPixelPos = (this.currentTime / 1000) * this.zoomLevel
        const containerWidth = this.trackWrapper.clientWidth
        const scrollLeft = this.trackWrapper.scrollLeft
        let newScrollLeft = -1

        if (playheadPixelPos > scrollLeft + containerWidth) newScrollLeft = playheadPixelPos - containerWidth * 0.1
        else if (playheadPixelPos < scrollLeft) newScrollLeft = playheadPixelPos - containerWidth * 0.1

        if (newScrollLeft !== -1) {
            this.isProgrammaticScroll = true
            this.trackWrapper.scrollLeft = newScrollLeft
            if (this.rulerContainer && !this.isSelecting) this.rulerContainer.scrollLeft = newScrollLeft
        }
    }

    private autoScrollLoop() {
        if ((!this.isScrubbing && !this.draggingActionId && !this.isSelecting) || !this.trackWrapper) return

        const rect = this.trackWrapper.getBoundingClientRect()
        const EDGE_THRESHOLD = 100
        const MAX_SCROLL_SPEED = 14
        const distLeft = this.lastMouseX - rect.left
        const distRight = rect.right - this.lastMouseX
        let scrollAmount = 0

        if (distLeft < EDGE_THRESHOLD) scrollAmount = -MAX_SCROLL_SPEED * (1 - distLeft / EDGE_THRESHOLD)
        else if (distRight < EDGE_THRESHOLD) scrollAmount = MAX_SCROLL_SPEED * (1 - distRight / EDGE_THRESHOLD)

        if (scrollAmount !== 0) {
            this.isProgrammaticScroll = true
            this.trackWrapper.scrollLeft += scrollAmount
            if (this.rulerContainer) this.rulerContainer.scrollLeft = this.trackWrapper.scrollLeft

            const offsetX = this.lastMouseX - rect.left + this.trackWrapper.scrollLeft
            const seekTime = (offsetX / this.zoomLevel) * 1000
            if (this.isScrubbing) {
                this.player.setTime(Math.max(0, Math.min(Math.round(seekTime / 10) * 10, this.timelineDuration)))
            } else if (this.draggingActionId) {
                this.moveSelectedActions(Math.round((seekTime - this.dragTimeOffset) / this.snapInterval) * this.snapInterval)
            } else if (this.isSelecting && this.lastMouseEvent) {
                this.updateSelection(this.lastMouseEvent)
            }
        }

        this.autoScrollFrameId = requestAnimationFrame(() => this.autoScrollLoop())
    }

    startActionDrag(e: MouseEvent, id: string) {
        if (e.button === 2) {
            if (!this.trackWrapper) return
            const clickedActions = getActionsAtPosition(e, this.trackWrapper, this.actions, this.latest.current.type === "slide" ? this.groupedActions : this.tabIds, this.zoomLevel, null, this.latest.current.projectShowDurations)
            if (clickedActions.some((actionId) => this.selectedActionIds.includes(actionId))) return
            this.setSelection(clickedActions)
            return
        }
        if (e.button !== 0) return

        selected.set({ id: null, data: [] })
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            const index = this.selectedActionIds.indexOf(id)
            if (index === -1) this.setSelection([...this.selectedActionIds, id])
            else this.setSelection(this.selectedActionIds.filter((_, i) => i !== index))
        } else if (!this.selectedActionIds.includes(id)) {
            this.setSelection([id])
        }

        if (e.altKey) {
            const selectedIdIndex = this.selectedActionIds.indexOf(id)
            this.setSelection(this.timeline.duplicateActions(this.selectedActionIds))
            id = this.selectedActionIds[selectedIdIndex] || id
        }

        this.draggingActionId = id
        this.dragInitialTimes.clear()
        this.selectedActionIds.forEach((selectedId) => {
            const action = this.actions.find((a) => a.id === selectedId)
            if (action) this.dragInitialTimes.set(selectedId, action.time)
        })

        if (this.trackWrapper) {
            const rect = this.trackWrapper.getBoundingClientRect()
            const offsetX = e.clientX - rect.left + this.trackWrapper.scrollLeft
            const action = this.actions.find((a) => a.id === id)
            this.dragTimeOffset = action ? (offsetX / this.zoomLevel) * 1000 - action.time : 0
        } else {
            this.dragTimeOffset = 0
        }

        this.lastMouseX = e.clientX
        this.autoScrollTimeout = setTimeout(() => this.autoScrollLoop(), 300)
        window.addEventListener("mousemove", this.updateActionDrag)
        window.addEventListener("mouseup", this.endActionDrag)
    }

    private moveSelectedActions(targetAnchorTime: number) {
        if (!this.draggingActionId) return
        const initialAnchorTime = this.dragInitialTimes.get(this.draggingActionId)
        if (initialAnchorTime === undefined) return

        let delta = targetAnchorTime - initialAnchorTime
        const minInitial = Math.min(...this.dragInitialTimes.values())
        if (minInitial + delta < 0) delta = -minInitial
        this.timeline.updateTimes(this.dragInitialTimes, delta)
    }

    updateActionDrag = (e: MouseEvent) => {
        if (!this.draggingActionId || !this.trackWrapper) return
        this.lastMouseX = e.clientX
        const rect = this.trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + this.trackWrapper.scrollLeft
        const newTime = (offsetX / this.zoomLevel) * 1000 - this.dragTimeOffset
        this.moveSelectedActions(Math.round(newTime / this.snapInterval) * this.snapInterval)
    }

    private removeDragListeners() {
        window.removeEventListener("mousemove", this.updateActionDrag)
        window.removeEventListener("mouseup", this.endActionDrag)
    }

    endActionDrag = () => {
        this.draggingActionId = null
        if (this.autoScrollTimeout) clearTimeout(this.autoScrollTimeout)
        if (this.autoScrollFrameId) cancelAnimationFrame(this.autoScrollFrameId)
        this.removeDragListeners()
    }

    handleDragOver(e: ReactDragEvent) {
        e.preventDefault()
    }

    handleDrop(e: ReactDragEvent) {
        e.preventDefault()
        if (!this.trackWrapper) return
        const rect = this.trackWrapper.getBoundingClientRect()
        const offsetX = e.clientX - rect.left + this.trackWrapper.scrollLeft
        const dropTime = (offsetX / this.zoomLevel) * 1000
        this.timeline.handleDrop(e.nativeEvent, Math.max(0, Math.min(Math.round(dropTime / 10) * 10, this.timelineDuration)))
    }

    handleTimeChange(e: ChangeEvent<HTMLInputElement>) {
        const target = e.target as HTMLInputElement
        const ms = parseTime(target.value)
        let time = this.currentTime
        if (!isNaN(ms)) {
            time = Math.max(0, Math.min(ms, this.timelineDuration))
            this.player.setTime(time)
            this.centerPlayhead()
        }
        target.value = formatTime(time, this.type)
        target.blur()
    }

    handleTimeKeydown(e: ReactKeyboardEvent<HTMLInputElement>) {
        e.stopPropagation()
        if (e.key === "Enter") e.currentTarget.blur()
    }

    handleScroll() {
        if (!this.trackWrapper) return
        if (this.rulerContainer) this.rulerContainer.scrollLeft = this.trackWrapper.scrollLeft
        if (this.headersContainer) this.headersContainer.scrollTop = this.trackWrapper.scrollTop

        if (this.isProgrammaticScroll) {
            this.isProgrammaticScroll = false
            this.set.setScrollLeft(this.trackWrapper.scrollLeft)
            return
        }
        if (this.isPlaying) this.autoFollow = false
        this.set.setScrollLeft(this.trackWrapper.scrollLeft)
    }

    keydown(e: KeyboardEvent) {
        const target = e.target as HTMLElement
        if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault()
            return
        }
        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            this.deleteSelectedNodes()
            return
        }
        if (e.key !== " " || e.repeat) return

        const active = getActiveTimelinePlayback()
        if (active ? active !== this.player : this.latest.current.type === "show" && this.latest.current.projectTimelineActive) return

        e.preventDefault()
        if (this.isPlaying) this.player.pause()
        else this.player.play()
    }

    deleteSelectedNodes() {
        if (this.latest.current.isClosed || !this.selectedActionIds.length) return
        this.timeline.deleteActions([...this.selectedActionIds])
        this.setSelection([])
    }

    toggleRecording() {
        if (this.latest.current.type !== "show") return
        this.syncRecording(
            ShowTimeline.toggleRecording((sequence) => {
                const time = Number(this.currentTime.toFixed(2))
                if (this.actions.find((a) => a.type === sequence.type && Math.abs(time - a.time) < 100 && JSON.stringify(a.data) === JSON.stringify(sequence.data))) return
                this.timeline.addAction({ id: uid(6), time, type: sequence.type, data: sequence.data, name: sequence.name, color: sequence.color })
                if (!this.isPlaying) this.player.play()
            })
        )
    }
}

function Waveform({ path }: { path: string }) {
    const node = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (node.current && path) void createWaveform(node.current, path, WAVEFORM_SETTINGS)
    }, [path])
    return <div ref={node} className={cn("waveform-container", styles["waveform-container"])} />
}

export interface TimelineProps {
    type: TimelineType
    isClosed?: boolean
}

// (F24.19b).
// El estado local reactivo pasa a useState; los listeners globales y el arrastre viven en TimelineEngine.
export function Timeline({ type, isClosed = false }: TimelineProps) {
    const [actions, setActions] = useState<TimelineAction[]>([])
    const [groupedActions, setGroupedActions] = useState<TimelineAction[][]>([])
    const [maxTrackIndex, setMaxTrackIndex] = useState(() => Object.keys(timelineSections[type] || {}).length)
    const [selectedActionIds, setSelectedActionIds] = useState<string[]>([])
    const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [timelineDuration, setTimelineDuration] = useState(60000 * 5)
    const [zoomLevel, setZoomLevel] = useState(10)
    const [scrollLeft, setScrollLeft] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [shouldLoop, setShouldLoop] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [projectShowDurations, setProjectShowDurations] = useState<Record<string, number>>({})
    const [easingActive, setEasingActive] = useState<number | null>(null)

    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentSpecial = useStore(special)
    const currentTimecode = useStore(timecode)
    const currentDictionary = useStore(dictionary)
    const currentTimeline = useStore(timelineStore)
    const trigger = useStore(activeTriggerFunction)

    const selectedItemIndexes = type === "slide" ? (currentActiveEdit?.items?.length ? currentActiveEdit.items : [0]) : []
    const disablePlayback = type === "project" && currentTimecode.type === "receive"

    const latest = useRef<Latest>({ type, isClosed, selectedItemIndexes, disablePlayback, projectTimelineActive: !!currentSpecial?.projectTimelineActive, projectShowDurations })
    const engineRef = useRef<TimelineEngine | null>(null)
    if (engineRef.current === null) {
        engineRef.current = new TimelineEngine(type, { setActions, setGroupedActions, setMaxTrackIndex, setSelectedActionIds, setSelectionRect, setCurrentTime, setTimelineDuration, setZoomLevel, setScrollLeft, setContainerWidth, setIsPlaying, setShouldLoop, setIsRecording }, latest)
    }
    const engine = engineRef.current
    latest.current = { type, isClosed, selectedItemIndexes, disablePlayback, projectTimelineActive: !!currentSpecial?.projectTimelineActive, projectShowDurations }

    const timeString = formatTime(currentTime, type, timelineStore)
    const tickInterval = getTickInterval(zoomLevel)
    const totalTickCount = Math.ceil(timelineDuration / 1000 / tickInterval)
    const visibleTicksStartIndex = Math.min(totalTickCount, Math.max(0, Math.floor(scrollLeft / (tickInterval * zoomLevel))))
    const visibleTicksEndIndex = Math.min(totalTickCount, Math.ceil((scrollLeft + containerWidth) / (tickInterval * zoomLevel)))
    const visibleTickCount = Math.max(0, visibleTicksEndIndex - visibleTicksStartIndex + 1)
    const totalTrackHeight = TIMELINE_SECTION_TOP + maxTrackIndex * (SECTION_HEIGHT + SECTION_GAP) - SECTION_GAP + TIMELINE_SECTION_TOP
    const actionsByTime = actions.slice().sort((a, b) => a.time - b.time)
    const slideActions = actionsByTime.filter((a) => a.type === "slide")
    const firstSlideAction = slideActions[0]
    const lastSlideAction = slideActions[slideActions.length - 1]

    useEffect(() => () => engine.destroy(), [engine])

    useEffect(() => {
        const keydown = (e: KeyboardEvent) => engine.keydown(e)
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [engine])

    useEffect(() => {
        const node = engine.trackWrapper
        if (!node || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => setContainerWidth(node.clientWidth))
        observer.observe(node)
        setContainerWidth(node.clientWidth)
        return () => observer.disconnect()
    }, [engine, isClosed])

    useEffect(() => {
        const track = engine.trackWrapper
        const ruler = engine.rulerContainer
        const onTrack = (e: WheelEvent) => void engine.handleWheel(e)
        const onRuler = (e: WheelEvent) => void engine.handleWheel(e, true)
        track?.addEventListener("wheel", onTrack, { passive: false })
        ruler?.addEventListener("wheel", onRuler, { passive: false })
        return () => {
            track?.removeEventListener("wheel", onTrack)
            ruler?.removeEventListener("wheel", onRuler)
        }
    }, [engine, isClosed])

    useEffect(() => {
        engine.resetView()
    }, [engine, isClosed])

    useEffect(() => {
        if (trigger === "reset_timeline_view") engine.resetView()
        else if (trigger === "timeline_selectAll") engine.selectAll()
        else if (trigger === `start_${type}_timeline`) engine.player.play()
        else if (trigger === "delete_selected_nodes") engine.deleteSelectedNodes()
        else if (trigger === "timeline_update") engine.timeline.refreshActions()
    }, [engine, trigger, type])

    useEffect(() => {
        if (type === "show" && currentActiveShow) engine.syncRecording(ShowTimeline.isRecordingActive())
    }, [engine, type, currentActiveShow])

    useEffect(() => {
        if (type !== "project") return
        const timeout = setTimeout(() => setProjectShowDurations(getProjectShowDurations(engine.actions, currentShowsCache)), 50)
        return () => clearTimeout(timeout)
    }, [engine, type, actions, currentShowsCache])

    const clipStyle = (action: TimelineAction, top: number, height: number, widthFactor = 1, extra: CSSProperties = {}): CSSProperties => ({
        left: `${(action.time / 1000) * zoomLevel}px`,
        width: `${widthFactor * zoomLevel}px`,
        top: `${top}px`,
        height: `${height}px`,
        ...extra
    })

    const triggerIcon = (action: TimelineAction) => (action.data.triggers?.length === 1 ? actionData[action.data.triggers[0] as keyof typeof actionData]?.icon : "actions") || "actions"

    return (
        <div className={cn("timeline", styles.timeline)}>
            {isClosed ? (
                <div className={cn("closed", styles.closed)}>
                    {disablePlayback ? (
                        <Button style={BUTTON_STYLE} title={isPlaying ? "media.stop" : "media.play"} onClick={() => (isPlaying ? engine.player.pause() : engine.player.play())}>
                            <Icon id={isPlaying ? "stop" : "microphone"} white={!isPlaying} />
                        </Button>
                    ) : (
                        <>
                            <Button style={BUTTON_STYLE} title={isPlaying ? "media.pause" : "media.play"} onClick={() => (isPlaying ? engine.player.pause() : engine.player.play())}>
                                <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                            </Button>
                            <Button style={BUTTON_STYLE} disabled={currentTime === 0} title="media.stop" onClick={() => engine.player.stop()}>
                                <Icon id="stop" white={!isPlaying} />
                            </Button>
                        </>
                    )}

                    {(type === "show" && !actions.length) || isRecording ? (
                        <Button style={BUTTON_STYLE} title={`actions.${isRecording ? "stop_recording" : "start_recording"}`} onClick={() => engine.toggleRecording()} red={isRecording}>
                            <Icon id="record" white />
                        </Button>
                    ) : null}

                    <div className={cn("time-display", styles["time-display"])} style={{ display: "flex", alignItems: "center", width: "auto" }}>
                        {timeString}
                    </div>

                    <div ref={(node) => engine.attachTrackWrapper(node)} className={cn("timeline-track-wrapper", styles["timeline-track-wrapper"])} onMouseDown={(e) => engine.startRulerScrub(e.nativeEvent)} onScroll={() => engine.handleScroll()}>
                        <div className={cn("timeline-track", styles["timeline-track"])} style={{ width: `${(timelineDuration / 1000) * zoomLevel}px` }}>
                            {actions.map((action) => {
                                const duration = action.duration || (type === "project" && action.type === "show" ? projectShowDurations[action.data.id || ""] : 0) || 0
                                const selected = selectedActionIds.includes(action.id)
                                if (duration) {
                                    return (
                                        <div key={action.id} className={cn("action-clip", "context", "#timeline_node", styles["action-clip"], selected && "selected", selected && styles.selected)} style={clipStyle(action, 0, 0, duration, { top: "50%", transform: "translateY(-50%)", height: "100%", opacity: 0.3 })} data-title={action.name}>
                                            <div className={cn("action-clip-content", styles["action-clip-content"])}>
                                                <div className={cn("clip-label", styles["clip-label"])}>{action.name}</div>
                                            </div>
                                        </div>
                                    )
                                }
                                return (
                                    <div key={action.id} className={cn("action-marker", action.type, "context", "#timeline_node", styles["action-marker"], selected && "selected", selected && styles.selected)} style={{ left: `${(action.time / 1000) * zoomLevel}px`, top: "50%", transform: "translate(-50%, -50%)" }} data-title={translateText(action.name)}>
                                        <div className={cn("action-head", styles["action-head"])}>{action.type === "action" ? <Icon id={triggerIcon(action)} size={0.9} white /> : typeof action.data?.index === "number" ? action.data.index + 1 : null}</div>
                                    </div>
                                )
                            })}

                            <div className={cn("playhead", styles.playhead)} style={{ left: `${(currentTime / 1000) * zoomLevel}px` }}>
                                <div className={cn("playhead-line", styles["playhead-line"])} />
                            </div>
                        </div>
                    </div>

                    <Button style={BUTTON_STYLE} title="main.open" onClick={() => resized.update((a) => ({ ...a, [(type === "project" ? "project_" : type === "slide" ? "slide_" : "") + "timeline"]: DEFAULT_WIDTH }))}>
                        <Icon id="up" white />
                    </Button>
                </div>
            ) : (
                <>
                    <div className={cn("timeline-grid", styles["timeline-grid"])}>
                        <div className="corner" style={{ width: `${USED_HEADER_WIDTH}px`, ...CORNER_STYLE }}>
                            <input className={cn("time-display", styles["time-display"])} value={timeString} onChange={(e) => engine.handleTimeChange(e)} onKeyDown={(e) => engine.handleTimeKeydown(e)} />
                        </div>

                        <div ref={(node) => engine.attachRuler(node)} className={cn("ruler-container", styles["ruler-container"])} onMouseDown={(e) => engine.startRulerScrub(e.nativeEvent)}>
                            <div className={cn("ruler", styles.ruler)} style={{ width: `${(timelineDuration / 1000) * zoomLevel}px` }}>
                                {Array.from({ length: visibleTickCount }, (_, i) => {
                                    const tickIndex = i + visibleTicksStartIndex
                                    const pos = tickIndex * tickInterval * zoomLevel
                                    return (
                                        <div key={tickIndex}>
                                            <div className={cn("tick", styles.tick)} style={{ left: `${pos}px` }}>
                                                <span className={cn("tick-label", styles["tick-label"])}>{formatTime(tickIndex * tickInterval * 1000, type, currentTimeline)}</span>
                                            </div>
                                            {tickIndex < totalTickCount ? Array.from({ length: 10 }, (_, j) => <div key={j} className={cn("tick", "minor", styles.tick, styles.minor)} style={{ left: `${pos + j * (tickInterval / 10) * zoomLevel}px`, height: j === 0 ? "20px" : j === 5 ? "10px" : "8px" }} />) : null}
                                        </div>
                                    )
                                })}
                                <div className={cn("playhead-knob", styles["playhead-knob"])} style={{ left: `${(currentTime / 1000) * zoomLevel}px` }} />
                            </div>
                        </div>

                        <div ref={(node) => engine.attachHeaders(node)} className={cn("headers-container", styles["headers-container"])} style={{ width: `${USED_HEADER_WIDTH}px`, minWidth: `${USED_HEADER_WIDTH}px` }}>
                            <div className={cn("track-headers", styles["track-headers"])} style={{ height: `${totalTrackHeight}px` }}>
                                {type === "slide"
                                    ? groupedActions.map((group, i) => (
                                          <div key={i} className={cn("track-header", styles["track-header"])} style={{ top: `${TIMELINE_SECTION_TOP + i * (SECTION_HEIGHT + SECTION_GAP)}px`, height: `${SECTION_HEIGHT}px`, width: "100%" }}>
                                              <Icon id={group[0]?.data?.type === "text" ? "text" : "item"} white />
                                              <span className="track-name">{translateText(group[0]?.name)}</span>
                                              <Button title="timeline.toggle_curve_editor" style={EASING_BUTTON_STYLE} isActive={easingActive === i} onClick={() => setEasingActive(easingActive === null || easingActive !== i ? i : null)}>
                                                  <Icon id="easing" white />
                                              </Button>
                                          </div>
                                      ))
                                    : Array.from({ length: maxTrackIndex }, (_, i) => {
                                          const track = engine.getTrackData(i)
                                          return (
                                              <div key={i} className={cn("track-header", styles["track-header"])} style={{ top: `${TIMELINE_SECTION_TOP + i * (SECTION_HEIGHT + SECTION_GAP)}px`, height: `${SECTION_HEIGHT}px`, width: "100%", ...(track.hasData ? {} : { opacity: 0.3 }) }}>
                                                  <Icon id={track.icon} white />
                                                  <span className="track-name">{translateText(track.name)}</span>
                                              </div>
                                          )
                                      })}
                            </div>
                        </div>

                        <div ref={(node) => engine.attachTrackWrapper(node)} className={cn("timeline-track-wrapper", styles["timeline-track-wrapper"])} onScroll={() => engine.handleScroll()} onDragOver={(e) => engine.handleDragOver(e)} onDrop={(e) => engine.handleDrop(e)}>
                            <div className={cn("timeline-track", styles["timeline-track"])} style={{ width: `${(timelineDuration / 1000) * zoomLevel}px`, height: `${totalTrackHeight}px` }} onMouseDown={(e) => engine.startContentInteraction(e.nativeEvent)}>
                                <div className={cn("grid", styles.grid)}>
                                    {Array.from({ length: visibleTickCount }, (_, i) => {
                                        const tickIndex = i + visibleTicksStartIndex
                                        const pos = tickIndex * tickInterval * zoomLevel
                                        return (
                                            <div key={tickIndex}>
                                                <div className={cn("grid-line", styles["grid-line"])} style={{ left: `${pos}px` }} />
                                                {tickIndex < totalTickCount ? Array.from({ length: 10 }, (_, j) => <div key={j} className={cn("grid-line", "minor", styles["grid-line"], styles.minor)} style={{ left: `${pos + j * (tickInterval / 10) * zoomLevel}px` }} />) : null}
                                            </div>
                                        )
                                    })}
                                </div>

                                {firstSlideAction ? (
                                    <div
                                        className={cn("slide-action-bar", styles["slide-action-bar"])}
                                        style={{
                                            left: `${(firstSlideAction.time / 1000) * zoomLevel}px`,
                                            top: `${engine.getActionBaseY(firstSlideAction)}px`,
                                            width: `${((lastSlideAction.time - firstSlideAction.time) / 1000) * zoomLevel}px`
                                        }}
                                    />
                                ) : null}

                                {actions.map((action) => {
                                    const duration = action.duration || (type === "project" && action.type === "show" ? projectShowDurations[action.data.id || ""] : 0) || 0
                                    const baseY = engine.getActionBaseY(action)
                                    const selected = selectedActionIds.includes(action.id)
                                    if (duration) {
                                        return (
                                            <div
                                                key={action.id}
                                                className={cn("action-clip", "context", "#timeline_node", styles["action-clip"], selected && "selected", selected && styles.selected)}
                                                style={clipStyle(action, baseY, SECTION_HEIGHT + 4, duration)}
                                                data-title={`${formatTime(action.time, type, currentTimeline)}-${formatTime(duration * 1000, type, currentTimeline)}: ${action.name}`}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation()
                                                    engine.startActionDrag(e.nativeEvent, action.id)
                                                }}
                                            >
                                                <div className={cn("action-clip-content", styles["action-clip-content"])}>
                                                    {action.type === "audio" || action.type === "video" ? <Waveform path={action.data.path || ""} /> : null}
                                                    <div className={cn("clip-label", styles["clip-label"])}>{action.name}</div>
                                                </div>
                                            </div>
                                        )
                                    }

                                    const faded = type === "slide" && action.type === "style" && !(action.data?.indexes ?? [0])?.some((a) => selectedItemIndexes.includes(a))
                                    return (
                                        <div
                                            key={action.id}
                                            className={cn("action-marker", action.type, "context", "#timeline_node", styles["action-marker"], selected && "selected", selected && styles.selected, faded && "faded", faded && styles.faded)}
                                            style={{ left: `${(action.time / 1000) * zoomLevel}px`, top: `${baseY + 10}px` }}
                                            data-title={`${formatTime(action.time, type, currentTimeline)}: ${action.name}`}
                                            onMouseDown={(e) => {
                                                e.stopPropagation()
                                                engine.startActionDrag(e.nativeEvent, action.id)
                                            }}
                                        >
                                            <div className={cn("action-head", styles["action-head"])}>{action.type === "action" ? <Icon id={triggerIcon(action)} size={0.9} white /> : typeof action.data?.index === "number" ? action.data.index + 1 : null}</div>
                                            <div className={cn("action-label", styles["action-label"])} style={cssTextToStyle(`${action.color ? `border-bottom: 1px solid ${action.color};` : ""}${type === "slide" ? "font-size: 0.7em;" : ""}`)}>
                                                {action.type === "style" ? (typeof action.data.value === "number" ? parseFloat(action.data.value.toFixed(1)) : action.data.value) : translateText(action.name)}
                                            </div>
                                        </div>
                                    )
                                })}

                                <TimelineEasing groupedActions={groupedActions} actions={actions} selectedActionIds={selectedActionIds} selectedItemIndexes={selectedItemIndexes} activeGroupIndex={easingActive} zoomLevel={zoomLevel} sectionHeight={SECTION_HEIGHT} sectionGap={SECTION_GAP} sectionTop={TIMELINE_SECTION_TOP} onActionDrag={(e, id) => engine.startActionDrag(e, id)} onClearSelection={() => engine.clearSelection()} timeline={engine.timeline} />

                                {selectionRect ? <div className={cn("selection-box", styles["selection-box"])} style={{ left: `${selectionRect.x}px`, top: `${selectionRect.y}px`, width: `${selectionRect.w}px`, height: `${selectionRect.h}px` }} /> : null}

                                <div className={cn("playhead", styles.playhead)} style={{ left: `${(currentTime / 1000) * zoomLevel}px` }}>
                                    <div className={cn("playhead-line", styles["playhead-line"])} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {(easingActive === null || type !== "slide") && (
                        <FloatingBar side="left" style={FLOATING_LEFT_STYLE}>
                            {disablePlayback ? (
                                <Button style={BUTTON_STYLE} title={isPlaying ? "media.stop" : "media.play"} onClick={() => (isPlaying ? engine.player.pause() : engine.player.play())}>
                                    <Icon id={isPlaying ? "stop" : "microphone"} white={!isPlaying} />
                                </Button>
                            ) : (
                                <>
                                    <Button title={isPlaying ? "media.pause" : "media.play"} onClick={() => (isPlaying ? engine.player.pause() : engine.player.play())}>
                                        <Icon size={1.3} id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                                    </Button>
                                    <Button disabled={currentTime === 0} title="media.stop" onClick={() => engine.player.stop()}>
                                        <Icon size={1.3} id="stop" white={!isPlaying} />
                                    </Button>
                                </>
                            )}

                            {type === "show" ? (
                                <>
                                    <div className="divider" />
                                    <Button disabled={isPlaying && !isRecording} title={`actions.${isRecording ? "stop_recording" : "start_recording"}`} onClick={() => engine.toggleRecording()} red={isRecording}>
                                        <Icon size={1.3} id="record" white />
                                    </Button>
                                </>
                            ) : type === "slide" ? (
                                <>
                                    <div className="divider" />
                                    <Button title={translateText("media._loop" + (shouldLoop ? ": settings.enabled" : ""), currentDictionary) || "Loop"} onClick={() => setShouldLoop(engine.timeline.toggleLoop())} isActive={shouldLoop}>
                                        <Icon size={1.1} id="loop" white={!shouldLoop} />
                                    </Button>
                                </>
                            ) : null}
                        </FloatingBar>
                    )}

                    {type === "project" ? (
                        <FloatingBar style={FLOATING_STYLE}>
                            <Button title="popup.timecode" onClick={() => activePopup.set("timecode")}>
                                <Icon id="clock" white />
                            </Button>
                            <div className="divider" />
                            <Button title="popup.timeline" onClick={() => activePopup.set("timeline")}>
                                <Icon id="options" white />
                            </Button>
                        </FloatingBar>
                    ) : null}
                </>
            )}
        </div>
    )
}
