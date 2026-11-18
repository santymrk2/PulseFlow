import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Show } from "../../../types/Show"
import { clone } from "../../components/helpers/array"
import { translateText } from "../../utils/language"
import { Pdf } from "../export/Pdf"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { ColorField } from "../ui/color-field/ColorField"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import styles from "./PdfExport.module.css"

// Port de components/main/popups/export/PdfExport.svelte. No lee stores directamente; recibe pdfOptions/previewShow/showCount/exportType por props y
// devuelve cada cambio con onChange(options) (el dispatch "change" del Svelte, con JSON.parse/JSON.stringify).
// Pdf es un componente React directo. Se conserva: oneFile forzado a true para proyectos, los defaults cuando llegan opciones vacías y el preview con scroll.
// Se omite el console.log("Shows:", showCount) del original (sólo diagnóstico).
export interface PdfOptions {
    type?: string
    title?: boolean
    metadata?: boolean
    pageNumbers?: boolean
    groups?: boolean
    numbers?: boolean
    notes?: boolean
    invert?: boolean
    grid?: number[]
    oneFile?: boolean
    originalTextSize?: boolean
    textSize?: number
    artist?: boolean
    key?: boolean
    showChords?: boolean
    showNotes?: boolean
    fontSize?: number
    chordFontSize?: number
    chordColor?: string
    margin?: number
    spacing?: number
    columnsPerPage?: number
    [key: string]: unknown
}

export interface PdfExportProps {
    pdfOptions: PdfOptions
    previewShow: Show | null
    showCount?: number
    exportType?: string
    onChange?: (options: PdfOptions) => void
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

function showHasChords(show: Show | null): boolean {
    if (!show) return false

    return Object.values(show.slides || {}).some((slide) => slide.items?.some((item) => item.lines?.some((line) => !!line.chords && line.chords.length > 0)))
}

export function PdfExport({ pdfOptions, previewShow, exportType = "", onChange }: PdfExportProps) {
    const [options, setOptions] = useState<PdfOptions>(() => {
        const initial: PdfOptions = Object.keys(pdfOptions).length ? { ...pdfOptions } : defaultPdfOptions(exportType)
        initial.oneFile = exportType === "project"
        return initial
    })
    const paper = useRef<HTMLDivElement>(null)
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onChangeRef.current = onChange
    })

    // Igual que el dispatch reactivo del Svelte: se emite una copia profunda cada vez que cambian las opciones (incluida la inicial).
    useEffect(() => {
        onChangeRef.current?.(clone(options))
    }, [options])

    useEffect(() => {
        const oneFile = exportType === "project"
        setOptions((prev) => (prev.oneFile === oneFile ? prev : { ...prev, oneFile }))
    }, [exportType])

    function update(key: string, value: unknown) {
        setOptions((prev) => ({ ...prev, [key]: value }))
    }

    function updateGrid(index: number, value: number | null) {
        setOptions((prev) => {
            const grid = [...(prev.grid || [3, 6])]
            grid[index] = value ?? grid[index]
            return { ...prev, grid }
        })
    }

    const pdfTypeOptions = [{ value: "default", label: translateText("example.default") }, { value: "text", label: translateText("export.text") }, { value: "slides", label: translateText("export.slides") }, { value: "media", label: translateText("items.media") }, ...(showHasChords(previewShow) ? [{ value: "chordSheet", label: "Chord Sheet" }] : [])]

    const type = options.type || "default"

    return (
        <div style={{ display: "flex", gap: "15px" }}>
            <div className={styles.options} style={{ flex: "0 0 300px" }}>
                <SelectField label="clock.type" style={{ marginBottom: "10px" }} options={pdfTypeOptions} value={type} onChange={(value) => update("type", value || "default")} />

                {type === "media" ? null : type !== "chordSheet" ? (
                    <>
                        <CheckboxField label="export.metadata" checked={!!options.metadata} onChange={(value) => update("metadata", value)} />
                        <CheckboxField label="export.page_numbers" checked={!!options.pageNumbers} onChange={(value) => update("pageNumbers", value)} />
                        <CheckboxField label="export.groups" checked={!!options.groups} onChange={(value) => update("groups", value)} />
                        <CheckboxField label="export.numbers" checked={!!options.numbers} onChange={(value) => update("numbers", value)} />
                        {type === "default" || type === "text" ? <CheckboxField label="tools.notes" checked={!!options.notes} onChange={(value) => update("notes", value)} /> : null}
                        <CheckboxField label="export.invert" disabled={type === "text"} checked={!!options.invert} onChange={(value) => update("invert", value)} />

                        <CheckboxField label="export.original_text_size" style={{ marginTop: "10px" }} disabled={type === "slides"} checked={options.originalTextSize !== false} onChange={(value) => update("originalTextSize", value)} />
                        <NumberField label="settings.font_size" disabled={type === "slides" || options.originalTextSize !== false} value={Number(options.textSize ?? 80)} onChange={(value) => update("textSize", value)} />

                        {type !== "text" ? (
                            <>
                                <NumberField label="export.rows" style={{ marginTop: "10px" }} value={options.grid?.[1] ?? 6} min={1} max={7} onChange={(value) => updateGrid(1, value)} />
                                <NumberField label="export.columns" disabled={type !== "slides"} value={options.grid?.[0] ?? 3} min={1} max={6} onChange={(value) => updateGrid(0, value)} />
                            </>
                        ) : null}
                    </>
                ) : (
                    <>
                        <NumberField label="settings.font_size" value={Number(options.fontSize ?? 15)} min={8} max={24} onChange={(value) => update("fontSize", value)} />
                        <NumberField label="export.margin (mm)" value={Number(options.margin ?? 20)} min={5} max={50} onChange={(value) => update("margin", value)} />
                        <NumberField label="edit.line_spacing" value={Number(options.spacing ?? 2) * 10} min={1} max={30} onChange={(value) => update("spacing", (value ?? 0) / 10)} />

                        <NumberField label="export.columns" style={{ marginTop: "10px" }} value={Number(options.columnsPerPage ?? 2)} min={1} max={3} onChange={(value) => update("columnsPerPage", value)} />

                        <h5 style={{ margin: "10px 0", textAlign: "center", color: "var(--text)" }}>
                            <T id="edit.chords" />
                        </h5>

                        <NumberField label="edit.font_size" value={Number(options.chordFontSize ?? 15)} min={6} max={20} onChange={(value) => update("chordFontSize", value)} />
                        <ColorField label="edit.color" value={options.chordColor || "#0066cc"} defaultValue="#0066cc" onChange={(value) => update("chordColor", value)} onInput={(value) => update("chordColor", value)} />
                    </>
                )}
            </div>

            <div className={styles.previewBox}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", margin: "10px", borderRadius: "4px", overflow: "hidden" }}>
                    <div ref={paper} className={styles.paper} style={{ "--paper-aspect-ratio": type === "media" ? "1920/1080" : "210/297" } as CSSProperties}>
                        <Pdf shows={previewShow ? [previewShow] : []} options={options} />
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--primary-darkest)" }}>
                    <Button
                        style={{ flex: 1 }}
                        icon="up"
                        onClick={() => {
                            const el = paper.current
                            if (el) el.scrollBy(0, -el.offsetHeight + 9.6)
                        }}
                    />
                    <Button
                        style={{ flex: 1 }}
                        icon="down"
                        onClick={() => {
                            const el = paper.current
                            if (el) el.scrollBy(0, el.offsetHeight - 7.001)
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
