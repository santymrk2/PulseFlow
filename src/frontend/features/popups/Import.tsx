import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import { Tip } from "../../react/main/Tip"
import { importFromClipboard } from "../../converters/importHelpers"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage, os, popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { presentationExtensions } from "../../shared/core/values/extensions"
import { Icon } from "../../shared/ui/helpers/Icon"
import { Button } from "../../shared/ui/kit/button/Button"
import { HRule } from "../../shared/ui/kit/h-rule/HRule"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import styles from "./Import.module.css"

// Port de components/main/popups/Import.svelte. Lee popupData.mode (al montar; "project" muestra sólo PDF/PowerPoint/txt/ChordPro) y os.platform (al montar).
// Escribe popupData = {} al montar. Cada botón manda lo mismo que el Svelte:
//   sendMain(Main.IMPORT, { channel: <id>, format }) (los de texto y FreeShow con { ...format, name: traducido }) y luego tutorial -> alertMessage + activePopup "alert",
//   o activePopup = null. PowerPoint "slides": Main.IMPORT canal "powerpoint" y cierra; PDF: Main.PPT_TO_PDF (no cierra); online: Main.URL y cierra;
//   controlador: Main.IMPORT canal "powerkey" (no cierra). Portapapeles: importFromClipboard() y cierra. Tip usa el port React.
// Los selectores `div`/`img` del <style> del Svelte pasan a las clases `box`/`img` de cada elemento. Sin key en el original: la posición.
interface ImportFormat {
    name: string
    extensions: string[]
    id: string
    title?: string
    icon?: string
    shortcut?: string
    tutorial?: string
}

const freeshow_formats: ImportFormat[] = [
    { name: "formats.show", title: "FreeShow Song/Presentation File", icon: "slide", extensions: ["show", "json"], id: "freeshow" },
    { name: "formats.project", title: "FreeShow Project File", icon: "project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" }, // , "fsproject", "fsp"
    { name: "formats.template", title: "FreeShow Template File", icon: "templates", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" },
    { name: "formats.overlay", title: "FreeShow Overlay File", icon: "overlays", extensions: ["fsoverlay", "fso", "overlay", "json", "zip"], id: "freeshow_overlay" },
    { name: "formats.action", title: "FreeShow Action File", icon: "actions", extensions: ["fsaction", "action", "json"], id: "freeshow_action" },
    { name: "stage.stage_layout", title: "FreeShow Stage Layout File", icon: "stage", extensions: ["fsstage", "stage", "json"], id: "freeshow_stage" }
]

const freeshow_primary_formats = freeshow_formats.filter((format) => ["freeshow", "freeshow_project"].includes(format.id))
const freeshow_more_formats = freeshow_formats.filter((format) => ["freeshow_template", "freeshow_overlay", "freeshow_action", "freeshow_stage"].includes(format.id))

const text_formats: ImportFormat[] = [
    { name: "formats.text", extensions: ["txt"], id: "txt" },
    { name: "CSV", extensions: ["csv"], id: "csv" },
    { name: "ChordPro", extensions: ["cho", "crd", "chopro", "chordpro", "chord", "pro", "txt", "onsong"], id: "chordpro" },
    { name: "Word", extensions: ["doc", "docx"], id: "word" },
    { name: "ProPresenter", extensions: ["pro4", "pro5", "pro6", "pro", "json", "proBundle"], id: "propresenter" },
    {
        name: "EasyWorship",
        extensions: ["db"],
        id: "easyworship",
        tutorial: "Import the <b>SongsWords.db/SongWords.db</b> file from the Data folder!<br>Optionally select <b>Songs.db</b> at the same time to also import title/metadata.<br><br>Often located in the Documents folder:<br><i>Documents/Softouch/EasyWorship/Default/v6.1/Databases/Data/</i>"
    },
    {
        name: "VideoPsalm",
        extensions: ["json", "vpc"],
        id: "videopsalm",
        tutorial: "Find the .vpc or .json file(s) often located in Documents\\VideoPsalm\\Songbooks"
    },
    { name: "OpenLP/OpenLyrics", extensions: ["xml", "sqlite"], id: "openlp" },
    { name: "OpenSong", extensions: [], id: "opensong" },
    { name: "MediaShout", extensions: ["ssc", "xml", "mdb"], id: "mediashout" }, // SSC (Songs5.mdb)
    { name: "Quelea", extensions: ["xml", "qsp"], id: "quelea" },
    { name: "SoftProjector", extensions: ["sps"], id: "softprojector" },
    { name: "Songbeamer", extensions: ["sng"], id: "songbeamer" },
    { name: "Easyslides", extensions: ["xml"], id: "easyslides" },
    { name: "VerseVIEW", extensions: ["xml"], id: "verseview" }
]

const media_formats: ImportFormat[] = [
    { name: "Lessons.church", title: "ChurchApps\nhttps://lessons.church", extensions: ["json", "olp", "olf"], id: "lessons" },
    { name: "PDF", title: "Added to your project", extensions: ["pdf"], id: "pdf" },
    { name: "PowerPoint", extensions: [], id: "powerpoint" }
]

function pptText() {
    sendMain(Main.IMPORT, { channel: "powerpoint", format: { name: "PowerPoint", extensions: ["ppt", "pptx"] } })
    activePopup.set(null)
}
function convertToPdf() {
    sendMain(Main.PPT_TO_PDF)
}
function onlineConvert() {
    sendMain(Main.URL, "https://www.ilovepdf.com/powerpoint_to_pdf")
    // https://cloudconvert.com/ppt-to-jpg
    activePopup.set(null)
}
function pptController() {
    sendMain(Main.IMPORT, { channel: "powerkey", format: { name: "PowerPoint/Keynote", extensions: presentationExtensions } })
}

function displayTutorial(format: ImportFormat) {
    if (!format.tutorial) {
        activePopup.set(null)
        return
    }

    alertMessage.set(format.tutorial)
    activePopup.set("alert")
}

// FreeShow y texto mandan el formato completo con el nombre ya traducido
function importNamedFormat(format: ImportFormat) {
    const name = translateText(format.name)
    sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name } })
    displayTutorial(format)
}

function importMediaFormat(format: ImportFormat) {
    if (format.id === "powerpoint") {
        pptText()
        return
    }

    sendMain(Main.IMPORT, { channel: format.id, format })
    displayTutorial(format)
}

function pasteFromClipboard() {
    importFromClipboard()
    activePopup.set(null)
}

const buttonShortcutTitle = (format: ImportFormat) => (format.shortcut ? ` [${format.shortcut}]` : "")

function FreeshowFormatButton({ format, wide = false }: { format: ImportFormat; wide?: boolean }) {
    return (
        <Button variant="outline" title={format.title} style={{ flex: 1, minHeight: "50px", ...(wide ? { minWidth: "280px" } : {}), padding: "10px", gap: "15px" }} onClick={() => importNamedFormat(format)}>
            <Icon style={{ height: "60px" }} id={format.icon || ""} size={2.5} white />
            <p>{translateText(format.name)}</p>

            <div className={`${styles.box} ${styles.freeshow}`}>
                <img className={styles.img} style={{ height: "18px", padding: 0 }} src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
            </div>
        </Button>
    )
}

function ClipboardButton() {
    return (
        <Button style={{ marginTop: "5px" }} variant="outline" onClick={pasteFromClipboard} title="actions.paste [Ctrl+Alt+I]">
            <Icon id="paste" size={1.2} white />
            {translateText("formats.clipboard")}
        </Button>
    )
}

const rowStyle = { justifyContent: "start", flex: 1, minHeight: "50px", fontWeight: "normal" } as const

export function Import() {
    const [mode] = useState(() => get(popupData).mode)
    const [platform] = useState(() => get(os).platform)
    const [openedPage, setOpenedPage] = useState("")

    useEffect(() => {
        popupData.set({})
    }, [])

    const powerpoint_options = [
        { name: "info.slides", description: "Imperfect formatting.", icon: "txt", click: pptText },
        { name: "PDF", description: `Requires LibreOffice${platform === "linux" ? "" : " or PowerPoint"} installed.`, icon: "pdf", click: convertToPdf },
        { name: "PDF (Online)", description: "Requires network connection, and manual steps.", icon: "pdf", click: onlineConvert },
        { name: "Controller (Deprecated)", description: "Requires PowerPoint/Keynote installed. Useful for live streams, but buggy.", icon: "powerkey", click: pptController }
    ]

    const back = <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setOpenedPage("")} />

    if (openedPage === "powerpoint") {
        return (
            <>
                {back}

                <div className={styles.box} style={{ flexDirection: "column" }}>
                    {powerpoint_options.map((option, i) => (
                        <Button key={i} variant="outline" style={rowStyle} onClick={() => option.click()}>
                            <img className={styles.img} style={{ height: "60px", width: "70px" }} src={`./import-logos/${option.icon}.webp`} alt={`${option.name}-logo`} draggable={false} />

                            <div className={styles.box} style={{ flexDirection: "column", alignItems: "start" }}>
                                <p style={{ fontSize: "1.1em" }}>{translateText(option.name)}</p>
                                <span style={{ opacity: 0.5 }}>{translateText(option.description)}</span>
                            </div>
                        </Button>
                    ))}
                </div>

                <Tip value="The best option would generally be to get a hold of the presentation as PDF format in the first place." top={20} />
            </>
        )
    }

    if (openedPage === "freeshow_more") {
        return (
            <>
                {back}

                <div className={styles.box}>
                    {freeshow_more_formats.map((format, i) => (
                        <FreeshowFormatButton key={i} format={format} wide />
                    ))}
                </div>
            </>
        )
    }

    if (mode === "project") {
        return (
            <>
                <div className={styles.box}>
                    {media_formats
                        .filter((a) => ["pdf", "powerpoint"].includes(a.id))
                        .map((format, i) => (
                            <InputRow key={i} style={{ flex: 1 }}>
                                <Button variant="outline" style={rowStyle} onClick={() => importMediaFormat(format)}>
                                    <img className={styles.img} style={{ height: "60px", width: "70px" }} src={`./import-logos/${format.id}.webp`} alt={`${format.id}-logo`} draggable={false} />
                                    <p>{format.name}</p>
                                </Button>
                            </InputRow>
                        ))}
                </div>

                <HRule title="settings.text_import" />

                <div className={styles.box}>
                    {text_formats
                        .filter((a) => ["txt", "chordpro"].includes(a.id))
                        .map((format, i) => (
                            <Button key={i} variant="outline" style={rowStyle} onClick={() => importNamedFormat(format)} title={buttonShortcutTitle(format)}>
                                <img className={styles.img} style={{ height: "60px", width: "70px" }} src={`./import-logos/${format.id}.webp`} alt={`${format.id}-logo`} draggable={false} />
                                <p>{translateText(format.name)}</p>
                            </Button>
                        ))}
                </div>

                <ClipboardButton />
            </>
        )
    }

    return (
        <>
            <div className={styles.box}>
                {freeshow_primary_formats.map((format, i) => (
                    <FreeshowFormatButton key={i} format={format} />
                ))}

                <Button variant="outline" style={{ flex: 1, minHeight: "50px", padding: "10px", gap: "5px" }} onClick={() => setOpenedPage("freeshow_more")}>
                    <p style={{ opacity: 0.9 }}>{translateText("create_show.more_options")}</p>
                    <Icon style={{ opacity: 0.8, height: "60px", marginRight: "-15px" }} id="next" size={2} white />
                </Button>
            </div>

            <ClipboardButton />

            <HRule title="settings.media_import" />

            <div className={styles.box}>
                {media_formats.map((format, i) => (
                    <InputRow key={i} style={{ flex: 1 }}>
                        <Button variant="outline" title={format.title} style={rowStyle} onClick={() => importMediaFormat(format)}>
                            <img className={styles.img} style={{ height: "60px", width: "70px" }} src={`./import-logos/${format.id}.webp`} alt={`${format.id}-logo`} draggable={false} />
                            <p>{format.name}</p>
                        </Button>

                        {format.id === "powerpoint" ? (
                            <Button variant="outline" style={{ padding: "6px" }} onClick={() => setOpenedPage("powerpoint")} title="create_show.more_options">
                                <Icon id="next" style={{ opacity: 0.6 }} size={1.8} white />
                            </Button>
                        ) : null}
                    </InputRow>
                ))}
            </div>

            <HRule title="settings.text_import" />

            <div className={styles.box}>
                {text_formats.map((format, i) => (
                    <Button key={i} variant="outline" style={{ justifyContent: "start", width: "calc((100% / 3) - (5px * 2 / 3))", minHeight: "50px", fontWeight: "normal", border: "1px solid var(--primary-lighter)" }} onClick={() => importNamedFormat(format)} title={buttonShortcutTitle(format)}>
                        <img className={styles.img} style={{ height: "60px", width: "70px" }} src={`./import-logos/${format.id}.webp`} alt={`${format.id}-logo`} draggable={false} />
                        <p>{translateText(format.name)}</p>
                    </Button>
                ))}
            </div>
        </>
    )
}
