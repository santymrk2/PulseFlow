import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { DropdownOptions } from "../../../types/Input"
import type { Popups } from "../../../types/Main"
import type { Template } from "../../../types/Show"
import { Card } from "../drawer/Card"
import { TemplateSlide } from "../drawer/pages/TemplateSlide"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { getResolution } from "../../shared/utils/helpers/output"
import { activePopup, activeStyle, drawerTabsData, outputs, popupData, previewOutputId, scriptures, styles, templates } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { setPopupSubmit } from "../../shared/utils/popup"
import { formatSearch } from "../../shared/utils/search"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Center } from "../../shared/ui/system/Center"
import { Button } from "../../shared/ui/kit/button/Button"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import stylesCSS from "./SelectTemplate.module.css"

// Port de components/main/popups/SelectTemplate.svelte. Lee: popupData (id, active, revert, allowEmpty, hideIds,
// trigger, doubleClick), templates, scriptures, styles, activeStyle, drawerTabsData, outputs y previewOutputId
// (resolución). Escribe: el trigger con { value, type } o value, popupData = {} 500 ms después (si no hay revert)
// y activePopup = revert o null. Enter registra la búsqueda con setPopupSubmit.
// Card y TemplateSlide son ports React. Al no pasar children se renderizan como hermanos.
interface TemplateItem extends Template {
    id: string
    __rawId?: string
}

const SCRIPTURE_IDS = ["scripture", "scripture_2", "scripture_3", "scripture_4", "scriptureLT", "scriptureLT_2"]

function scriptureTypes(): DropdownOptions {
    return [
        { value: "", label: translateText("example.default (1)") },
        { value: "_2", label: "2" },
        { value: "_3", label: "3" },
        { value: "_4", label: "4" }
    ]
}

export function SelectTemplate() {
    const templatesValue = useStore(templates)
    const popupDataValue = useStore(popupData)
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(styles)
    const previewOutputIdValue = useStore(previewOutputId)

    // Equivale a los `let revert/allowEmpty/id = $popupData...` del Svelte: se leen una vez al montar.
    const [revert] = useState(() => get(popupData).revert as string | undefined)
    const [allowEmpty] = useState(() => !!get(popupData).allowEmpty)
    const [id] = useState(() => (get(popupData).id || "") as string)

    const [types] = useState<DropdownOptions>(() => (id === "scripture" && Object.values(get(scriptures)).some((a) => a.collection) ? scriptureTypes() : []))
    const [values] = useState<string[]>(() => {
        if (id !== "scripture") return []
        const currentStyle = get(styles)[get(activeStyle)] as unknown as Record<string, string | undefined> | undefined
        return types.map((a) => currentStyle?.["templateScripture" + a.value] || "")
    })
    const customTypes = types.length > 1
    const [selectedType, setSelectedType] = useState(() => types[0]?.value || "")

    const active = (popupDataValue.active || "") as string
    const derivedValue = customTypes ? values[types.findIndex((a) => a.value === selectedType)] || "" : active
    // En Svelte `value` se sobreescribe al elegir; acá se guarda el override hasta que cambie el tipo/item activo.
    const [override, setOverride] = useState<{ active: boolean; value?: string }>({ active: false })
    const value = override.active ? override.value : derivedValue

    const hideIds = (popupDataValue.hideIds || []) as string[]
    const sortedTemplates = sortByName(
        keysToID(templatesValue)
            .map((a) => ({ ...a, __rawId: (templatesValue as Record<string, Template & { id?: string }>)[a.id]?.id ?? a.id }))
            .filter((a) => !hideIds.includes(a.id) && a?.settings?.mode !== "text")
    ) as TemplateItem[]
    const defaultTemplates = clone(sortedTemplates)
    const [searchValue, setSearchValue] = useState("")
    const [searchedTemplates, setSearchedTemplates] = useState<TemplateItem[]>(() => clone(defaultTemplates))

    const resolution = getResolution(null, { outputs: outputsValue, styles: stylesValue, previewOutputId: previewOutputIdValue })
    const normalTemplates = searchedTemplates.filter((a) => a.category !== "scripture")
    const scriptureTemplates = searchedTemplates.filter((a) => a.category === "scripture")
    const templatesList = id.includes("scripture") ? [...trimScriptureTemplates(scriptureTemplates), ...normalTemplates] : [...normalTemplates, ...scriptureTemplates]

    const [lazyLoader, setLazyLoader] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const submitRef = useRef<() => void>(() => {})

    function trimScriptureTemplates(list: TemplateItem[]) {
        let countId = ""
        if (id === "scripture") {
            countId = selectedType
        } else if (id === "scripture_drawer") {
            let count = 1
            const activeScripture = (get(drawerTabsData).scripture?.activeSubTab || "") as string
            const currentScripture = get(scriptures)[activeScripture]
            if (!currentScripture) return list
            if (currentScripture.collection?.versions?.length) count = currentScripture.collection.versions.length
            countId = count > 1 ? "_" + count : ""
        }

        // sólo se muestran las plantillas por defecto con el número correcto de versiones
        const keepId = "scripture" + countId
        const keepIdLT = "scriptureLT" + countId
        const toRemove = SCRIPTURE_IDS.filter((a) => a !== keepId && a !== keepIdLT)
        return list.filter((a) => {
            const rawId = a.__rawId ?? a.id
            return !toRemove.includes(rawId)
        })
    }

    function search(valueToSearch: string | null = null) {
        const next = formatSearch(valueToSearch || "")
        setSearchValue(next)

        if (next.length < 2) {
            setSearchedTemplates(clone(defaultTemplates))
            return
        }

        const currentTemplatesList = clone(defaultTemplates)
        setSearchedTemplates(currentTemplatesList.filter((a) => formatSearch(a.name || "").includes(next)))
    }

    // `$: if (defaultTemplates) search()` — al cambiar el catálogo se reinicia la búsqueda, como en el Svelte.
    useEffect(() => {
        search("")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templatesValue, hideIds.join(",")])

    useEffect(() => {
        setOverride({ active: false })
    }, [selectedType, active])

    // registerPopupSubmit: el registro es uno solo y la función estable lee siempre el último estado del formulario.
    useEffect(() => {
        submitRef.current = () => {
            if (!searchValue.length || !searchedTemplates.length) return
            selectTemplate(searchedTemplates[0], true)
        }
    })
    useEffect(() => setPopupSubmit(() => submitRef.current()), [])

    function selectTemplate(template: TemplateItem | string, keyboard = false) {
        // selectTemplate("") en Svelte hace `value = template.id` (undefined), por eso la opción "ninguno".
        const templateId = typeof template === "string" ? undefined : template.id
        const previousValue = value
        setOverride({ active: true, value: templateId })

        const data = get(popupData)
        if (data.trigger) {
            if (selectedType) data.trigger({ value: templateId, type: selectedType })
            else data.trigger(templateId)
        }

        setTimeout(() => {
            const dataNow = get(popupData)
            if (dataNow.doubleClick && !keyboard && previousValue !== templateId) return

            if (!revert) setTimeout(() => popupData.set({}), 500) // revert después de cerrar
            activePopup.set((revert || null) as Popups | null)
        }, 0)
    }

    // `$: if (searchValue !== undefined || selectedType) { loaded = false; lazyLoader = 0 }`
    useEffect(() => {
        setLoaded(false)
        setLazyLoader(0)
    }, [searchValue, selectedType])

    useEffect(() => {
        if (loaded || !templatesList.length) return
        if (lazyLoader >= templatesList.length) {
            setLoaded(true)
            return
        }
        const timeout = setTimeout(
            () => {
                const batch = lazyLoader === 0 ? 4 : Math.min(32, lazyLoader * 2)
                setLazyLoader(lazyLoader + batch)
            },
            lazyLoader === 0 ? 60 : 30
        )
        return () => clearTimeout(timeout)
    }, [loaded, lazyLoader, templatesList.length])

    return (
        <>
            {revert ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => activePopup.set(revert as unknown as Popups)} /> : null}

            <TextField label="main.search" value="" onInput={(next) => search(next)} autofocus />

            {customTypes ? <SelectField label="scripture.translations" options={types} value={selectedType} onChange={(next) => setSelectedType(next || "")} /> : null}

            <div style={{ position: "relative", height: "100%", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)", marginTop: "10px", overflowY: "auto" }}>
                {templatesList.length ? (
                    <div className={stylesCSS.grid}>
                        {allowEmpty || (customTypes && selectedType !== types[0]?.value) ? (
                            <>
                                <Card active={!value} label={translateText(allowEmpty ? "main.none" : "example.default")} icon="templates" resolution={resolution} onClick={() => selectTemplate("")} />
                                <Center faded>
                                    <Icon id="close" size={2} white />
                                </Center>
                            </>
                        ) : null}

                        {templatesList.map((template, i) => (
                            <div key={template.id}>
                                <Card preview={!!(searchValue.length && i === 0)} active={value === template.id} label={template.name || ""} color={template.color} resolution={resolution} onClick={() => selectTemplate(template)} />
                                {loaded || i < lazyLoader ? <TemplateSlide templateId={template.id} template={template} preview /> : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Center size={1.2} faded style={{ height: "100px", paddingTop: "20px" }}>
                        <T id={sortedTemplates.length ? "empty.search" : "empty.general"} />
                    </Center>
                )}
            </div>
        </>
    )
}
