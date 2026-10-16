// ----- FreeShow -----
// Panel de Escrituras: lista las Biblias `.fsb` disponibles, permite navegar por
// libro/capítulo/versículo y buscar texto. Al hacer clic en un versículo se
// proyecta en la ventana de Audiencia con su referencia.

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, Loader2, Search, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { loadBible } from "@/IPC/bible"
import { readBiblesFolder, type BibleFile } from "@/IPC/files"
import { projectVerse } from "@/lib/outputActions"
import { cn } from "@/lib/utils"
import type { Bible, BibleBook, BibleChapter, BibleVerse } from "@/types/Bible"

interface FlatVerse {
    reference: string
    text: string
    nextText: string
}

function verseReference(book: BibleBook, chapter: BibleChapter, verse: BibleVerse): string {
    return `${book.abbreviation || book.name} ${chapter.number}:${verse.number}`
}

function flatten(bible: Bible): FlatVerse[] {
    const out: FlatVerse[] = []
    for (const book of bible.books ?? []) {
        for (const chapter of book.chapters ?? []) {
            const verses = chapter.verses ?? []
            verses.forEach((verse, index) => {
                out.push({
                    reference: verseReference(book, chapter, verse),
                    text: verse.text ?? verse.value ?? "",
                    nextText: verses[index + 1]?.text ?? verses[index + 1]?.value ?? "",
                })
            })
        }
    }
    return out
}

export default function ScripturePanel() {
    const [files, setFiles] = useState<BibleFile[]>([])
    const [selected, setSelected] = useState<string>("")
    const [bible, setBible] = useState<Bible | null>(null)
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState("")

    const [bookIndex, setBookIndex] = useState<number | null>(null)
    const [chapterIndex, setChapterIndex] = useState<number | null>(null)

    useEffect(() => {
        readBiblesFolder()
            .then((list) => {
                setFiles(list)
                if (list.length && !selected) setSelected(list[0].name)
            })
            .catch(() => setFiles([]))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!selected) return
        let cancelled = false
        setLoading(true)
        setBible(null)
        setBookIndex(null)
        setChapterIndex(null)
        loadBible(selected, selected)
            .then((result) => {
                if (!cancelled) setBible(result)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [selected])

    const flat = useMemo(() => (bible ? flatten(bible) : []), [bible])

    const results = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return []
        return flat.filter((v) => v.text.toLowerCase().includes(q)).slice(0, 200)
    }, [flat, query])

    function project(verse: FlatVerse) {
        projectVerse(verse.text, verse.reference, verse.nextText, verse.reference)
    }

    if (files.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center text-zinc-600">
                <Sparkles className="size-5" />
                <p className="text-xs">No hay Biblias instaladas</p>
                <p className="text-[11px] text-zinc-700">
                    Coloca archivos <code>.fsb</code> en la carpeta Bibles
                </p>
            </div>
        )
    }

    const book = bible && bookIndex != null ? bible.books[bookIndex] : null
    const chapter = book && chapterIndex != null ? book.chapters[chapterIndex] : null

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-2 px-2 pb-2">
                <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Elegir Biblia" />
                    </SelectTrigger>
                    <SelectContent>
                        {files.map((file) => (
                            <SelectItem key={file.name} value={file.name}>
                                {file.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-500" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar versículos…"
                        className="h-7 pl-7 text-xs"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center text-zinc-600">
                    <Loader2 className="size-4 animate-spin" />
                </div>
            ) : query.trim() ? (
                <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-px px-2 pb-2">
                        {results.length === 0 ? (
                            <p className="px-1 py-3 text-center text-xs text-zinc-600">Sin resultados</p>
                        ) : (
                            results.map((verse, index) => (
                                <button
                                    key={`${verse.reference}-${index}`}
                                    type="button"
                                    onClick={() => project(verse)}
                                    className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline-none"
                                >
                                    <span className="text-[11px] font-medium text-blue-400">{verse.reference}</span>
                                    <span className="line-clamp-2 text-xs text-zinc-300">{verse.text}</span>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-px px-2 pb-2">
                        {!bible ? null : book ? (
                            <>
                                <BackRow label={book.name} onClick={() => (chapter ? setChapterIndex(null) : setBookIndex(null))} />
                                {chapter ? (
                                    <div className="flex flex-wrap gap-1 px-1 pt-1">
                                        {book.chapters.map((c, index) => (
                                            <button
                                                key={c.number}
                                                type="button"
                                                onClick={() => setChapterIndex(index)}
                                                className={cn(
                                                    "min-w-7 rounded px-2 py-0.5 text-[11px]",
                                                    index === chapterIndex
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                                )}
                                            >
                                                {c.number}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1 px-1 pt-1">
                                        {book.chapters.map((c, index) => (
                                            <button
                                                key={c.number}
                                                type="button"
                                                onClick={() => setChapterIndex(index)}
                                                className="min-w-7 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
                                            >
                                                {c.number}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            bible.books.map((b, index) => (
                                <button
                                    key={b.number}
                                    type="button"
                                    onClick={() => setBookIndex(index)}
                                    className="flex items-center justify-between rounded px-2 py-1.5 text-left hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline-none"
                                >
                                    <span className="text-xs text-zinc-300">{b.name}</span>
                                    <span className="text-[10px] text-zinc-600">{b.chapters.length} cap.</span>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}

function BackRow({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="mb-1 flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
        >
            <ChevronLeft className="size-3" />
            {label}
        </button>
    )
}
