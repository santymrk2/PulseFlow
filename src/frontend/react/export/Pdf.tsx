// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { EXPORT } from "../../../types/Channels"
import type { Show } from "../../../types/Show"
import { currentWindow } from "../../shared/core/stores"
import { send } from "../../shared/utils/request"
import { useStore } from "../hooks/useStore"
import { Zoomed } from "../slide/Zoomed"
import { Textbox } from "../slide/Textbox"
import { MediaItem } from "../slide/views/MediaItem"
import { cn } from "../../shared/core/lib/utils"
import styles from "./Pdf.module.css"

interface PdfProps {
    shows?: unknown[]
    options?: unknown
    path?: string
}

function getGroupName(show: Show, group: string, slideID: string) {
    let name = group
    if (name) {
        const added: Record<string, number> = {}
        Object.entries(show.slides || {}).forEach(([id, a]: unknown) => {
            if (added[a.group]) {
                added[a.group]++
                if (id === slideID) name += " #" + added[a.group]
            } else added[a.group] = 1
        })
    }
    return name
}

function formatLyricsWithChords(slide: unknown): { text: string; isChord: boolean }[] {
    const lines: { text: string; isChord: boolean }[] = []

    slide.items?.forEach((item: unknown) => {
        item.lines?.forEach((line: unknown) => {
            if (!line.text || line.text.length === 0) return

            let textContent = ""
            line.text.forEach((text: unknown) => {
                textContent += text.value || ""
            })

            if (!textContent.trim()) return

            if (line.chords && line.chords.length > 0) {
                const chordLine = createChordLine(textContent, line.chords)
                if (chordLine.trim()) {
                    lines.push({ text: chordLine, isChord: true })
                }
            }

            lines.push({ text: textContent, isChord: false })
        })
    })

    return lines
}

function getShowChords(show: Show): string[] {
    const chords = new Set<string>()

    Object.values(show.slides || {}).forEach((slide: unknown) => {
        slide.items?.forEach((item: unknown) => {
            item.lines?.forEach((line: unknown) => {
                line.chords?.forEach((chord: unknown) => {
                    chords.add(chord.key)
                })
            })
        })
    })

    return Array.from(chords).sort()
}

function getSongKey(show: Show): string {
    if (show.meta?.key && String(show.meta.key).trim()) {
        return String(show.meta.key).trim()
    }

    const chords = getShowChords(show)
    if (chords.length > 0) {
        const chordCounts: Record<string, number> = {}

        Object.values(show.slides || {}).forEach((slide: unknown) => {
            slide.items?.forEach((item: unknown) => {
                item.lines?.forEach((line: unknown) => {
                    line.chords?.forEach((chord: unknown) => {
                        const key = chord.key
                        if (key) chordCounts[key] = (chordCounts[key] || 0) + 1
                    })
                })
            })
        })

        const mostCommon = Object.entries(chordCounts).sort(([, a], [, b]) => b - a)[0]
        if (mostCommon) return mostCommon[0]
        return chords[0]
    }

    return "C"
}

function getShowNotes(show: Show): string {
    const activeLayoutId = show.settings?.activeLayout
    if (activeLayoutId && show.layouts?.[activeLayoutId]?.notes) {
        return String(show.layouts[activeLayoutId].notes).trim()
    }

    if (show.layouts) {
        for (const layout of Object.values(show.layouts) as unknown as never[]) {
            if (layout.notes && String(layout.notes).trim()) {
                return String(layout.notes).trim()
            }
        }
    }

    return ""
}

function createChordLine(text: string, chords: unknown[]): string {
    const chordArray = new Array(Math.max(text.length + 20, 80)).fill(" ")
    const sortedChords = [...chords].sort((a, b) => (a.pos || 0) - (b.pos || 0))

    sortedChords.forEach((chord) => {
        const chordStr = chord.chord || chord.key || ""
        const pos = Math.max(0, Math.min(chord.pos || 0, chordArray.length - chordStr.length))
        for (let i = 0; i < chordStr.length && pos + i < chordArray.length; i++) {
            chordArray[pos + i] = chordStr[i]
        }
    })

    return chordArray.join("").trimEnd()
}

function groupSlidesBySection(slides: unknown[]): unknown[] {
    const sections: unknown[] = []
    const groupCounts: Record<string, number> = {}

    slides.forEach((slide) => {
        const groupName = slide.group || "Verse"
        groupCounts[groupName] = (groupCounts[groupName] || 0) + 1
        sections.push({
            name: `${groupName} ${groupCounts[groupName]}`,
            slides: [slide]
        })
    })

    return sections
}

function getPagesForShow(show: unknown, layoutSlides: Record<string, any[]>, showOptions: unknown) {
    if (show && show.type === "section") return 1
    if (!show || !layoutSlides[show.id!]) return 0
    const slides = layoutSlides[show.id!]
    if (!slides.length) return 0

    const type = showOptions.type || "default"
    if (type === "media") return slides.length

    const grid1 = showOptions.grid?.[1] || 6
    const grid0 = showOptions.grid?.[0] || 3
    const divider = type === "default" ? 1 : type !== "text" ? grid0 : 1.5
    return Math.ceil(slides.length / grid1 / divider)
}

function computeLayoutSlides(shows: unknown[]) {
    const layoutSlides: Record<string, any[]> = {}

    shows.forEach((show: unknown) => {
        const a: unknown[] = []
        const layout = show.layouts?.[show.settings?.activeLayout]
        layout?.slides?.forEach((layoutSlide: unknown) => {
            const slide = show.slides?.[layoutSlide.id]
            if (!slide) return

            slide.data = layoutSlide
            a.push(slide)
            if (!slide.children) return

            slide.children.forEach((childId: string) => {
                const child = show.slides?.[childId]
                if (!child) return
                child.data = layoutSlide
                a.push(child)
            })
        })

        layoutSlides[show.id!] = a

        const metaDisplay = Object.values((show.meta || {}) as Record<string, string>)
            .filter((v) => v && String(v).length)
            .join("; ")
        show.metaDisplay = metaDisplay
    })

    return layoutSlides
}

export function Pdf({ shows: showsProp = [], options: optionsProp = {}, path: pathProp = "" }: PdfProps) {
    const currentWindowValue = useStore(currentWindow)
    const [shows, setShows] = useState<any[]>(showsProp)
    const [options, setOptions] = useState<unknown>(optionsProp)
    const [, setPath] = useState(pathProp)
    const [index, setIndex] = useState(0)
    const exportTriggered = useRef(false)

    useEffect(() => { setShows(showsProp) }, [showsProp])
    useEffect(() => { setOptions(optionsProp) }, [optionsProp])
    useEffect(() => { setPath(pathProp) }, [pathProp])

    const layoutSlides = useMemo(() => computeLayoutSlides(shows), [shows])

    useEffect(() => {
        const api = (window as unknown as never).api
        if (!api?.receive) return

        api.receive(EXPORT, (a: unknown) => {
            if (a.channel === "PDF") {
                setShows(a.data.shows || [])
                setOptions(a.data.options || {})
                setPath(a.data.path || "")
                setIndex(0)
                exportTriggered.current = false
            } else if (a.channel === "NEXT") {
                setIndex((prev) => {
                    if (options?.oneFile) {
                        send(EXPORT, ["DONE"], { name: options?.name || shows[0]?.name || "Export" })
                        return prev
                    }
                    const next = prev + 1
                    if (shows.length > next) {
                        // export will trigger via effect on index change if needed; schedule directly
                        setTimeout(() => triggerExport(next), 0)
                        return next
                    }
                    send(EXPORT, ["DONE"], { name: shows[prev]?.name || "" })
                    return prev
                })
            }
        })
    }, [])

    function triggerExport(currentIndex = index) {
        const showsToUse = shows
        const opts = options || {}
        const name = opts.oneFile ? opts.name || showsToUse[0]?.name || "Export" : showsToUse[currentIndex]?.name || ""
        const pagesCount = opts.oneFile
            ? showsToUse.reduce((sum, s) => sum + getPagesForShow(s, layoutSlides, opts), 0)
            : getPagesForShow(showsToUse[currentIndex], layoutSlides, opts)
        setTimeout(() => send(EXPORT, ["EXPORT"], { type: "pdf", name, options: { type: opts.type } }), 20 * (pagesCount + 1) + 1000)
    }

    useEffect(() => {
        if (!shows.length) return
        if (currentWindowValue !== "pdf") return
        if (exportTriggered.current) return
        exportTriggered.current = true
        triggerExport(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shows, layoutSlides, currentWindowValue])

    const renderedShows = options?.oneFile ? shows : shows[index] ? [shows[index]] : []

    const mainClass = [options?.type === "slides" ? "flow" : "", options?.type === "chordSheet" ? "chord-sheet" : ""].filter(Boolean).join(" ")

    return (
        <main className={cn(styles.main, mainClass)}>
            {shows.length ? (
                options?.type === "media" ? (
                    renderedShows.map((show: unknown, si: number) => (
                        show.type === "section" ? (
                            <div key={`sec-${si}`} className={styles.mediaPage} style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", pageBreakAfter: "always", background: show.color || "linear-gradient(135deg, #1e293b, #0f172a)" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "white", padding: 40, boxSizing: "border-box", width: "100%", height: "100%" }}>
                                    <div className="section-accent" style={{ width: 120, height: 6, backgroundColor: "rgba(255,255,255,0.8)", marginBottom: 40, borderRadius: 3 }} />
                                    <h1 style={{ fontSize: 130, fontWeight: 800, textTransform: "uppercase", letterSpacing: -3, margin: "0 0 30px 0", textShadow: "0 8px 24px rgba(0,0,0,0.4)", color: "white", fontFamily: "sans-serif", lineHeight: 1.1 }}>{show.name}</h1>
                                    {show.notes ? <><div style={{ width: 300, height: 2, backgroundColor: "rgba(255,255,255,0.25)", margin: "30px 0" }} /><p style={{ fontSize: 50, fontStyle: "italic", color: "rgba(255,255,255,0.9)", maxWidth: "80%", margin: 0, lineHeight: 1.5, textShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>{show.notes}</p></> : null}
                                    {show.data?.time ? <div style={{ marginTop: 50, fontSize: 32, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "12px 36px", borderRadius: 40, fontWeight: 600, textTransform: "uppercase", letterSpacing: 3, border: "2px solid rgba(255,255,255,0.25)", textShadow: "0 4px 8px rgba(0,0,0,0.2)" }}>{show.data.time}</div> : null}
                                </div>
                            </div>
                        ) : (
                            (layoutSlides[show.id || ""] || []).map((slide: unknown, i: number) => (
                                <div key={`${show.id}-${i}`} className={styles.mediaPage} style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", pageBreakAfter: "always" }}>
                                    <Zoomed style="display: flex;justify-content: center;width: 100%; height: 100%;" zoom={true}>
                                        {show.media?.[slide.data?.background]?.path ? (
                                            <div className="media" style={{ height: "100%" }}>
                                                <MediaItem item={{ style: "", type: "media", src: show.media[slide.data.background].path } as unknown as never} preview />
                                            </div>
                                        ) : null}
                                        {slide.items ? slide.items.map((item: unknown, ii: number) => (
                                            <Textbox key={ii} item={item} ref={{ showId: show.id, id: slide.id } as unknown as never} chords={item.chords?.enabled} mirror />
                                        )) : null}
                                    </Zoomed>
                                </div>
                            ))
                        )
                    ))
                ) : options?.type === "chordSheet" ? (
                    renderedShows.map((show: unknown, si: number) => (
                        <div key={si} className={`${styles.chordSheetPage} chord-sheet-page`} style={{ padding: options.margin || 20, ["--font-size" as string]: `${options.fontSize || 12}px`, ["--chord-font-size" as string]: `${options.chordFontSize || 10}px`, ["--chord-color" as string]: options.chordColor || "#0066cc", fontSize: options.fontSize || 12, lineHeight: options.spacing || 1.5, ...(show.type === "section" || show.type === "image" || show.type === "video" || show.type === "audio" ? { justifyContent: "center", alignItems: "center", textAlign: "center", background: "white" } : {}) } as CSSProperties}>
                            {show.type === "section" ? (
                                <div style={{ maxWidth: "80%", width: "100%" }}>
                                    {show.color ? <div style={{ width: 80, height: 6, backgroundColor: show.color, margin: "0 auto 30px auto", borderRadius: 3 }} /> : null}
                                    <h1 style={{ fontSize: "3.5em", fontWeight: 800, margin: "0 0 15px 0", color: "#111", letterSpacing: -1, textTransform: "uppercase" }}>{show.name}</h1>
                                    <div style={{ width: 150, height: 1, backgroundColor: "#ddd", margin: "25px auto" }} />
                                    {show.notes ? <p style={{ fontSize: "1.2em", fontStyle: "italic", color: "#555", marginBottom: 25, lineHeight: 1.6 }}>{show.notes}</p> : null}
                                    {show.data?.time ? <span style={{ display: "inline-block", backgroundColor: "#f0f0f0", color: "#333", padding: "6px 16px", borderRadius: 20, fontSize: "0.9em", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, border: "1px solid #e0e0e0" }}>{show.data.time}</span> : null}
                                </div>
                            ) : show.type === "image" || show.type === "video" || show.type === "audio" ? (
                                <div style={{ maxWidth: "80%", width: "100%", textAlign: "center", margin: "auto 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <h1 style={{ fontSize: "2.5em", fontWeight: 700, color: "#222", marginBottom: 10, textTransform: "uppercase", letterSpacing: -0.5 }}>[ {show.name} ]</h1>
                                    <div style={{ fontSize: "0.95em", color: "#777", marginBottom: 30, textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>Media Item ({show.type})</div>
                                    {show.type === "image" ? (
                                        <div style={{ maxWidth: "100%", height: "180mm", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #ccc", padding: 10, borderRadius: 8, background: "#fafafa", overflow: "hidden", margin: "0 auto", boxSizing: "border-box" }}>
                                            <img src={show.media?.[show.id]?.path} alt={show.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <div className={styles.header}>
                                        {options.title && show.name ? <h1 className={styles.titleChord}>{show.name}</h1> : null}
                                        <div className={styles.songInfo}>
                                            {options.artist && show.meta?.artist ? <span>by {show.meta.artist}</span> : null}
                                            {options.key ? <span>Key: {getSongKey(show)}</span> : null}
                                        </div>
                                    </div>

                                    <div className={styles.chordSections} style={{ ["--columns" as string]: options.columnsPerPage || 1 } as CSSProperties}>
                                        {groupSlidesBySection(layoutSlides[show.id] || []).map((section, sectionIndex, arr) => (
                                            <div key={sectionIndex} className={styles.section} style={{ marginBottom: sectionIndex === arr.length - 1 ? 8 : 15 }}>
                                                <h3 className={styles.sectionTitle}>{section.name}</h3>
                                                {section.slides.map((slide: unknown, slideIndex: number) => (
                                                    <div key={slideIndex} className={styles.verse} style={{ marginBottom: slideIndex === section.slides.length - 1 ? 8 : 12 }}>
                                                        {formatLyricsWithChords(slide).map((line, li) => (
                                                            line.text.trim() ? (
                                                                <div key={li} className={`${styles.line} ${line.isChord ? `${styles.chordLine} chord-line` : `${styles.lyricLine}`}`}>
                                                                    <pre className={styles.lineContent}>{line.text}</pre>
                                                                </div>
                                                            ) : null
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {options.showChords && getShowChords(show).length > 0 ? (
                                        <div className={styles.chordDiagrams}>
                                            <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "black", fontWeight: "bold" }}>Chords Used:</h4>
                                            <div className={styles.chordList}>
                                                {getShowChords(show).map((chord) => <span key={chord} className={styles.chordName}>{chord}</span>)}
                                            </div>
                                        </div>
                                    ) : null}

                                    {options.showNotes && (show.meta?.notes || getShowNotes(show)) ? (
                                        <div className={styles.notesSection}>
                                            <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "black", fontWeight: "bold" }}>Notes:</h4>
                                            <div className={styles.notesContent}>{show.meta?.notes || getShowNotes(show)}</div>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    ))
                ) : (
                    renderedShows.map((show: unknown) => {
                        const showPages = getPagesForShow(show, layoutSlides, options)
                        const isFlow = options?.type === "slides" && show.type !== "section"
                        return (
                            <div key={show.id || show.name} className={`${styles.showContainer} show-container ${isFlow ? "flow" : ""}`} style={{ position: "relative", ...(options?.type !== "text" || show.type === "section" ? { height: `calc(100vh * ${showPages})` } : {}), pageBreakAfter: "always" } as CSSProperties}>
                                {show.type === "section" ? (
                                    <div className={styles.sectionPage} style={{ background: show.color ? show.color : "linear-gradient(135deg, #1e293b, #0f172a)" }}>
                                        <div style={{ width: 80, height: 4, backgroundColor: "#fff", marginBottom: 30, borderRadius: 2, opacity: 0.8 }} />
                                        <h1 style={{ fontSize: "54pt", fontWeight: 800, textTransform: "uppercase", letterSpacing: -2, margin: "0 0 20px 0", color: "#fff", textShadow: "0 4px 12px rgba(0,0,0,0.3)", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', lineHeight: 1.1 }}>{show.name}</h1>
                                        {show.notes ? <><div style={{ width: 200, height: 1, backgroundColor: "rgba(255,255,255,0.25)", margin: "25px 0" }} /><p style={{ fontSize: "20pt", fontStyle: "italic", color: "rgba(255,255,255,0.85)", maxWidth: "80%", margin: 0, lineHeight: 1.5, textShadow: "0 2px 6px rgba(0,0,0,0.2)", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{show.notes}</p></> : null}
                                        {show.data?.time ? <div style={{ marginTop: 40, fontSize: "14pt", background: "rgba(255,255,255,0.15)", color: "#fff", padding: "8px 24px", borderRadius: 30, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, border: "1px solid rgba(255,255,255,0.25)", textShadow: "0 2px 4px rgba(0,0,0,0.15)" }}>{show.data.time}</div> : null}
                                    </div>
                                ) : (
                                    <>
                                        {options?.title ? <div style={{ position: "absolute", width: "100%" }}><h1 className={styles.title}>{show.name}</h1></div> : null}
                                        {(layoutSlides[show.id || ""] || []).map((slide: unknown, i: number) => (
                                            <div key={i} className={`${styles.slide} slide ${options?.type === "text" ? styles.padding : options?.type !== "slides" ? (i === 0 ? styles.padding : "") : (i < (options?.grid?.[0] || 3) ? styles.padding : "")} ${options?.type === "text" ? styles.noBreak : ""}`} style={options?.type !== "text" ? { height: `calc(100vh / ${options?.grid?.[1] || 6} - 0.1px)`, ...(options?.type === "slides" ? { width: `calc(100% / ${options?.grid?.[0] || 3})` } : {}) } : undefined}>
                                                {options?.groups ? <p className={`${styles.group} group`} style={options?.type === "text" ? { padding: "0 60px", marginTop: -6 } : undefined}>{slide.group ? getGroupName(show, slide.group, slide.id) : ""}</p> : null}
                                                {options?.numbers ? <p className={`${styles.number} number`} style={options?.type === "text" ? { padding: "0 60px", marginTop: -6 } : undefined}>{i + 1}</p> : null}
                                                {options?.type !== "text" ? (
                                                    <div className={`${styles.slides} slides ${options?.invert ? `${styles.invert} invert` : ""}`}>
                                                        <Zoomed style="display: flex;justify-content: center;width: 100%;" zoom={true}>
                                                            {show.media?.[slide.data?.background]?.path ? (
                                                                <div className="media" style={{ height: "100%" }}>
                                                                    <MediaItem item={{ style: "", type: "media", src: show.media[slide.data.background].path } as unknown as never} preview />
                                                                </div>
                                                            ) : null}
                                                            {slide.items ? slide.items.map((item: unknown, ii: number) => (
                                                                <Textbox key={ii} item={item} ref={{ showId: show.id, id: slide.id } as unknown as never} chords={item.chords?.enabled} mirror />
                                                            )) : null}
                                                        </Zoomed>
                                                    </div>
                                                ) : null}
                                                {options?.type !== "slides" ? (
                                                    <div className={`${styles.text} text ${options?.type === "text" ? `${styles.margin} margin` : ""}`}>
                                                        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
                                                            {slide.items ? slide.items.map((item: unknown, ii: number) => (
                                                                (item.type === undefined || item.type === "text" || item.type === "timer") ? (
                                                                    <Textbox key={ii} item={item} ref={{ showId: show.id, id: slide.id } as unknown as never} customFontSize={options?.originalTextSize ? null : options?.textSize} style={false} />
                                                                ) : null
                                                            )) : null}
                                                            {options?.notes && slide.notes ? <p className={styles.notes}>{slide.notes}</p> : null}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                        {options?.pageNumbers ? (layoutSlides[show.id || ""] || []).map((_: unknown, i: number) => (
                                            i > 0 && i % (options?.grid?.[0] || 3) === 0 && i / (options?.grid?.[0] || 3) < showPages ? (
                                                <div key={`page-${i}`} className={`${styles.page} page`} style={{ top: `calc(100vh * ${i / (options?.grid?.[0] || 3) - 0.012} - 30px)` }}>
                                                    {i / (options?.grid?.[0] || 3)}/{showPages}
                                                </div>
                                            ) : null
                                        )) : null}
                                        {options?.pageNumbers && ((layoutSlides[show.id || ""] || []).length - 1) / (options?.type !== "slides" ? 1 : (options?.grid?.[0] || 3)) / (showPages || 1) < showPages ? (
                                            <div className={`${styles.page} page`} style={{ top: `calc(100vh * ${showPages - 0.012} - 30px)` }}>
                                                {showPages}/{showPages}
                                            </div>
                                        ) : null}
                                    </>
                                )}
                                {options?.metadata ? (
                                    options?.type === "text" ? (
                                        <p style={{ textAlign: "center", fontSize: 12, opacity: 0.8, margin: "20px 0 0" }}>{show.metaDisplay}</p>
                                    ) : (
                                        <div style={{ position: "absolute", top: `calc(100vh * ${showPages} - 25px)`, width: "100%" }}>
                                            <p style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>{show.metaDisplay}</p>
                                        </div>
                                    )
                                ) : null}
                            </div>
                        )
                    })
                )
            ) : null}
        </main>
    )
}
