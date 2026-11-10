import { useEffect, useState } from "react"
import { get } from "svelte/store"
import { uid } from "uid"
import type { Popups } from "../../../types/Main"
import Tip from "../../components/main/Tip.svelte"
import { activePopup, customizedIcons, popupData } from "../../stores"
import { customIcons, customIconsColors } from "../../values/customIcons"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import styles from "./ManageIcons.module.css"

// Port de components/main/popups/ManageIcons.svelte. Lee customizedIcons ({ disabled: string[], svg: { id, path }[] }) y popupData.back (al montar).
// Escribe: popupData = {} al montar; customizedIcons (alternar un icono propio en `disabled`, agregar un SVG del portapapeles, borrar uno); activePopup = back con "volver".
// El SVG guardado se muestra con dangerouslySetInnerHTML (era `{@html icon.path}`, misma fuente) dentro de un <span> `display: contents` (el Svelte lo ponía directo en el botón).
// Se omiten `center` y `dark` del botón de importar: el Svelte los dejaba como atributos HTML sueltos (el Button no los usa y ningún CSS los selecciona).
interface CustomizedIcons {
    disabled: string[]
    svg: { id: string; path: string }[]
}

const iconIds = Object.keys(customIcons)
const iconColors: Record<string, string | undefined> = customIconsColors

// el store se edita en el lugar (splice / push): cada emisión entrega copias de las dos listas
function copyIcons(value: CustomizedIcons): CustomizedIcons {
    return { ...value, disabled: [...value.disabled], svg: [...value.svg] }
}

function click(icon: string) {
    customizedIcons.update((a) => {
        const disabledIcons: string[] = a.disabled
        const iconIndex = disabledIcons.indexOf(icon)
        if (iconIndex >= 0) disabledIcons.splice(iconIndex, 1)
        else disabledIcons.push(icon)
        a.disabled = disabledIcons

        return a
    })
}

async function importSVG() {
    let text: string | undefined
    try {
        text = await navigator.clipboard.readText()
    } catch (e) {
        console.warn("Could not read clipboard:", e)
    }
    if (!text || !text.includes("<svg")) return

    const path = text
    customizedIcons.update((a) => {
        a.svg.push({ id: uid(), path })
        return a
    })
}

function deleteCustom(iconId: string) {
    customizedIcons.update((a) => {
        const iconIndex = a.svg.findIndex((svg: { id: string }) => svg.id === iconId)
        if (iconIndex >= 0) a.svg.splice(iconIndex, 1)

        return a
    })
}

export function ManageIcons() {
    const icons: CustomizedIcons = useFreshStore(customizedIcons, copyIcons)
    const [back] = useState<Popups | null>(() => get(popupData).back || null)

    useEffect(() => {
        popupData.set({})
    }, [])

    return (
        <>
            {back ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => activePopup.set(back)} /> : null}

            <SvelteIsland component={Tip} props={{ value: "actions.click_disable", bottom: 20 }} />

            <div className={styles.grid}>
                {iconIds.map((icon) => {
                    const color = iconColors[icon]
                    const disabled = icons.disabled.includes(icon)

                    return (
                        <Button key={icon} style={{ padding: "8px" }} onClick={() => click(icon)} title={disabled ? "actions.enable" : "actions.disable"}>
                            <Icon id={icon} size={2} custom white style={disabled ? { opacity: 0.2 } : color ? { color } : undefined} />
                        </Button>
                    )
                })}

                <Button variant="outline" style={{ width: "100%", margin: "10px 0" }} onClick={importSVG}>
                    <Icon id="copy" size={1.2} />
                    <T id="actions.svg_clipboard" />
                </Button>

                {icons.svg.length ? (
                    <div className={`${styles.custom} ${styles.grid}`}>
                        {icons.svg.map((icon) => (
                            <Button key={icon.id} style={{ padding: "12px" }} onClick={() => deleteCustom(icon.id)} title="actions.delete">
                                <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: icon.path }} />
                            </Button>
                        ))}
                    </div>
                ) : null}
            </div>
        </>
    )
}
