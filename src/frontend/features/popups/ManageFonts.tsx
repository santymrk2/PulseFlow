import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { CustomFont } from "../../../types/Show"
import { defaultFonts, getSystemFontsList, loadCustomFont } from "../../shared/utils/helpers/fonts"
import { customFonts, special } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Center } from "../../shared/ui/system/Center"
import { Button } from "../../shared/ui/kit/button/Button"
import { FileField } from "../../shared/ui/kit/file-field/FileField"
import { HRule } from "../../shared/ui/kit/h-rule/HRule"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import styles from "./ManageFonts.module.css"

// Port de components/main/popups/ManageFonts.svelte. Lee customFonts, special.hiddenFonts y la lista de fuentes del sistema (getSystemFontsList(false) al montar,
// sin las integradas). Escribe customFonts (agregar tras loadCustomFont; borrar por índice) y special.hiddenFonts (ocultar / mostrar una fuente del sistema).
// Las fuentes de Google las carga loadCustomFont (fonts.ts, con un <link>; la CSP de F23 permite fonts.googleapis.com / fonts.gstatic.com).
// `addingFont` es state (deshabilita los controles) y ref (el guard de un segundo clic antes del re-render). Los `null` de TextField se tratan como "" sólo por el tipo.
interface SystemFont {
    label: string
    value: string
    style: string
}

const nameTitle = { fontSize: "0.7em", opacity: 0.7, maxWidth: "65%" } as const

export function ManageFonts() {
    const fonts = useStore(customFonts)
    const [systemFonts, setSystemFonts] = useState<SystemFont[]>([])
    const [fontFamily, setFontFamily] = useState("")
    const [isValidFamily, setIsValidFamily] = useState(false)
    const [addingFont, setAddingFont] = useState(false)
    const adding = useRef(false)
    const [hiddenSystemFonts, setHiddenSystemFonts] = useState<string[]>(() => get(special).hiddenFonts || [])
    const [newFontInput, setNewFontInput] = useState(false)

    useEffect(() => {
        let mounted = true
        getSystemFontsList(false).then((list) => {
            // remove built-in fonts from system fonts list
            if (mounted) setSystemFonts(list.filter((a) => !defaultFonts.includes(a.label)))
        })

        return () => {
            mounted = false
        }
    }, [])

    function updateFontFamily(value: string) {
        const family = value.trim()
        setFontFamily(family)
        setIsValidFamily(isValid(family))
    }

    function isValid(family: string) {
        if (!family.length) return false

        const nameLower = family.toLowerCase()

        const alreadyExists = fonts.some((a) => a.name.toLowerCase() === nameLower)
        if (alreadyExists) {
            newToast(`Font with name "${family}" already exists`)
            return false
        }

        const fontsList = [...systemFonts.map((a) => a.label), ...defaultFonts]
        if (fontsList.some((font) => font.toLowerCase() === nameLower)) {
            newToast(`Font with name "${family}" already exists as a system font`)
            return false
        }

        return true
    }

    async function addFont(font: CustomFont) {
        if (adding.current) return

        adding.current = true
        setAddingFont(true)

        const isValidFont = await loadCustomFont(font)
        if (!isValidFont) {
            newToast("Could not load font")
            adding.current = false
            setAddingFont(false)
            return
        }

        customFonts.set([...get(customFonts), font])

        setNewFontInput(false)
        adding.current = false
        setAddingFont(false)
        setFontFamily("")
    }

    function removeFont(index: number) {
        customFonts.set(get(customFonts).filter((_, i) => i !== index))
    }

    function toggleHiddenSystemFont(label: string) {
        const next = hiddenSystemFonts.includes(label) ? hiddenSystemFonts.filter((a) => a !== label) : [...hiddenSystemFonts, label]
        setHiddenSystemFonts(next)

        special.update((s) => ({ ...s, hiddenFonts: next }))
    }

    return (
        <>
            {/* Built-in */}
            <InputRow
                arrow
                menu={defaultFonts.map((font) => (
                    <InputRow key={font}>
                        <div className={styles.name} style={{ maxWidth: "unset" }}>
                            <p style={{ fontFamily: `${font}, sans-serif` }}>{font}</p>
                        </div>
                    </InputRow>
                ))}
            >
                <div className={styles.name} data-title="Built-in the program">
                    <Icon id="text" white />
                    <p>
                        <T id="example.default" />
                    </p>
                    <p style={nameTitle}>{defaultFonts.length}</p>
                </div>
            </InputRow>

            {/* System fonts */}
            <InputRow
                style={{ marginTop: "10px" }}
                arrow
                menu={systemFonts.map((font) => {
                    const isHidden = hiddenSystemFonts.includes(font.label)

                    return (
                        <InputRow key={font.label}>
                            <div className={styles.name}>
                                <p style={cssTextToStyle(font.style)}>{font.label}</p>
                            </div>

                            <Button title={isHidden ? "profile.show" : "profile.hide"} style={{ padding: "0.75rem", minWidth: "50px" }} onClick={() => toggleHiddenSystemFont(font.label)}>
                                <Icon id={isHidden ? "hide" : "eye"} white={isHidden} />
                            </Button>
                        </InputRow>
                    )
                })}
            >
                <div className={styles.name} data-title="Installed on your system">
                    <Icon id="folder" white />
                    <p>System</p>
                    <p style={nameTitle}>
                        {systemFonts.length}
                        {hiddenSystemFonts.length ? ` (${systemFonts.length - hiddenSystemFonts.length})` : null}
                    </p>
                </div>
            </InputRow>

            <HRule title="sort.custom" />

            {fonts.length ? (
                fonts.map((font, index) => (
                    <InputRow key={index}>
                        <div className={styles.name} data-title={font.path || "Google Fonts"}>
                            <Icon id={font.path ? "text" : "web"} white />
                            <p style={{ fontFamily: `${font.name}, sans-serif` }}>{font.name}</p>
                            <p style={nameTitle}>{font.path || "Google Fonts"}</p>
                        </div>

                        <Button icon="delete" title="actions.delete" disabled={addingFont} style={{ padding: "0.75rem", minWidth: "50px" }} onClick={() => removeFont(index)} />
                    </InputRow>
                ))
            ) : !newFontInput ? (
                <Center faded padding={10} style={{ paddingTop: 0 }}>
                    <T id="empty.general" />
                </Center>
            ) : null}

            {newFontInput ? (
                <>
                    {fonts.length ? <div style={{ padding: "5px" }} /> : null}

                    <TextField label="settings.font_family" value={fontFamily} disabled={addingFont} onChange={(value) => updateFontFamily(value ?? "")} />

                    <InputRow>
                        <FileField
                            label="scripture.local (.woff/.ttf/.otf)"
                            title="actions.import"
                            value=""
                            icon="text"
                            filter={{ name: "Font File", extensions: ["woff", "woff2", "ttf", "otf"] }}
                            disabled={!isValidFamily || addingFont}
                            style={{ width: "initial", flex: 1 }}
                            onChange={(value) => {
                                // sin `multiple` el campo entrega una sola ruta
                                if (typeof value === "string") addFont({ type: "local", name: fontFamily, path: value })
                            }}
                        />

                        <Button icon="web" title="Import from Google Fonts" disabled={!isValidFamily || addingFont} onClick={() => addFont({ type: "google", name: fontFamily })}>
                            Google Fonts
                        </Button>
                    </InputRow>
                </>
            ) : null}

            <Button variant="outline" style={{ width: "100%", marginTop: "10px" }} icon="add" disabled={newFontInput} onClick={() => setNewFontInput(true)}>
                <T id="settings.add" />
            </Button>
        </>
    )
}
