// ----- FreeShow -----
// Diálogo de importación: convierte ChordPro o texto plano en un show nuevo y
// lo guarda en la biblioteca.

import { useState } from "react"
import { FileText, Music4, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseChordPro } from "@/lib/chordpro"
import { showFromChordPro, showFromText } from "@/lib/import"
import { MAIN, Main } from "@/IPC/channels"

type ImportFormat = "chordpro" | "text"

interface ImportDialogProps {
    onClose: () => void
    onImported?: (id: string, name: string) => void
}

export default function ImportDialog({ onClose, onImported }: ImportDialogProps) {
    const [name, setName] = useState("")
    const [format, setFormat] = useState<ImportFormat>("chordpro")
    const [content, setContent] = useState("")

    const canImport = name.trim().length > 0 && content.trim().length > 0

    function doImport() {
        if (!canImport) return
        const title = name.trim()

        const show =
            format === "chordpro"
                ? (() => {
                      const parsed = parseChordPro(content, title)
                      return showFromChordPro(title, parsed.sections, parsed.notes)
                  })()
                : showFromText(title, content)

        const { id, ...data } = show
        window.api?.send(MAIN, { channel: Main.SAVE, data: { showsCache: { [id]: data } } })
        window.api?.send(MAIN, { channel: Main.SHOWS })
        onImported?.(show.id, title)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Upload className="size-4" />
                    Importar presentación
                </div>

                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nombre del show…"
                    className="h-8 text-sm"
                />

                <div className="flex gap-1">
                    {[
                        { value: "chordpro" as const, label: "ChordPro", icon: Music4 },
                        { value: "text" as const, label: "Texto plano", icon: FileText },
                    ].map((option) => (
                        <Button
                            key={option.value}
                            variant={format === option.value ? "secondary" : "ghost"}
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => setFormat(option.value)}
                        >
                            <option.icon className="size-3.5" />
                            {option.label}
                        </Button>
                    ))}
                </div>

                <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={
                        format === "chordpro"
                            ? "{title: Mi canción}\n{start_of_chorus}\n[C]Santo, [G]santo[Am] eres[F] tú\n{end_of_chorus}"
                            : "Cada bloque separado por una línea en blanco se convierte en una diapositiva…"
                    }
                    className="h-56 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 outline-none focus:border-indigo-500"
                />

        <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-600">
                {format === "chordpro" ? "Soporta acordes [C], secciones y metadatos." : "Divide por líneas en blanco."}
            </span>
            <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="text-zinc-400" onClick={onClose}>
                    Cancelar
                </Button>
                <Button size="sm" className="gap-1.5" disabled={!canImport} onClick={doImport}>
                    {format === "chordpro" ? <Music4 className="size-3.5" /> : <FileText className="size-3.5" />}
                    Importar
                </Button>
            </div>
            </div>
        </div>
        </div>
    )
}
