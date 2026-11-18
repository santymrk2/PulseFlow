import type { Input as TInput } from "../../../types/Input"
import { clone } from "../../components/helpers/array"
import { HRule } from "../ui/h-rule/HRule"
import { FormInput } from "./FormInput"

export interface FormInputsProps {
    inputs: TInput[]
    title?: string
    onChange?: (value: TInput) => void
}

export function FormInputs({ inputs, title = "", onChange }: FormInputsProps) {
    function changed(value: unknown, input: TInput) {
        onChange?.(clone({ ...input, value }) as TInput)
    }

    return (
        <>
            {title ? <HRule title={title} /> : null}
            {inputs.map((input, index) => {
                if (!input?.type) return null
                return <FormInput key={(input as { id?: string }).id || input.name || index} input={input} onChange={(v) => changed(v, input)} />
            })}
        </>
    )
}
