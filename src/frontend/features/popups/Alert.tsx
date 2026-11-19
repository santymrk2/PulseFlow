import { Fragment, useEffect, useRef, type MouseEvent } from "react"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { setPopupSubmit } from "../../shared/utils/popup"
import { Loader } from "../../app/main/Loader"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { Link } from "../../shared/ui/kit/link/Link"
import styles from "./Alert.module.css"

// Port de components/main/popups/Alert.svelte. Lee: alertMessage. Escribe: activePopup = null (botón o Enter, menos con "actions.closing").
export function Alert() {
    const alertValue = useStore(alertMessage)

    // UPDATER
    let msg = alertValue.toString()
    if (msg.includes("link#")) msg = msg.replace("link#bible-converter", '<a id="bible-converter">Bible Converter</a>')

    // Enter: el registro se hace una vez y lee siempre el mensaje actual
    const current = useRef(msg)
    useEffect(() => {
        current.current = msg
    })
    useEffect(() => setPopupSubmit(() => (current.current !== "actions.closing" ? close() : null)), [])

    function click(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest("a#bible-converter")) {
            sendMain(Main.URL, "https://github.com/vassbo/bible-converter")
        }
    }

    function close() {
        activePopup.set(null)
    }

    if (msg === "actions.closing") {
        return (
            <div className={styles.centered}>
                {translateText(msg)}
                <Loader />
            </div>
        )
    }

    const isCaptions = msg.includes("captions#")
    const isPlainText = !msg.includes("<") && msg?.length - msg?.replaceAll(".", "").length === 1
    const captionsUrl = msg.slice(msg.indexOf("#") + 1)

    return (
        <>
            {isCaptions || isPlainText ? (
                <p key={msg} className={styles.message} onClick={click}>
                    {isCaptions ? (
                        <Fragment>
                            {translateText("captions.info")}
                            <br />
                            <br />
                            <Link url={captionsUrl}>{captionsUrl}</Link>
                        </Fragment>
                    ) : (
                        translateText(msg)
                    )}
                </p>
            ) : (
                <p key={msg} className={styles.message} onClick={click} dangerouslySetInnerHTML={{ __html: msg }} />
            )}

            <br />

            <Button variant="outline" onClick={close}>
                <Icon id="check" size={1.2} white />
            </Button>
        </>
    )
}
