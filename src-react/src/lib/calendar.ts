// ----- FreeShow -----
// Módulo de calendario (subconjunto de `components/drawer/calendar`).

export interface CalendarDefinition {
    id: string
    name: string
    color: string
}

export interface CalendarEvent {
    id: string
    title: string
    /** Fecha en formato `YYYY-MM-DD`. */
    date: string
    /** Hora `HH:MM` opcional. */
    time?: string
    color: string
    notes?: string
}

export type Calendars = Record<string, { id: string; name: string; color: string }>
export type CalendarEvents = Record<string, CalendarEvent>

export const DEFAULT_CALENDARS: Record<string, { id: string; name: string; color: string }> = {
    general: { id: "general", name: "General", color: "#6366f1" },
    servicios: { id: "servicios", name: "Cultos", color: "#22c55e" },
}

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function toDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function parseDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** Matriz de 6×7 días (lunes primero) que cubre el mes indicado. */
export function monthMatrix(year: number, month: number): Date[][] {
    const first = new Date(year, month, 1)
    const startOffset = (first.getDay() + 6) % 7 // Lunes = 0
    const start = new Date(year, month, 1 - startOffset)
    const weeks: Date[][] = []
    for (let week = 0; week < 6; week += 1) {
        const days: Date[] = []
        for (let day = 0; day < 7; day += 1) {
            const current = new Date(start)
            current.setDate(start.getDate() + week * 7 + day)
            days.push(current)
        }
        weeks.push(days)
    }
    return weeks
}

export const MONTH_NAMES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]
