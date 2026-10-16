// ----- FreeShow -----
// Temporizadores / cuentas atrás. Porta la lógica de
// `src/frontend/components/drawer/timers/timers.ts` (tipos y formateo) adaptada
// al modelo de proyección sincronizado entre ventanas.

import type { ProjectionTimer } from "@/types/Output"

export type TimerMode = "countdown" | "elapsed" | "clock" | "event"

/** Definición guardable de un temporizador. */
export interface TimerEntry {
    name: string
    type: TimerMode
    /** Duración total en segundos (countdown). */
    duration: number
    /** Fecha ISO del evento (mode "event"). */
    eventDate?: string
}

export type TimersSettings = Record<string, TimerEntry>

export const DEFAULT_TIMERS: TimersSettings = {}

/** Formatea segundos como `MM:SS` (o `H:MM:SS`), con signo si es negativo. */
export function formatTimer(seconds: number): string {
    const sign = seconds < 0 ? "-" : ""
    const abs = Math.floor(Math.abs(seconds))
    const h = Math.floor(abs / 3600)
    const m = Math.floor((abs % 3600) / 60)
    const s = abs % 60
    const pad = (value: number) => String(value).padStart(2, "0")
    return h > 0 ? `${sign}${h}:${pad(m)}:${pad(s)}` : `${sign}${pad(m)}:${pad(s)}`
}

function toEpoch(iso: string | undefined): number {
    if (!iso) return 0
    const time = Date.parse(iso)
    return Number.isNaN(time) ? 0 : time
}

/** Construye el temporizador de proyección a partir de una entrada (iniciado). */
export function startProjectionTimer(id: string, entry: TimerEntry, now = Date.now()): ProjectionTimer {
    const duration = entry.duration || 0
    return {
        id,
        label: entry.name,
        mode: entry.type,
        total: duration,
        anchor: entry.type === "event" ? toEpoch(entry.eventDate) : now + duration * 1000,
        paused: entry.type === "clock",
        frozen: 0,
        visible: true,
    }
}

export interface TimerDisplay {
    /** Texto ya formateado para mostrar. */
    text: string
    /** Reloj de pared cuando el modo es "clock". */
    clock: string | null
    /** El temporizador ha llegado a cero (cuenta atrás/evento). */
    finished: boolean
    /** En tiempo extra (por debajo de cero). */
    overtime: boolean
    /** Segundos restantes/transcurridos. */
    seconds: number
}

/**
 * Calcula el estado visible del temporizador. Usa `anchor` (epoch) para evitar
 * depender de intervalos: cualquier ventana puede recalcular con `Date.now()`.
 */
export function computeTimer(timer: ProjectionTimer, now = Date.now()): TimerDisplay {
    if (timer.mode === "clock") {
        const date = new Date(now)
        return {
            text: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
            clock: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            finished: false,
            overtime: false,
            seconds: 0,
        }
    }

    const raw = timer.paused ? timer.frozen : (timer.anchor - now) / 1000
    const seconds = timer.mode === "elapsed" ? -raw : raw
    const finished = timer.mode !== "elapsed" && seconds <= 0
    return {
        text: formatTimer(seconds),
        clock: null,
        finished,
        overtime: seconds < 0,
        seconds,
    }
}

/** Pausa un temporizador congelando su valor actual. */
export function pauseTimer(timer: ProjectionTimer, now = Date.now()): ProjectionTimer {
    const raw = timer.mode === "elapsed" ? (now - timer.anchor) / 1000 : (timer.anchor - now) / 1000
    return { ...timer, paused: true, frozen: raw }
}

/** Reanuda un temporizador pausado recalculando su ancla. */
export function resumeTimer(timer: ProjectionTimer, now = Date.now()): ProjectionTimer {
    if (timer.mode === "elapsed") {
        return { ...timer, paused: false, anchor: now - timer.frozen * 1000 }
    }
    return { ...timer, paused: false, anchor: now + timer.frozen * 1000 }
}

/** Reinicia la cuenta atrás a su duración total (pausado). */
export function resetProjectionTimer(timer: ProjectionTimer, now = Date.now()): ProjectionTimer {
    return { ...timer, paused: true, frozen: timer.total, anchor: now + timer.total * 1000 }
}
