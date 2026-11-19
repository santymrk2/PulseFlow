import { act } from "@testing-library/react"

// Doble de los campos del kit (SelectField, NumberField, TextField…) para tests de popups: registra las props de cada campo por `label`
// y el test dispara sus callbacks con `fire`. Así se prueba lo que el popup hace con el valor, no el campo.
type Handler = (...args: never[]) => void
export type FieldProps = { label: string; id?: string; [key: string]: unknown }

export const fields: Record<string, FieldProps> = {}

export function FieldMock(props: FieldProps) {
    fields[props.label] = props
    return <div data-field={props.label} data-value={String(props.value ?? props.checked ?? "")} />
}

export const fire = (label: string, handler: string, ...args: unknown[]) =>
    act(() => {
        const fn = fields[label]?.[handler] as Handler | undefined
        if (!fn) throw new Error(`El campo "${label}" no tiene ${handler}`)
        fn(...(args as never[]))
    })

export const clearFields = () => Object.keys(fields).forEach((key) => delete fields[key])
