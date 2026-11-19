import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { initializeMetadata } from "../../shared/utils/helpers/show"
import { customMetadata } from "../../shared/core/stores"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { TextField } from "../ui/text-field/TextField"

// Port de components/main/popups/ManageMetadata.svelte. Lee customMetadata ({ disabled, custom }) al montar (copias locales) y los campos por defecto de
// initializeMetadata({}). Escribe customMetadata = { ...customMetadata, disabled } o { ...customMetadata, custom } en cada cambio (alternar campo, editar / borrar / agregar nombre).
// El Svelte mutaba por alias los dos arrays del store antes de volver a asignarlos: las copias locales no tienen efecto observable (el store recibe el mismo contenido).
// Sin key en el original: se usa la posición. Los `null` de TextField (sólo con defaultValue) son inalcanzables: se usa `?? ""` sólo por el tipo.
const defaultMetadata = Object.keys(initializeMetadata({}))

export function ManageMetadata() {
    const [customMetadataValues, setCustomMetadataValues] = useState<string[]>(() => [...get(customMetadata).custom])
    const [hidden, setHidden] = useState<string[]>(() => [...get(customMetadata).disabled])

    const emptyEntry = customMetadataValues.find((a) => a === "") !== undefined

    function toggleHidden(key: string) {
        const next = hidden.includes(key) ? hidden.filter((a) => a !== key) : [...hidden, key]

        setHidden(next)
        customMetadata.set({ ...get(customMetadata), disabled: next })
    }

    function saveCustom(next: string[]) {
        setCustomMetadataValues(next)
        customMetadata.set({ ...get(customMetadata), custom: next })
    }

    function updateCustom(name: string, value: string) {
        const index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        saveCustom(customMetadataValues.map((a, i) => (i === index ? value : a)))
    }

    function removeCustom(name: string) {
        const index = customMetadataValues.findIndex((a) => a === name)
        if (index < 0) return

        saveCustom(customMetadataValues.filter((_, i) => i !== index))
    }

    function addCustom() {
        if (emptyEntry) return

        saveCustom([...customMetadataValues, ""])
    }

    return (
        <>
            <div>
                {defaultMetadata.map((key) => (
                    <CheckboxField key={key} label={`meta.${key}`} checked={!hidden.includes(key)} onChange={() => toggleHidden(key)} />
                ))}
            </div>

            <HRule title="sort.custom" />

            {customMetadataValues.map((name, i) => (
                <InputRow key={i}>
                    <TextField label="inputs.name" value={name} onChange={(value) => updateCustom(name, value ?? "")} autofocus={!name} />
                    <Button icon="delete" onClick={() => removeCustom(name)} white />
                </InputRow>
            ))}

            <Button icon="add" variant="outline" style={{ width: "100%" }} disabled={emptyEntry} onClick={addCustom}>
                <T id="settings.add" />
            </Button>
        </>
    )
}
