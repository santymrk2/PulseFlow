import { useEffect, useRef, useState } from "react"
import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { Project } from "../../../types/Projects"
import type { Show } from "../../../types/Show"
import { exportProject } from "../../components/export/project"
import { clone } from "../../components/helpers/array"
import { loadShows } from "../../components/helpers/setShow"
import Loader from "../../components/main/Loader.svelte"
import { convertShowSlidesToImages, exportFormats, exportTypes, getActiveShowId, getShowIdsFromType } from "../../components/main/popups/export/exportHelper"
import { sendMain } from "../../IPC/main"
import { activePopup, activeProject, projects, shows, showsCache, special } from "../../stores"
import { wait } from "../../utils/common"
import { translateText } from "../../utils/language"
import { setPopupSubmit } from "../../utils/popup"
import { send } from "../../utils/request"
import { save } from "../../utils/save"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"
import { HRule } from "../ui/h-rule/HRule"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import { PdfExport } from "./PdfExport"

// Port de components/main/popups/export/Export.svelte. Lee: activeProject, projects, shows, showsCache, special.projectIncludeMedia, selected/activeShow (por exportHelper).
// Escribe: special.projectIncludeMedia (ToggleField) y activePopup = null al terminar. "Exportar" (botón o Enter), tras save() + 500 ms:
//   todos los shows -> send(EXPORT, ["ALL_SHOWS"], { type: formato }) y el popup queda abierto con el loader (no cierra);
//   formato project -> exportProject(project, activeProject) (proyecto activo, o uno armado con los shows elegidos);
//   imagen -> sendMain(Main.SAVE_IMAGE, { base64, filePath: ["Images", nombre, `${i + 1}.jpg`], format: "jpg", openFolder: i === 0 }) por diapositiva;
//   pdf -> send(EXPORT, ["GENERATE"], { type, showIds, showNames, options, projectItems }); resto -> send(EXPORT, ["GENERATE"], { type, showIds, showNames }).
// PdfExport ya es React: recibe las opciones por prop y devuelve cada cambio con onChange (antes era una isla con un evento "change" agregado).
// Los valores iniciales siguen siendo los mismos que el Svelte arma cuando recibe `{}`. Para proyecto + PDF se manda una copia con oneFile/name y el estado no cambia
// (el popup se cierra enseguida; sin efecto observable).
// `exportTypesList` se calcula una sola vez, como el `$:` del Svelte (no depende de ningún store en su sintaxis).
type PdfOptions = Record<string, unknown>

const excludedFormats: { [key: string]: string[] } = {
    project: ["show", "txt", "image"],
    all_shows: ["project", "pdf", "image"]
}

const formatIcons: { [key: string]: string } = {
    show: "json",
    txt: "txt",
    pdf: "pdf",
    project: "zip",
    image: "jpg"
}

function defaultPdfOptions(exportType: string): PdfOptions {
    return {
        type: "default",

        title: true,
        metadata: true,
        pageNumbers: true,
        groups: true,
        numbers: true,
        notes: false,
        invert: false,

        grid: [3, 6],
        oneFile: exportType === "project",
        originalTextSize: true,
        textSize: 80,

        // Chord sheet specific options
        artist: true,
        key: true,
        showChords: false,
        showNotes: true,
        fontSize: 15,
        chordFontSize: 15,
        chordColor: "#0066cc",
        margin: 20,
        spacing: 2,
        columnsPerPage: 2
    }
}

export function Export() {
    const projectsValue = useStore(projects)
    const activeProjectValue = useStore(activeProject)
    const specialValue = useStore(special)

    const [previewShow, setPreviewShow] = useState<Show | null>(null)
    const [showIds, setShowIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [exportType, setExportType] = useState("")
    const [exportFormat, setExportFormat] = useState("")
    const [pdfOptions, setPdfOptions] = useState<PdfOptions>({})

    const [exportTypesList] = useState(() =>
        clone(exportTypes).map((a) => {
            const type = { id: a.id || "", name: translateText(a.name), icon: a.icon || "", disabled: false }
            if (!getShowIdsFromType[a.id as keyof typeof getShowIdsFromType]?.(false)?.length) type.disabled = true
            return type
        })
    )

    const typeName = exportTypes.find((a) => a.id === exportType)?.name || ""
    const formatName = exportFormats.find((a) => a.id === exportFormat)?.name || ""

    const filterFormats = () => exportFormats.filter((a) => !(excludedFormats[exportType] || []).find((id) => id === a.id)).map((a) => ({ id: a.id || "", name: translateText(a.name), icon: `./import-logos/${formatIcons[a.id || ""]}.webp` }))

    // Lo que lee exportClick después de esperar: el último render
    const live = useRef({ showIds, previewShow, pdfOptions })
    useEffect(() => {
        live.current = { showIds, previewShow, pdfOptions }
    })

    useEffect(() => {
        if (exportType && exportFormat) updateActive()
    }, [exportType, exportFormat])

    // El Svelte abría PdfExport con `{}` y él armaba los valores iniciales la primera vez: acá se arman al elegir PDF (con el exportType de ese momento)
    function chooseFormat(id: string) {
        if (id === "pdf" && !Object.keys(pdfOptions).length) setPdfOptions(defaultPdfOptions(exportType))
        setExportFormat(id)
    }

    async function updateActive() {
        setLoading(true)
        const ids = getShowIdsFromType[exportType as keyof typeof getShowIdsFromType]?.() || []
        setShowIds(ids)

        let showId = ids[0]
        if (!showId && !previewShow) showId = getActiveShowId()

        if (showId) {
            await loadShows([showId])
            setPreviewShow({ ...get(showsCache)[showId], id: showId })
        }

        setLoading(false)

        // TODO: get & display preview example of first txt!/show? export
    }

    async function exportClick() {
        if (loading) return

        // might not have selected an option
        if (!exportFormat) return
        const nothingToExport = exportType === "project" ? !get(projects)[get(activeProject) || ""]?.shows?.length : !showIds.length && exportType !== "all_shows"
        if (nothingToExport) return

        // save all shows before exporting
        save()
        await wait(500)

        const { showIds: ids, previewShow: preview, pdfOptions: options } = live.current
        const currentProjectId = get(activeProject)

        if (exportType === "all_shows") {
            setLoading(true)
            send(EXPORT, ["ALL_SHOWS"], { type: exportFormat })
            return
        }

        if (exportFormat === "project") {
            let project: Project | null = exportType === "project" && currentProjectId ? get(projects)[currentProjectId] : null
            if (!project) {
                if (!ids.length || !preview) return

                project = {
                    name: preview.name,
                    notes: "",
                    created: preview.timestamps?.created || Date.now(),
                    parent: "/",
                    shows: ids.map((id) => ({ type: "show", id }))
                }
            }

            setLoading(true)
            await exportProject(project, currentProjectId || "")
        } else if (exportFormat === "image") {
            // only first selected show
            setLoading(true)
            const showName = get(showsCache)[ids[0]]?.name
            const images = await convertShowSlidesToImages(ids[0])
            images.forEach((base64, i) => {
                if (!base64) return
                sendMain(Main.SAVE_IMAGE, { base64, filePath: ["Images", showName, `${i + 1}.jpg`], format: "jpg", openFolder: i === 0 })
            })
            setLoading(false)
        } else if (exportFormat === "pdf") {
            const project = exportType === "project" && currentProjectId ? get(projects)[currentProjectId] : null
            let finalShowIds = ids
            let finalOptions = options
            if (project) {
                finalOptions = { ...options, oneFile: true, name: project.name }
                const items = project.shows || []
                finalShowIds = items
                    .filter((item) => {
                        const type = item.type || "show"
                        if (type === "show") return true
                        if (type === "section") return true
                        if (type === "image" || type === "video" || type === "audio") return true
                        return false
                    })
                    .map((item) => item.id)
            }
            const showNames = finalShowIds.map((id) => get(shows)[id]?.name || "")
            send(EXPORT, ["GENERATE"], { type: exportFormat, showIds: finalShowIds, showNames, options: finalOptions, projectItems: project?.shows })
        } else {
            const showNames = ids.map((id) => get(shows)[id]?.name || "")
            send(EXPORT, ["GENERATE"], { type: exportFormat, showIds: ids, showNames })
        }

        activePopup.set(null)
    }

    // Enter: se vuelve a registrar en cada render para ver lo elegido
    useEffect(() => setPopupSubmit(exportClick))

    function setSpecial(value: boolean, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    // Misma foto del Svelte (JSON.parse/stringify en PdfExport) cada vez que cambia; si es igual a lo guardado no se vuelve a renderizar (la isla re-emite al recibir props)
    function pdfOptionsChanged(next: PdfOptions) {
        setPdfOptions((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }

    if (!exportType) {
        return (
            <>
                <p style={{ marginBottom: "10px" }}>
                    <T id="export.option_type" />
                </p>

                <ChoiceGrid options={exportTypesList} onClick={setExportType} />
            </>
        )
    }

    if (!exportFormat) {
        return (
            <>
                <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setExportType("")} />

                <p style={{ marginBottom: "10px" }}>
                    <T id="export.option_format" />
                </p>

                <ChoiceGrid options={filterFormats()} onClick={chooseFormat} />
            </>
        )
    }

    return (
        <>
            <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setExportFormat("")} />

            {/* margin-bottom: 10px; */}
            <div style={{ display: "flex" }}>
                <p style={{ whiteSpace: "break-spaces", opacity: 0.6 }}>
                    <T id="export.export_as" />
                </p>
                <p>{translateText(typeName)}</p>
                <p style={{ whiteSpace: "break-spaces", opacity: 0.6 }}>
                    <T id="export.export_as" index={1} />
                    &nbsp;
                </p>
                <p>{translateText(formatName)}</p>
            </div>

            {exportFormat === "pdf" ? (
                <>
                    <HRule />
                    <PdfExport pdfOptions={pdfOptions} previewShow={previewShow} showCount={showIds.length} exportType={exportType} onChange={pdfOptionsChanged} />
                </>
            ) : exportFormat === "project" ? (
                <ToggleField label="export.include_media" style={{ marginTop: "20px" }} checked={specialValue.projectIncludeMedia ?? true} defaultValue={true} onChange={(value) => setSpecial(value, "projectIncludeMedia")} />
            ) : null}

            {loading ? (
                <Center padding={10}>
                    <SvelteIsland component={Loader} />
                </Center>
            ) : null}

            <Button variant="default" style={{ marginTop: "20px" }} icon="export" info={showIds.length > 1 && exportFormat !== "project" && !(exportType === "project" && exportFormat === "pdf") ? showIds.length.toString() : ""} disabled={exportType === "project" ? !projectsValue[activeProjectValue || ""]?.shows?.length : !showIds.length && exportType !== "all_shows"} onClick={exportClick}>
                <T id="export.export" />
            </Button>
        </>
    )
}
