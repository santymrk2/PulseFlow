import type { Input } from "../../../types/Input"
import MidiValues from "../actions/MidiValues.svelte"
import RestValues from "../actions/RestValues.svelte"
import ColorField from "../../lib/components/ui/color-field/color-field.svelte"
import ColorsField from "../../lib/components/ui/colors-field/colors-field.svelte"
import DateField from "../../lib/components/ui/date-field/date-field.svelte"
import SelectField from "../../lib/components/ui/select-field/select-field.svelte"
import NumberField from "../../lib/components/ui/number-field/number-field.svelte"
import TextField from "../../lib/components/ui/text-field/text-field.svelte"
import TimeField from "../../lib/components/ui/time-field/time-field.svelte"

// [DEFAULT] IN: value= OUT=on:change
export const commonInputs = {
    // eslint-disable-next-line
    string: TextField,
    number: NumberField,
    dropdown: SelectField,
    color: ColorField,
    colors: ColorsField,
    date: DateField,
    time: TimeField,

    midi: MidiValues,
    rest: RestValues
}

// get values

export function getValues(inputs: Input[], data: object) {
    if (!Array.isArray(inputs)) return []

    inputs = inputs.map((input) => {
        if (!input.id) return { ...input, value: data || input.value }

        const keys = input.id.includes(".") ? input.id.split(".") : [input.id]
        let value = data?.[keys[0]]
        if (keys.length > 1) value = value?.[keys[1]]

        if (value === undefined) return input
        return { ...input, value }
    })

    return inputs
}
