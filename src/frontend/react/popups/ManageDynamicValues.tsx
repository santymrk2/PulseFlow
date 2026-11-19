import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { clone } from "../../components/helpers/array"
import { special } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { T } from "../helpers/T"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { FileField } from "../ui/file-field/FileField"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"

// Port de components/main/popups/ManageDynamicValues.svelte. Lee special.disabledDynamicValues (al montar, copia local), special.dynamicRSS y special.dynamicTXT.
// Escribe special: disabledDynamicValues (alternar sección), dynamicRSS y dynamicTXT (agregar con el valor por defecto, borrar por índice, editar una clave; se muta en el
// lugar y se re-emite, como el Svelte). El Svelte mutaba el array `disabledDynamicValues` del store por alias antes de reasignarlo: la copia local no tiene efecto observable.
// Se omiten `openedMenus` / `openedTxtMenus` (y sus toggles): el Svelte nunca los pasaba a InputRow, no hacían nada.
// Los `null` de TextField/SelectField/NumberField (sólo con defaultValue, que acá no se pasa) son inalcanzables: se usa `?? ""` o se ignoran sólo por el tipo.
interface Rss {
    name: string
    url: string
    count: number
    divider?: string
    updateInterval?: string
}
interface Txt {
    name: string
    url: string
    divider?: string
    updateInterval?: string
}
interface DynamicLists {
    dynamicRSS: Rss[]
    dynamicTXT: Txt[]
}

const DEFAULT_RSS: Rss = { name: "", url: "", count: 5 }
const DEFAULT_TXT: Txt = { name: "", url: "", updateInterval: "3" }

const alwaysEnabledIds = ["time", "show", "$"]
const toggleSections = ["time", "project", "show", "slide_text", "video", "audio", "meta", "timer", "rss", "txt", "$"]
const sectionTitles: Record<string, string> = {
    time: "timer.time",
    project: "guide_title.project",
    show: "guide_title.show",
    slide_text: "edit.text",
    video: "edit.video",
    audio: "tools.audio",
    meta: "tools.metadata",
    timer: "items.timer",
    rss: "settings.rss",
    txt: "settings.txt",
    $: "items.variable"
}

// Las listas se editan en el lugar dentro del store: cada emisión entrega copias para que el Compiler vea el cambio
function copyLists(value: Partial<DynamicLists>): DynamicLists {
    return { dynamicRSS: (value.dynamicRSS || []).map((a) => ({ ...a })), dynamicTXT: (value.dynamicTXT || []).map((a) => ({ ...a })) }
}

function createIntervals(values: string[][]) {
    return values.map(([value, text]) => ({ value, label: translateText(text) }))
}

export function ManageDynamicValues() {
    const lists: DynamicLists = useFreshStore<DynamicLists>(special, copyLists)
    const { dynamicRSS: rssList, dynamicTXT: txtList } = lists
    const [hidden, setHidden] = useState<string[]>(() => [...(get(special).disabledDynamicValues || [])])
    const [updateIntervalList] = useState(() =>
        createIntervals([
            ["5", "5 settings.minutes"],
            ["10", "10 settings.minutes"],
            ["15", "15 settings.minutes"],
            ["30", "30 settings.minutes"],
            ["60", "60 settings.minutes"],
            ["120", "120 settings.minutes"],
            ["240", "240 settings.minutes"]
        ])
    )
    const [txtUpdateIntervalList] = useState(() =>
        createIntervals([
            ["1", "1 timer.seconds"],
            ["3", "3 timer.seconds"],
            ["5", "5 timer.seconds"],
            ["10", "10 timer.seconds"],
            ["30", "30 timer.seconds"],
            ["60", "1 settings.minutes"],
            ["300", "5 settings.minutes"]
        ])
    )

    function toggleHidden(key: string) {
        const next = hidden.includes(key) ? hidden.filter((a) => a !== key) : [...hidden, key]

        setHidden(next)
        special.update((a) => {
            a.disabledDynamicValues = next
            return a
        })
    }

    // RSS

    function addRSS() {
        special.update((a) => {
            if (!a.dynamicRSS) a.dynamicRSS = []
            a.dynamicRSS.push(clone(DEFAULT_RSS))
            return a
        })
    }

    function deleteItem(index: number) {
        special.update((a) => {
            if (!a.dynamicRSS) return a
            a.dynamicRSS.splice(index, 1)
            return a
        })
    }

    function setValue<K extends keyof Rss>(index: number, key: K, value: Rss[K]) {
        special.update((a) => {
            if (!a.dynamicRSS?.[index]) return a

            a.dynamicRSS[index][key] = value
            return a
        })
    }

    // TXT

    function addTXT() {
        special.update((a) => {
            if (!a.dynamicTXT) a.dynamicTXT = []
            a.dynamicTXT.push(clone(DEFAULT_TXT))
            return a
        })
    }

    function deleteTxtItem(index: number) {
        special.update((a) => {
            if (!a.dynamicTXT) return a
            a.dynamicTXT.splice(index, 1)
            return a
        })
    }

    function setTxtValue<K extends keyof Txt>(index: number, key: K, value: Txt[K]) {
        special.update((a) => {
            if (!a.dynamicTXT?.[index]) return a

            a.dynamicTXT[index][key] = value
            return a
        })
    }

    return (
        <>
            <div>
                {toggleSections.map((section) => {
                    const alwaysEnabled = alwaysEnabledIds.includes(section)
                    const alwaysDisabled = (section === "rss" && !rssList.length) || (section === "txt" && !txtList.length)

                    return <CheckboxField key={section} label={sectionTitles[section]} disabled={alwaysEnabled || alwaysDisabled} checked={alwaysDisabled ? false : alwaysEnabled || !hidden.includes(section)} onChange={() => toggleHidden(section)} />
                })}
            </div>

            <HRule title="settings.rss" />

            {rssList.map((rss, i) => (
                <InputRow
                    key={i}
                    arrow
                    menu={
                        <>
                            <InputRow>
                                <TextField style={{ width: "75%" }} label="inputs.url" value={rss.url} onChange={(value) => setValue(i, "url", value ?? "")} />
                                <TextField style={{ width: "25%" }} label="meta.text_divider" value={rss.divider || " | "} onChange={(value) => setValue(i, "divider", value ?? "")} />
                            </InputRow>

                            <InputRow>
                                <SelectField style={{ width: "75%" }} label="edit.interval" options={updateIntervalList} value={rss.updateInterval || "60"} onChange={(value) => setValue(i, "updateInterval", value ?? "")} />
                                <NumberField
                                    style={{ width: "25%" }}
                                    label="edit.count"
                                    value={rss.count || 5}
                                    min={1}
                                    max={1000}
                                    onChange={(value) => {
                                        if (value !== null) setValue(i, "count", value)
                                    }}
                                />
                            </InputRow>
                        </>
                    }
                >
                    <TextField label="inputs.name" value={rss.name} disabled={!!(rss.name && rss.url)} onChange={(value) => setValue(i, "name", value ?? "")} />

                    <Button icon="delete" title="actions.delete" onClick={() => deleteItem(i)} white />
                </InputRow>
            ))}

            <Button variant="outline" icon="add" onClick={addRSS}>
                <T id="settings.add" />
            </Button>

            <HRule title="settings.txt" />

            {txtList.map((txt, i) => (
                <InputRow
                    key={i}
                    arrow
                    menu={
                        <>
                            <InputRow>
                                <TextField style={{ flex: 1 }} label="inputs.url" value={txt.url} onChange={(value) => setTxtValue(i, "url", value ?? "")} />
                                <FileField
                                    style={{ flex: 0 }}
                                    label=""
                                    title="scripture.local"
                                    value=""
                                    filter={{ name: "Text files", extensions: ["txt"] }}
                                    icon="folder"
                                    onChange={(value) => {
                                        // sin `multiple` el campo entrega una sola ruta
                                        if (typeof value === "string") setTxtValue(i, "url", value)
                                    }}
                                    noLabel
                                />
                            </InputRow>

                            <InputRow>
                                <SelectField style={{ width: "75%" }} label="edit.interval" options={txtUpdateIntervalList} value={txt.updateInterval || "3"} onChange={(value) => setTxtValue(i, "updateInterval", value ?? "")} />
                                <TextField style={{ width: "25%" }} label="meta.text_divider" value={txt.divider || "<br>"} onChange={(value) => setTxtValue(i, "divider", value ?? "")} />
                            </InputRow>
                        </>
                    }
                >
                    <TextField label="inputs.name" value={txt.name} disabled={!!(txt.name && txt.url)} onChange={(value) => setTxtValue(i, "name", value ?? "")} />

                    <Button icon="delete" title="actions.delete" onClick={() => deleteTxtItem(i)} white />
                </InputRow>
            ))}

            <Button variant="outline" icon="add" onClick={addTXT}>
                <T id="settings.add" />
            </Button>
        </>
    )
}
