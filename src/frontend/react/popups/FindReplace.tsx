import { useEffect, useState } from "react"
import { get } from "../../lib/store"
import { format } from "../../components/context/menuClick"
import { activePopup, popupData } from "../../stores"
import { newToast } from "../../utils/common"
import { setPopupSubmit } from "../../utils/popup"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"

// Port de components/main/popups/FindReplace.svelte. Lee popupData (el ObjData del menú contextual) al reemplazar. Escribe: popupData = {} y activePopup = null.
// "Reemplazar" (botón o Enter) llama a format("find_replace", obj, { findValue, replaceValue, caseSentitive }) de menuClick, que es quien aplica el
// reemplazo (alcance, regex escapado y history para deshacer). Sin texto a buscar: toast "empty.input" y no hace nada.
// Cerrar (Esc, clic afuera, X) no escribe nada.
export function FindReplace() {
    const [findValue, setFindValue] = useState("")
    const [replaceValue, setReplaceValue] = useState("")
    const [caseSentitive, setCaseSentitive] = useState(true)
    const [showMore, setShowMore] = useState(false)

    function replace() {
        if (!findValue) {
            newToast("empty.input")
            return
        }

        const obj = get(popupData)
        popupData.set({})

        format("find_replace", obj, { findValue, replaceValue, caseSentitive })
        activePopup.set(null)
    }

    // Se vuelve a registrar en cada render para que Enter use lo último escrito
    useEffect(() => setPopupSubmit(replace))

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            {showMore ? <ToggleField label="actions.case_sensitive" checked={caseSentitive} defaultValue={true} onChange={setCaseSentitive} /> : null}
            <TextField label="actions.find" value={findValue} onInput={(value) => setFindValue(value ?? "")} autofocus />
            <TextField label="actions.replace" value={replaceValue} onInput={(value) => setReplaceValue(value ?? "")} />

            <Button style={{ marginTop: "20px" }} variant="default" onClick={replace}>
                <Icon id="find_replace" size={1.2} white />
                <T id="actions.find_replace" />
            </Button>
        </>
    )
}
