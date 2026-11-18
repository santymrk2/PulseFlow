import type { Input } from "../../../types/Input"

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
