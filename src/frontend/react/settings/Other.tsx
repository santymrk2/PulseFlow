import { useEffect, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../IPC/main"
import { activePopup, alertMessage, special } from "../../stores"
import { translateText } from "../../utils/language"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { SelectField } from "../ui/select-field/SelectField"
import { ToggleField } from "../ui/toggle-field/ToggleField"

// Port de components/settings/tabs/Other.svelte (F24.12)
function updateSpecial(value: unknown, key: string) {
    special.update((a) => {
        if (!value) delete a[key]
        else a[key] = value

        return a
    })
}

function askRestart() {
    alertMessage.set("settings.restart_for_change")
    activePopup.set("alert")
}

export function Other() {
    const specialValue = useStore(special)

    const [autoErrorReporting, setAutoErrorReporting] = useState(true)
    const [disableHardwareAcceleration, setDisableHardwareAcceleration] = useState(false)
    // graphics device (multi-GPU; applied at next launch — see electron utils/gpu.ts)
    const [graphicsDevice, setGraphicsDevice] = useState("")
    const [graphicsDeviceOptions, setGraphicsDeviceOptions] = useState<{ value: string; label: string }[]>([])
    const [graphicsDeviceSupported, setGraphicsDeviceSupported] = useState(false)

    useEffect(() => {
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "autoErrorReporting" }, (value) => {
            setAutoErrorReporting(value !== false)
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, (value) => {
            setDisableHardwareAcceleration(!!value)
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "graphicsDevice" }, (value) => {
            setGraphicsDevice((value as string) || "")
        })
        // Only shown when platform supports multi-GPU selection (e.g. Linux DRM nodes, macOS power preference)
        requestMain(Main.GET_GRAPHICS_DEVICES, undefined, (devices) => {
            setGraphicsDeviceOptions([{ value: "", label: translateText("settings.auto") }, ...(devices || []).map((d) => ({ value: d.value, label: d.label || translateText(d.value === "high-performance" ? "settings.gpu_high_performance" : "settings.gpu_low_power") }))])
            setGraphicsDeviceSupported((devices || []).length > 0)
        })
    }, [])

    // auto error reporting
    function toggleAutoErrorReporting(checked: boolean) {
        setAutoErrorReporting(checked)
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "autoErrorReporting", value: checked })
        askRestart()
    }

    // hardware acceleration
    function toggleHardwareAcceleration(checked: boolean) {
        setDisableHardwareAcceleration(checked)
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration", value: checked })
        askRestart()
    }

    function changeGraphicsDevice(value: string | null) {
        const device = value || ""
        setGraphicsDevice(device)
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "graphicsDevice", value: device || null })
        askRestart()
    }

    return (
        <>
            <Button variant="outline" style={{ width: "100%", marginBottom: "20px" }} icon="loop" onClick={() => activePopup.set("update_manager")}>
                <T id="about.check_updates" />
                {/* <T id="popup.update_manager" /> */}
            </Button>

            <ToggleField label="settings.popup_before_close" checked={specialValue.showClosePopup || false} defaultValue={false} onChange={(checked) => updateSpecial(checked, "showClosePopup")} />

            <ToggleField label="settings.auto_error_reporting" checked={autoErrorReporting} defaultValue={true} onChange={toggleAutoErrorReporting} />

            <ToggleField label="settings.disable_hardware_acceleration" checked={disableHardwareAcceleration} defaultValue={false} onChange={toggleHardwareAcceleration} />

            {graphicsDeviceSupported ? <SelectField label="settings.graphics_device" value={graphicsDevice} defaultValue="" options={graphicsDeviceOptions} onChange={changeGraphicsDevice} /> : null}

            {/* Optimized mode is enabled automatically based on the memory usage */}
            {/* "optimized_mode": "Optimized mode" */}
            {/* <ToggleField label="settings.optimized_mode" checked={$special.optimizedMode} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "optimizedMode")} /> */}
        </>
    )
}
