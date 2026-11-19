import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import type { API_rest_command } from "./logic/api"

export interface RestValuesProps {
    value: API_rest_command
    emitter?: boolean
    onChange?: (value: API_rest_command) => void
}

const dropdownInputs = [
    { value: "GET", label: "GET" },
    { value: "POST", label: "POST" },
    { value: "PUT", label: "PUT" },
    { value: "DELETE", label: "DELETE" }
]

export function RestValues({ value, emitter = false, onChange }: RestValuesProps) {
    const rest = value || ({} as API_rest_command)

    function change(next: API_rest_command) {
        onChange?.(next)
    }

    return (
        <>
            <TextField label="inputs.url" value={rest.url || ""} placeholder="127.0.0.1" onChange={(v) => change({ ...rest, url: v ?? "" })} />
            <InputRow>
                <SelectField label="inputs.method" value={rest.method || "GET"} options={dropdownInputs} onChange={(v) => change({ ...rest, method: (v ?? "GET") as API_rest_command["method"] })} />
                <TextField label="inputs.contentType" disabled={emitter} value={rest.contentType || "application/json"} placeholder="application/json" onChange={(v) => change({ ...rest, contentType: v ?? "" })} />
            </InputRow>
            {!emitter ? <TextField label="inputs.payload" disabled={emitter} value={rest.payload || ""} placeholder={"{}"} onChange={(v) => change({ ...rest, payload: v ?? "" })} /> : null}
        </>
    )
}
