import { useEffect, useRef, useState } from "react"
import { get } from "../../lib/store"
import { activePopup, popupData } from "../../stores"
import { setPopupSubmit } from "../../utils/popup"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { TextField } from "../ui/text-field/TextField"
import styles from "./Confirm.module.css"

// Port de components/main/popups/Confirm.svelte. Lo abren confirmCustom/promptCustom (utils/popup.ts) y lo resuelve waitForPopupData("confirm").
// Lee: popupData.prompt/inputType/message (una vez, al montar) y popupData.trigger (al confirmar).
// Escribe: confirmar (botón o Enter) -> con trigger: trigger(texto) + activePopup = null; sin trigger: popupData = { ...popupData, id: "confirm", value: inputType ? texto : true }.
//   "No" -> popupData = {} + activePopup = null.
// Los demás cierres (Esc, clic afuera, X, desmontar sin responder) no pasan por acá: el marco hace activePopup = null y waitForPopupData resuelve
// undefined solo (confirmCustom -> false, promptCustom -> ""), igual que con el Svelte, que tampoco escribía nada en onDestroy.
export function Confirm() {
    const [{ prompt, inputType, message }] = useState(() => {
        const data = get(popupData)
        return { prompt: (data.prompt || "") as string, inputType: (data.inputType || "") as string, message: (data.message || "") as string }
    })
    const text = useRef("")

    function close() {
        popupData.set({})
        activePopup.set(null)
    }

    function confirm() {
        const data = get(popupData)
        if (data.trigger) {
            data.trigger(text.current)
            activePopup.set(null)
        } else {
            popupData.set({ ...data, id: "confirm", value: inputType ? text.current : true })
        }
    }

    // Enter: el registro es uno solo y confirma con el texto actual
    useEffect(() => setPopupSubmit(confirm), [])

    if (inputType) {
        return (
            <>
                {message ? <p className={styles.message} dangerouslySetInnerHTML={{ __html: message }} /> : null}

                <TextField label={prompt} type={inputType} value="" onInput={(value) => (text.current = value ?? "")} autofocus />

                <Button variant="default" style={{ marginTop: "20px" }} onClick={confirm}>
                    <T id="remote.submit" />
                </Button>
            </>
        )
    }

    return (
        <>
            {prompt ? <p className={styles.prompt} dangerouslySetInnerHTML={{ __html: prompt }} /> : null}

            <InputRow style={{ display: "flex", justifyContent: "center", gap: "5px" }}>
                <Button style={{ minWidth: "150px" }} onClick={close}>
                    <Icon id="close" style={{ fill: "#ff5454" }} size={1.1} white />
                    <T id="main.no" />
                </Button>
                <Button style={{ minWidth: "150px" }} onClick={confirm}>
                    <Icon id="check" style={{ fill: "#b7ffac" }} size={1.1} white />
                    <T id="main.yes" />
                </Button>
            </InputRow>
        </>
    )
}
