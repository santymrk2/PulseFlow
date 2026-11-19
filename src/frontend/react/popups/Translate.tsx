import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { _show } from "../../components/helpers/shows"
import { activePopup, activeShow, showsCache, special } from "../../shared/core/stores"
import { setPopupSubmit } from "../../utils/popup"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { SelectField } from "../ui/select-field/SelectField"
import { isoLanguages } from "../../components/main/popups/localization/isoLanguages"
import { getIsoLanguages, removeTranslationFromShow, translateShow } from "../../components/main/popups/localization/translation"
import styles from "./Translate.module.css"

// Port de components/main/popups/localization/Translate.svelte. Lee: special.translationLanguage, activeShow/showsCache (al montar).
// Escribe: special.translationLanguage, activePopup (al quitar todas las traducciones) y el show vía translateShow/removeTranslationFromShow.
// El registro de Enter se hace una única vez con una envoltura que lee el estado más reciente.
export function Translate() {
    const specialValue = useStore(special)
    const [languageList] = useState(getIsoLanguages)
    const [showId] = useState(() => get(activeShow)?.id || "")
    const [translatedLangs, setTranslatedLangs] = useState<string[]>([])

    useEffect(() => {
        const currentShow = get(showsCache)[showId] || {}
        const activeLayout = currentShow.settings?.activeLayout
        const layoutSlides = currentShow.layouts?.[activeLayout]?.slides || []
        const langs: string[] = []

        layoutSlides.forEach((a) => {
            if (!a?.id) return
            const items = _show().slides([a.id]).get("items") || []
            items.flat().forEach((item) => {
                if (item?.language) langs.push(item.language)
            })
        })

        setTranslatedLangs([...new Set(langs)])
        console.log(langs)
    }, [])

    function updateLanguage(value: string | null) {
        const next = value || ""
        special.update((a) => {
            a.translationLanguage = next
            return a
        })
    }

    function convert() {
        const language = get(special).translationLanguage
        if (!language) return

        void translateShow(showId, language)
        setTranslatedLangs((langs) => [...langs, language])
    }

    function remove(id = "") {
        removeTranslationFromShow(showId, id)

        if (id) {
            setTranslatedLangs((langs) => {
                const next = [...langs]
                next.splice(next.indexOf(id), 1)
                return next
            })
        } else {
            setTranslatedLangs([])
            setTimeout(() => activePopup.set(null), 50)
        }
    }

    const live = useRef(convert)
    useEffect(() => {
        live.current = convert
    })
    useEffect(() => setPopupSubmit(() => live.current()), [])

    const language = specialValue.translationLanguage || ""

    return (
        <div className={styles.main}>
            <SelectField label="settings.language" options={languageList} value={language} onChange={updateLanguage} flags />

            <Button variant="default" style={{ marginTop: "20px", width: "100%" }} disabled={!language} onClick={convert}>
                <Icon size={1.1} id="translate" white />

                {translatedLangs.includes(language) ? <T id="localization.update" /> : translatedLangs.length ? <T id="localization.add" /> : <T id="localization.translate" />}
            </Button>

            {translatedLangs.length ? (
                <>
                    <div className={styles.list}>
                        {translatedLangs.map((lang, i) => (
                            <InputRow key={i}>
                                <p style={{ flex: 1 }}>{isoLanguages.find((a) => a.code === lang)?.name || lang}</p>
                                <Button title="settings.remove" onClick={() => remove(lang)}>
                                    <Icon id="close" size={1.3} white />
                                </Button>
                            </InputRow>
                        ))}
                    </div>

                    <Button variant="outline" style={{ width: "100%" }} onClick={() => remove()}>
                        <Icon size={1.1} id="close" />
                        <T id="localization.remove" />
                    </Button>
                </>
            ) : null}
        </div>
    )
}
