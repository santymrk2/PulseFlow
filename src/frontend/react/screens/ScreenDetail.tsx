import { useEffect, useRef, useState } from "react"
import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import type { Output, RemoveScreenPayload } from "../../../types/Output"
import { clone } from "../../components/helpers/array"
import { deleteAction, duplicate } from "../../components/helpers/clipboard"
import { toggleOutputs } from "../../components/helpers/output"
import { canRemoveScreen, nextScreenAfterRemove } from "../../components/screens/screenActions"
import type { LayoutDisplay } from "../../components/screens/displayLayout"
import { invokeCommand } from "../../IPC/tauri"
import { cn } from "../../lib/utils"
import { activePage, activePopup, activeStage, currentOutputSettings, dictionary, outputs, stageShows } from "../../stores"
import { translateText } from "../../utils/language"
import { send } from "../../utils/request"
import { useStore } from "../hooks/useStore"
import { useFreshStore } from "../settings/audio/useFreshStore"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { NumberField } from "../ui/number-field/NumberField"
import { PopupField } from "../ui/popup-field/PopupField"
import { SelectField } from "../ui/select-field/SelectField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import { DisplayLayout } from "./DisplayLayout"
import { ScreenOutputOptions } from "./ScreenOutputOptions"
import styles from "./ScreenDetail.module.css"

// Port de components/screens/ScreenDetail.svelte (F24.14): detalle de una pantalla (nombre, tipo, monitores, pestañas).
// Los handlers leen `outputs` en el momento (`get`): el Svelte usaba `$outputs` / `currentOutput` ya actualizados al
// ejecutarse (por ejemplo, dentro del setTimeout de `setScreen`).
export interface ScreenDetailProps {
    outputId: string
    displays?: LayoutDisplay[]
    onRefreshDisplays?: () => void
}

type Tab = "hardware" | "cropping" | "sending"

const currentOf = (outputId: string): Partial<Output> => get(outputs)[outputId] || {}

export function ScreenDetail({ outputId, displays = [], onRefreshDisplays }: ScreenDetailProps) {
    const outputsValue = useFreshStore(outputs, clone)
    const stageShowsValue = useFreshStore(stageShows, clone)
    const dict = useStore(dictionary)
    const currentSettings = useStore(currentOutputSettings)

    const currentOutput: Partial<Output> = outputsValue[outputId] || {}
    const isStage = !!currentOutput.stageOutput || currentOutput.kind === "stage"
    const stageId = currentOutput.stageLayout || currentOutput.stageOutput || ""
    const typeOptions = [
        { value: "single", label: translateText("screen_config.single", dict) },
        { value: "mirror", label: translateText("screen_config.mirror", dict) },
        { value: "edge_blend", label: translateText("screen_config.edge_blend", dict) }
    ]
    const targetOptions = [
        { value: "full", label: translateText("screen_config.full", dict) },
        { value: "custom", label: translateText("screen_config.custom", dict) }
    ]
    const screenOptions = [{ value: "", label: translateText("screen_config.none", dict) }, ...displays.map((d) => ({ value: d.id?.toString() || (d.label as string), label: String(d.label || d.id) }))]
    const mirrorOptions = [
        { value: "", label: translateText("screen_config.choose", dict) },
        ...Object.entries(outputsValue)
            .filter(([id, o]) => id !== outputId && !(o.stageOutput || o.kind === "stage"))
            .map(([id, o]) => ({ value: id, label: o.name || id }))
    ]
    useEffect(() => {
        if (outputId && currentSettings !== outputId) currentOutputSettings.set(outputId)
    }, [outputId, currentSettings])

    const removable = canRemoveScreen(outputsValue, outputId)

    function removeScreen() {
        if (!canRemoveScreen(get(outputs), outputId)) return
        const next = nextScreenAfterRemove(get(outputs), outputId)
        const payload: RemoveScreenPayload = { id: outputId }
        // cierra la ventana nativa y olvida la escena; el historial borra la salida (deshacible)
        void invokeCommand("REMOVE_SCREEN", payload).then((result) => {
            if (!result.ok) console.error("[outputs] REMOVE_SCREEN falló:", result.error)
        })
        deleteAction({ id: "output", data: [{ id: outputId }] })
        if (next) currentOutputSettings.set(next)
    }

    function duplicateScreen() {
        duplicate({ id: "output", data: [{ id: outputId }] })
    }

    function setStageLayout(id: string) {
        outputs.update((a) => {
            if (a[outputId]) {
                a[outputId].stageLayout = id
                a[outputId].stageOutput = id
            }
            return a
        })
    }
    function editStage() {
        activeStage.set({ id: stageId, items: [] })
        activePage.set("stage")
        activePopup.set(null)
    }

    function setOutputValue(key: string, value: unknown) {
        outputs.update((a) => {
            if (a[outputId]) (a[outputId] as unknown as Record<string, unknown>)[key] = value
            return a
        })
    }
    function setForcedResolution(side: "width" | "height", value: number | null) {
        outputs.update((a) => {
            const out = a[outputId]
            if (!out) return a
            const res = { width: out.forcedResolution?.width || 0, height: out.forcedResolution?.height || 0, [side]: Number(value) || 0 }
            if (!res.width || !res.height) delete out.forcedResolution
            else out.forcedResolution = res
            return a
        })
    }

    const [activeTab, setActiveTab] = useState<Tab>("hardware")

    // `on:change` nativo (al confirmar, no por tecla): el valor del DOM sigue al store como `value={...}` de Svelte
    const nameInput = useRef<HTMLInputElement>(null)
    function rename(e: Event) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].name = (e.target as HTMLInputElement).value
            return a
        })
    }
    const latestRename = useRef(rename)
    useEffect(() => {
        latestRename.current = rename
    })
    useEffect(() => {
        const el = nameInput.current
        if (!el) return
        const onChange = (e: Event) => latestRename.current(e)
        el.addEventListener("change", onChange)
        return () => el.removeEventListener("change", onChange)
    }, [])
    const name = currentOutput.name || ""
    useEffect(() => {
        if (nameInput.current && nameInput.current.value !== name) nameInput.current.value = name
    }, [name])

    function toggleAlwaysOnTop(checked: boolean) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].alwaysOnTop = checked
            return a
        })
    }

    function setScreen(disp: LayoutDisplay) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            a[outputId].screen = disp.id?.toString() || null
            a[outputId].bounds = { x: disp.bounds.x, y: disp.bounds.y, width: disp.bounds.width, height: disp.bounds.height }
            a[outputId].display = { ...(a[outputId].display || {}), screen: a[outputId].screen, bounds: a[outputId].bounds }
            return a
        })
        setTimeout(() => {
            toggleOutputs([outputId], { state: true })
            send(OUTPUT, ["UPDATE_BOUNDS"], { id: outputId, ...currentOf(outputId) })
        }, 50)
    }

    function setOutputScreen(val: string) {
        const disp = displays.find((d) => d.id?.toString() === val || d.label === val)
        if (disp) setScreen(disp)
        else
            outputs.update((a) => {
                const o = a[outputId]
                if (o) {
                    o.screen = val || null
                    if (o.display) o.display.screen = o.screen
                }
                return a
            })
    }

    function setBounds(key: "x" | "y" | "width" | "height", value: number | null) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId].bounds[key] = Number(value)
            return a
        })
    }

    function toggleEnabled() {
        const current = currentOf(outputId)
        toggleOutputs([outputId], { state: !(current.enabled && current.active) })
    }

    // cropping
    const cropping: Partial<Record<string, number>> = clone(currentOutput.cropping || {})
    function updateCropping(value: string | number | null, side: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (!a[outputId].cropping) a[outputId].cropping = { top: 0, right: 0, bottom: 0, left: 0 }
            ;(a[outputId].cropping as unknown as Record<string, number>)[side] = Number(value)
            return a
        })
    }

    // aspect ratio (stored on output as aspectRatio like spec)
    const aspectOptions = [
        { value: "", label: translateText("screen_config.original", dict) },
        { value: "16:9", label: "16:9" },
        { value: "4:3", label: "4:3" },
        { value: "16:10", label: "16:10" },
        { value: "9:16", label: "9:16" }
    ]
    const aspectValue = currentOutput.aspectRatio ? `${currentOutput.aspectRatio.width}:${currentOutput.aspectRatio.height}` : ""
    function setAspectRatio(val: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (val === "") delete a[outputId].aspectRatio
            else a[outputId].aspectRatio = { width: Number(val.split(":")[0]) || 16, height: Number(val.split(":")[1]) || 9 }
            return a
        })
    }

    // edge blend
    const blending: Partial<NonNullable<Output["blending"]>> = currentOutput.blending || {}
    function updateBlending(value: string | number | null, side: string) {
        outputs.update((a) => {
            if (!a[outputId]) return a
            if (!a[outputId].blending) a[outputId].blending = { left: 0, right: 0, rotate: 90, opacity: 50, centered: false, offset: 0 }
            ;(a[outputId].blending as unknown as Record<string, number>)[side] = Number(value)
            return a
        })
    }

    function setSending(key: "ndi" | "omt" | "blackmagic" | "webrtc" | "rtmp", checked: boolean) {
        outputs.update((a) => {
            if (a[outputId]) a[outputId][key] = checked
            return a
        })
    }

    const width = currentOutput.bounds?.width || 0
    const height = currentOutput.bounds?.height || 0
    const ratio = (currentOutput.bounds?.width || 16) / (currentOutput.bounds?.height || 9)

    return (
        <>
            <div className={styles.header}>
                <input ref={nameInput} className={styles["name-input"]} defaultValue={name} />
                <div className={styles.res}>
                    {width} × {height}
                </div>
                <ToggleField label="settings.always_on_top" checked={currentOutput.alwaysOnTop !== false} defaultValue={true} onChange={toggleAlwaysOnTop} />
                <Button variant="ghost" size="icon-sm" icon="duplicate" iconSize={0.9} title="actions.duplicate" onNativeClick={duplicateScreen} />
                <Button variant="ghost" size="icon-sm" icon="delete" iconSize={0.9} title="actions.delete" disabled={!removable} onNativeClick={removeScreen} />
            </div>

            {!isStage ? (
                <>
                    <div className={styles.row}>
                        <SelectField label="screen_config.type" value={currentOutput.screenType || "single"} options={typeOptions} onChange={(value) => setOutputValue("screenType", value)} />
                    </div>
                    {currentOutput.screenType === "mirror" ? (
                        <div className={styles.row}>
                            <SelectField label="screen_config.mirror_of" value={currentOutput.mirrorOf || ""} options={mirrorOptions} onChange={(value) => setOutputValue("mirrorOf", value || undefined)} />
                        </div>
                    ) : null}
                </>
            ) : (
                <div className={styles.row}>
                    <PopupField label="stage.stage_layout" value={stageId} name={stageShowsValue[stageId]?.name ?? ""} icon="stage" popupId="select_stage_layout" onChange={(value) => setStageLayout(value as string)} />
                    {stageShowsValue[stageId] ? <Button title="titlebar.edit" icon="edit" onClick={() => editStage()} /> : null}
                </div>
            )}

            <div className={styles.canvas}>
                <div className={styles["canvas-title"]}>{translateText("screen_config.monitors")}</div>
                <DisplayLayout displays={displays} width={620} height={240} fill assignedId={currentOutput.screen || currentOutput.display?.screen || null} onSelect={setScreen} />
                <div className={styles["canvas-info"]}>
                    {currentOutput.screen ? (
                        <span>
                            {translateText("screen_config.assigned")}: {currentOutput.screen}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className={styles.tabs}>
                <Button variant="ghost" size="sm" isActive={activeTab === "hardware"} onNativeClick={() => setActiveTab("hardware")}>
                    {translateText("screen_config.hardware")}
                </Button>
                <Button variant="ghost" size="sm" isActive={activeTab === "cropping"} onNativeClick={() => setActiveTab("cropping")}>
                    {translateText("screen_config.cropping")}
                </Button>
                <Button variant="ghost" size="sm" isActive={activeTab === "sending"} onNativeClick={() => setActiveTab("sending")}>
                    {translateText("screen_config.sending")}
                </Button>
            </div>

            {activeTab === "hardware" ? (
                <div className={styles["tab-panel"]}>
                    <div className={styles.row}>
                        <SelectField label="screen_config.output" value={currentOutput.screen || currentOutput.display?.screen || ""} options={screenOptions} onChange={(value) => setOutputScreen(value as string)} />
                    </div>
                    <div className={styles.row}>
                        <SelectField label="screen_config.target" value={currentOutput.target || "full"} options={targetOptions} onChange={(value) => setOutputValue("target", value)} />
                    </div>
                    {currentOutput.target === "custom" ? (
                        <div className={styles.row}>
                            <NumberField label="X" value={currentOutput.bounds?.x || 0} min={null} onChange={(value) => setBounds("x", value)} />
                            <NumberField label="Y" value={currentOutput.bounds?.y || 0} min={null} onChange={(value) => setBounds("y", value)} />
                            <NumberField label="screen.width" value={currentOutput.bounds?.width || 0} onChange={(value) => setBounds("width", value)} />
                            <NumberField label="screen.height" value={currentOutput.bounds?.height || 0} onChange={(value) => setBounds("height", value)} />
                        </div>
                    ) : null}
                    <div className={styles["info-box"]}>
                        <div>
                            {translateText("screen_config.info_name")}: {currentOutput.name || outputId}
                        </div>
                        <div>
                            {translateText("screen_config.info_size")}: {width} × {height}
                        </div>
                        <div>
                            {translateText("screen_config.aspect_ratio")}: {ratio.toFixed(2)}
                            {Math.abs(ratio - 16 / 9) < 0.01 ? " (16:9)" : ""}
                        </div>
                    </div>
                    <div className={styles.actions}>
                        <Button onClick={() => onRefreshDisplays?.()}>{translateText("screen_config.identify")}</Button>
                        <Button onClick={() => toggleEnabled()}>{translateText(currentOutput.enabled && currentOutput.active ? "screen_config.turn_off" : "screen_config.turn_on")}</Button>
                    </div>
                    <ToggleField label="settings.invisible_window" checked={!!currentOutput.invisible} defaultValue={false} onChange={(checked) => setOutputValue("invisible", checked)} />
                    <ToggleField label="settings.transparent" checked={!!currentOutput.transparent} defaultValue={false} onChange={(checked) => setOutputValue("transparent", checked)} />
                    <ToggleField label="context.hide_from_preview" checked={!!currentOutput.hideFromPreview} defaultValue={false} onChange={(checked) => setOutputValue("hideFromPreview", checked)} />
                    <ColorField label="edit.color" value={currentOutput.color || "#F0008C"} defaultValue="#F0008C" onChange={(value) => setOutputValue("color", value)} />
                    <div className={styles.label}>{translateText("settings.resolution")}</div>
                    <NumberField label="screen.width" value={currentOutput.forcedResolution?.width || 0} defaultValue={0} max={8192} onChange={(value) => setForcedResolution("width", value)} />
                    <NumberField label="screen.height" value={currentOutput.forcedResolution?.height || 0} defaultValue={0} max={8192} onChange={(value) => setForcedResolution("height", value)} />
                </div>
            ) : activeTab === "cropping" ? (
                <div className={styles["tab-panel"]}>
                    {!isStage ? (
                        <div className={styles.row}>
                            <SelectField label="screen_config.aspect_ratio" value={aspectValue} options={aspectOptions} onChange={(value) => setAspectRatio(value as string)} />
                        </div>
                    ) : null}
                    <div className={styles.row}>
                        <div className={styles.label}>{translateText("screen_config.cropping")}</div>
                        <div style={{ flex: 1, display: "flex", gap: "4px" }}>
                            <NumberField label="screen_config.top" value={cropping.top || 0} onChange={(value) => updateCropping(value, "top")} />
                            <NumberField label="screen_config.right" value={cropping.right || 0} onChange={(value) => updateCropping(value, "right")} />
                            <NumberField label="screen_config.bottom" value={cropping.bottom || 0} onChange={(value) => updateCropping(value, "bottom")} />
                            <NumberField label="screen_config.left" value={cropping.left || 0} onChange={(value) => updateCropping(value, "left")} />
                        </div>
                    </div>
                    {!isStage && currentOutput.screenType === "edge_blend" ? (
                        <div className={styles.row}>
                            <div className={styles.label}>Edge blend</div>
                            <div style={{ flex: 1, display: "flex", gap: "4px" }}>
                                <NumberField label="screen_config.left" value={blending.left || 0} onChange={(value) => updateBlending(value, "left")} />
                                <NumberField label="screen_config.right" value={blending.right || 0} onChange={(value) => updateBlending(value, "right")} />
                                <NumberField label="screen_config.rotation" value={blending.rotate ?? 90} onChange={(value) => updateBlending(value, "rotate")} />
                                <NumberField label="screen_config.opacity" value={blending.opacity ?? 50} onChange={(value) => updateBlending(value, "opacity")} />
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className={cn(styles["tab-panel"], styles.scroll)}>
                    {(["ndi", "omt", "blackmagic", "webrtc", "rtmp"] as const).map((key) => {
                        const label = { ndi: "NDI", omt: "OMT", blackmagic: "Blackmagic", webrtc: "WebRTC", rtmp: "RTMP" }[key]
                        return (
                            <div key={key} className={styles.section}>
                                <div className={styles["section-title"]}>{label}</div>
                                <ToggleField label={label} checked={!!currentOutput[key]} defaultValue={false} onChange={(checked) => setSending(key, checked)} />
                            </div>
                        )
                    })}
                    <ScreenOutputOptions />
                </div>
            )}
        </>
    )
}
