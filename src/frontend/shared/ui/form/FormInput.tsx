// @ts-nocheck
import type { Input } from "../../../../types/Input"
import { activeEdit, activePage, activePopup, special } from "../../core/stores"
import { translateText } from "../../utils/language"
import { select } from "../../utils/helpers/select"
import { useStore } from "../hooks/useStore"
import { Button } from "../kit/button/Button"
import { CheckboxField } from "../kit/checkbox-field/CheckboxField"
import { ColorField } from "../kit/color-field/ColorField"
import { ColorsField } from "../kit/colors-field/ColorsField"
import { DateField } from "../kit/date-field/DateField"
import { NumberField } from "../kit/number-field/NumberField"
import { SelectField } from "../kit/select-field/SelectField"
import { TextField } from "../kit/text-field/TextField"
import { TimeField } from "../kit/time-field/TimeField"
import { MidiValues } from "../../../features/actions/MidiValues"
import { RestValues } from "../../../features/actions/RestValues"

type Loose = Record<string, unknown>

export interface FormInputProps {
    input: Input
    hasTimelineAction?: boolean
    onChange?: (value: unknown) => void
    onKeyframe?: (value: unknown) => void
}

export function FormInput({ input, hasTimelineAction = false, onChange, onKeyframe }: FormInputProps) {
    const currentSpecial = (useStore(special) || {}) as Loose
    const currentActivePage = useStore(activePage)
    const currentActiveEdit = (useStore(activeEdit) || {}) as Loose

    const inp = input as unknown as Loose
    const label = String(inp.label ?? inp.name ?? "")
    const enableKeyframe = !!(currentSpecial.slideTimelineActive && currentActivePage === "edit" && String(currentActiveEdit.type || "show") === "show")

    function changed(value: unknown) {
        onChange?.(value)
    }

    const inputType = String(inp.type || "")

    if (inputType === "dropdown") {
        const rawOptions = (inp.options as Array<{ label?: string; value?: string }> | undefined) || []
        const options = rawOptions.map((a) => ({ ...a, label: translateText(String(a.label || "")) }))
        return (
            <>
                <SelectField label={label} value={String(inp.value ?? "")} options={options as never} disabled={!!inp.disabled} onChange={(v) => changed(v)} />
                {label === "items.timer" && inp.value ? (
                    <Button
                        icon="edit"
                        onClick={() => {
                            select("timer", { id: String(inp.value) })
                            activePopup.set("timer")
                        }}
                    />
                ) : null}
            </>
        )
    }

    if (inputType === "checkbox") {
        return <CheckboxField label={label} checked={!!inp.value} style={inp.style ? ({ cssText: String(inp.style) } as never) : undefined} onChange={(v) => changed(v)} />
    }

    if (inputType === "color") {
        const settings = (inp.settings || {}) as Loose
        return <ColorField label={label} value={String(inp.value ?? "")} {...(settings as never)} onInput={(v) => changed(v)} />
    }

    const settings = (inp.settings || {}) as Loose
    const commonProps = { label, ...(inp as object), ...(settings as object), hasTimelineAction, enableKeyframe } as never

    if (inputType === "string") return <TextField value={String(inp.value ?? "")} {...commonProps} onChange={(v) => changed(v)} onInput={(v) => changed(v)} />
    if (inputType === "number") return <NumberField value={Number(inp.value ?? 0)} {...commonProps} onChange={(v) => changed(v)} onInput={(v) => changed(v)} onKeyframe={onKeyframe ? (v) => onKeyframe(v) : undefined} />
    if (inputType === "colors") return <ColorsField value={inp.value as never} {...commonProps} onChange={(v) => changed(v)} />
    if (inputType === "date") return <DateField value={String(inp.value ?? "")} {...commonProps} onChange={(v) => changed(v)} />
    if (inputType === "time") return <TimeField value={String(inp.value ?? "")} {...commonProps} onChange={(v) => changed(v)} />
    if (inputType === "midi") return <MidiValues value={inp.value as never} {...commonProps} onChange={(v) => changed(v)} />
    if (inputType === "rest") return <RestValues value={inp.value as never} {...commonProps} onChange={(v) => changed(v)} />

    return null
}
