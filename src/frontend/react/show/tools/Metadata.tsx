import { useEffect, useState } from "react"
import { activeShow, customMetadata, dictionary, shows, showsCache } from "../../../stores"
import { history } from "../../../components/helpers/history"
import { getCustomMetadata, initializeMetadata } from "../../../components/helpers/show"
import { translateText } from "../../../utils/language"
import Tip from "../../../components/main/Tip.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { TextField } from "../../ui/text-field/TextField"
import { NumberField } from "../../ui/number-field/NumberField"
import { useStore } from "../../hooks/useStore"
import styles from "./Metadata.module.css"

export interface MetadataProps {}

interface ShowWithMeta {
    id?: string
    name?: string
    meta?: Record<string, string>
    quickAccess?: { number?: string | number; duration?: string | number; metadata?: Record<string, string | number> }
}

// (F24.20a). `on:change` → onChange(value, key).
export function Metadata() {
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentDictionary = useStore(dictionary)
    const currentCustomMetadata = useStore(customMetadata)

    const showId = currentActiveShow?.id || ""
    const currentShow = (currentShowsCache[showId] || {}) as ShowWithMeta
    const [values, setValues] = useState<Record<string, string>>({})

    useEffect(() => {
        const next: Record<string, string> = { ...getCustomMetadata() }
        const meta = currentShow.meta
        if (meta && Object.keys(meta).length) {
            const defaultKeys = Object.keys(initializeMetadata({}))
            Object.entries(meta).forEach(([key, value]) => {
                if (!value && defaultKeys.includes(key) && currentCustomMetadata.disabled?.includes(key)) return
                next[key] = value
            })
        }
        setValues(next)
        // El SvelteOriginal recalcula al cambiar el show activo o los metadatos personalizados.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId, currentCustomMetadata])

    function setQuickAccess(key: string, value: string | number, asMetadata = false) {
        const quickAccess = { ...(currentShow.quickAccess || {}) }
        if (asMetadata) {
            quickAccess.metadata = { ...(quickAccess.metadata || {}), [key]: value }
        } else {
            ;(quickAccess as unknown as Record<string, string | number>)[key] = value
        }
        showsCache.update((a) => {
            if (a[showId]) a[showId].quickAccess = quickAccess
            return a
        })
        shows.update((a) => {
            if (a[showId]) a[showId].quickAccess = quickAccess
            return a
        })
    }

    function updateData(data: Record<string, string>, key: string) {
        const override = `show#${showId}_${key}`
        history({ id: "UPDATE", newData: { data, key }, oldData: { id: showId }, location: { page: "show", id: "show_key", override } })
    }

    function changeValue(value: string | number | null, key: string) {
        const text = String(value ?? "")
        if (key === "duration") {
            setQuickAccess(key, text)
            return
        }
        const next = { ...values, [key]: text }
        setValues(next)
        updateData(next, "meta")
        if (key === "number") setQuickAccess(key, text)
        else if (key === "CCLI") setQuickAccess(key, text, true)
    }

    function autofillFor(key: string): string {
        if (key === "number") return values.number || currentShow.name?.match(/^\d+/)?.[0] || currentShow.name?.match(/\d+$/)?.[0] || ""
        if (key === "title") return (currentShow.name || "").replace(/[0-9\-.,!:;]/g, "").trim()
        return ""
    }

    const numberStored = currentShow.quickAccess?.number

    return (
        <section className={styles.section}>
            <div className="context #metadata_tools" style={{ padding: 10 }}>
                {Object.entries(values).map(([key, value]) => {
                    const isDefault = !!currentDictionary.meta?.[key]
                    const label = isDefault ? translateText(`meta.${key}`) : key
                    const shouldAutofill = (!value || (key === "number" && !numberStored)) && (autofillFor(key) || (key === "number" && value))
                    const autofillValue = shouldAutofill ? autofillFor(key) : ""
                    return <TextField key={key} label={label} style={numberStored && key === "number" ? { borderBottom: "1px solid var(--secondary)" } : undefined} value={value} autofill={autofillValue} onChange={(next) => changeValue(next ?? "", key)} />
                })}
                <NumberField label="transition.duration (s)" value={Number(currentShow.quickAccess?.duration || 0)} onChange={(next) => changeValue(next ?? "", "duration")} hideWhenZero />
            </div>
            <SvelteIsland component={Tip as never} props={{ value: "tips.display_metadata", style: "margin: 0 10px;", bottom: 10 }} />
        </section>
    )
}
