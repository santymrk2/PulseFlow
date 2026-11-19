import { useEffect, useMemo } from "react"
import { outputs, styles } from "../../../shared/core/stores"
import { newToast } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { SelectField } from "../../ui/select-field/SelectField"
import { useStore } from "../../hooks/useStore"
import type { API_output_style } from "../../../components/actions/api"

type StyleOutputs = { type: string; outputs?: { [key: string]: string } }

export interface ChooseStyleProps {
    value: API_output_style & { styleOutputs?: StyleOutputs }
    onChange?: (value: API_output_style & { styleOutputs?: StyleOutputs }) => void
}

function getList<T extends Record<string, unknown>>(list: Record<string, T>) {
    return sortByName(keysToID(list) as Array<T & { id: string; name?: string }>)
}

export function ChooseStyle({ value, onChange }: ChooseStyleProps) {
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)

    const styleId = (value as { outputStyle?: string })?.outputStyle || ""
    const styleOutputs = value?.styleOutputs || { type: "active" }

    useEffect(() => {
        if (!Object.keys(currentStyles).length) newToast("toast.empty_styles")
    }, [currentStyles])

    const outputsOptions = useMemo(
        () => [
            { value: "active", label: translateText("actions.active_outputs") },
            { value: "all", label: translateText("actions.all_outputs") },
            { value: "specific", label: translateText("actions.specific_outputs") }
        ],
        []
    )

    const outputsList = useMemo(() => getList(currentOutputs as unknown as never).filter((a) => !(a as { stageOutput?: boolean }).stageOutput), [currentOutputs])
    const stylesList = useMemo(() => getList(currentStyles as unknown as never).map((a) => ({ value: a.id, label: (a as { name?: string }).name || "" })), [currentStyles])

    function updateStyle(key: "outputStyle" | "styleOutputs", newValue: unknown) {
        const next = { ...value, [key]: newValue } as API_output_style & { styleOutputs?: StyleOutputs }
        onChange?.(next)
    }

    function setOutputStyle(outputId: string, nextStyleId: string | null) {
        const newOutputs = { ...(styleOutputs.outputs || {}) } as { [key: string]: string }
        if (nextStyleId) newOutputs[outputId] = nextStyleId
        else delete newOutputs[outputId]
        updateStyle("styleOutputs", { type: "specific", outputs: newOutputs })
    }

    return (
        <>
            <SelectField label="settings.display_settings" options={outputsOptions} value={styleOutputs.type} onChange={(v) => updateStyle("styleOutputs", { type: v ?? "active", outputs: styleOutputs.outputs || {} })} />
            {styleOutputs.type === "specific" ? (
                outputsList.map((output) => (
                    <SelectField key={output.id} label={(output as { name?: string }).name || ""} options={stylesList} value={(styleOutputs.outputs || {})[output.id]} onChange={(v) => setOutputStyle(output.id, v)} allowEmpty />
                ))
            ) : (
                <SelectField label="edit.style" options={stylesList} value={styleId} onChange={(v) => updateStyle("outputStyle", v ?? "")} allowEmpty />
            )}
        </>
    )
}
