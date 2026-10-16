// ----- FreeShow -----
// Calendario: rejilla mensual con eventos, creación/edición/borrado.
// Simplificación de `drawer/calendar/Calendar.svelte`.

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MONTH_NAMES, monthMatrix, toDateKey } from "@/lib/calendar"
import { useCalendarStore } from "@/store/useCalendarStore"

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]

export default function CalendarPanel() {
    const events = useCalendarStore((s) => s.events)
    const addEvent = useCalendarStore((s) => s.addEvent)
    const deleteEvent = useCalendarStore((s) => s.deleteEvent)

    const [initial] = useState(() => {
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth(), selected: toDateKey(now) }
    })
    const [year, setYear] = useState(initial.year)
    const [month, setMonth] = useState(initial.month)
    const [selected, setSelected] = useState<string>(initial.selected)
    const [draft, setDraft] = useState("")

    const matrix = useMemo(() => monthMatrix(year, month), [year, month])
    const byDate = useMemo(() => {
        const map: Record<string, typeof events> = {}
        for (const event of events) {
            map[event.date] = map[event.date] ? [...map[event.date], event] : [event]
        }
        return map
    }, [events])

    const selectedEvents = byDate[selected] ?? []

    function shift(offset: number) {
        const next = new Date(year, month + offset, 1)
        setYear(next.getFullYear())
        setMonth(next.getMonth())
    }

    return (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span>Calendario</span>
                <span className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" className="text-zinc-500" onClick={() => shift(-1)}>
                        <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-zinc-500" onClick={() => shift(1)}>
                        <ChevronRight className="size-3.5" />
                    </Button>
                </span>
            </div>

            <div className="text-center text-xs text-zinc-300">
                {MONTH_NAMES[month]} {year}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-600">
                {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {matrix.flat().map((date) => {
                    const key = toDateKey(date)
                    const inMonth = date.getMonth() === month
                    const isSelected = key === selected
                    const dayEvents = byDate[key] ?? []
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setSelected(key)}
                            className={`flex aspect-square flex-col items-center justify-center rounded text-[11px] transition-colors ${
                                isSelected
                                    ? "bg-indigo-500 text-white"
                                    : inMonth
                                      ? "text-zinc-300 hover:bg-zinc-800"
                                      : "text-zinc-700"
                            }`}
                        >
                            {date.getDate()}
                            {dayEvents.length > 0 && (
                                <span className={`mt-0.5 size-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-400"}`} />
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-zinc-800 pt-3">
                <span className="text-[10px] text-zinc-500">{selected}</span>
                {selectedEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: event.color }} />
                        <span className="flex-1 truncate text-xs text-zinc-300">{event.title}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-zinc-600 hover:text-red-400"
                            onClick={() => deleteEvent(event.id)}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
                {selectedEvents.length === 0 && <p className="text-[11px] text-zinc-600">Sin eventos.</p>}

                <div className="flex items-center gap-1.5 pt-1">
                    <Input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Nuevo evento…"
                        className="h-7 flex-1 text-xs"
                        onKeyDown={(event) => {
                            if (event.key !== "Enter" || !draft.trim()) return
                            addEvent({ title: draft.trim(), date: selected, color: "#6366f1" })
                            setDraft("")
                        }}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                        onClick={() => {
                            if (!draft.trim()) return
                            addEvent({ title: draft.trim(), date: selected, color: "#6366f1" })
                            setDraft("")
                        }}
                    >
                        <Plus className="size-3.5" />
                        Añadir
                    </Button>
                </div>
            </div>
        </div>
    )
}
