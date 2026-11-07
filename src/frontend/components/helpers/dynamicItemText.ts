// F23.17: texto de los ítems dinámicos (contador de slides, eventos, variables), sin stores, para que el
// proyector (sceneGraph.ts) y la vista previa (.svelte) muestren lo mismo.
//
// Inventario de lo que calculaba cada .svelte (slide/views/):
// - SlideProgress.svelte: tracker.type "number" (default) -> "<índice+1>/<total de la capa del layout>", con el
//   número en color --accent. "bar" (ancho %), "group" (nombres de grupo, la activa resaltada) y "project"
//   (lista de ítems del proyecto) son gráficos: slideTrackerText devuelve null y ya no llegan al proyector.
// - DynamicEvents.svelte: de $events (type "event") filtra por fecha de inicio (hoy + startDaysFromToday, o
//   startDate+startTime), opcional franja de un día (justOneDay, fromTime-toTime), ordena por inicio y corta a
//   maxEvents; por evento dibuja "HH:MM " (si event.time), nombre, " - lugar", ":" si hay notas y las notas en
//   otra línea con 4 nbsp. Depende de la hora actual (los eventos terminados desaparecen).
// - Variable.svelte: $variables[id]; "number" -> Number(number || 0); "text" -> text ("" si enabled === false y
//   hideText); el texto pasa después por replaceDynamicValues (impuro: lo aplica el llamador).

export interface SlideTrackerOptions {
    type?: string
}

export interface DynamicEventsOptions {
    maxEvents?: number
    startDaysFromToday?: number
    justOneDay?: boolean
    enableStartDate?: boolean
    startDate?: string
    startTime?: string
    fromTime?: string
    toTime?: string
}

export interface CalendarEvent {
    type: string
    name: string
    from: string
    to: string
    time?: boolean
    location?: string
    notes?: string
}

export interface VariableValue {
    type?: string
    number?: number
    text?: string
    enabled?: boolean
}

const NBSP4 = "    "
const pad2 = (n: number) => ("0" + n).slice(-2)

/** `current` es el índice 0-based de la slide (como `OutSlide.index`). `null` si el modo no es texto. */
export function slideTrackerText(tracker: SlideTrackerOptions, current: number, total: number): string | null {
    if ((tracker.type || "number") !== "number") return null
    return `${current + 1}/${total}`
}

function startOf(options: DynamicEventsOptions, now: Date): Date {
    if (options.enableStartDate) {
        const date = new Date(options.startDate ?? "")
        const time = options.startTime ?? "00:00"
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(time.slice(0, 2)), Number(time.slice(3, 5)))
    }
    const days = Number(options.startDaysFromToday || 0)
    const date = new Date(now)
    if (days) date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + days)
    return date
}

export function visibleEvents(options: DynamicEventsOptions, list: CalendarEvent[], now: Date): CalendarEvent[] {
    const start = startOf(options, now)
    let events = list.filter((a) => a.type === "event")

    if (options.justOneDay) {
        const [fromH, fromM] = (options.fromTime || "00:00").split(":").map(Number)
        const [toH, toM] = (options.toTime || "00:00").split(":").map(Number)
        const from = new Date(start)
        from.setHours(fromH, fromM, 0, 0)
        const to = new Date(start)
        to.setHours(toH, toM, 0, 0)
        if (to <= from) to.setDate(to.getDate() + 1)
        events = events.filter((a) => new Date(a.to) >= from && new Date(a.from) <= to)
    } else {
        events = events.filter((a) => new Date(a.to) >= start)
    }

    events.sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
    return options.maxEvents ? events.slice(0, options.maxEvents) : events
}

export function eventsText(options: DynamicEventsOptions, list: CalendarEvent[], now: Date): string {
    const lines: string[] = []
    visibleEvents(options, list, now).forEach((event) => {
        if (!event.name) return
        const from = new Date(event.from)
        const time = event.time ? `${pad2(from.getHours())}:${pad2(from.getMinutes())} ` : ""
        lines.push(`${time}${event.name}${event.location ? ` - ${event.location}` : ""}${event.notes ? ":" : ""}`)
        if (event.notes) lines.push(NBSP4 + event.notes)
    })
    return lines.join("\n")
}

/** Texto crudo de la variable (los `{...}` los resuelve el llamador). `hideText`: un texto deshabilitado se oculta. */
export function variableText(variable: VariableValue | undefined, hideText = true): string {
    if (variable?.type === "number") return String(Number(variable.number || 0))
    if (variable?.type === "text") return variable.enabled === false && hideText ? "" : variable.text || ""
    return ""
}
