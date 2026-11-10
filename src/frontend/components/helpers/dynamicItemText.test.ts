import { describe, expect, it } from "vitest"
import { eventsLines, eventsText, hasTimeToken, joinStaticText, slideTrackerParts, slideTrackerText, variableText, visibleEvents, type CalendarEvent } from "./dynamicItemText"

const NB = "\u00A0\u00A0\u00A0\u00A0"

describe("slideTrackerText", () => {
    it("la slide 3 de 12 (índice 2) da 3/12, como SlideProgress", () => {
        expect(slideTrackerText({ type: "number" }, 2, 12)).toBe("3/12")
    })
    it("sin tipo es numérico", () => {
        expect(slideTrackerText({}, 0, 5)).toBe("1/5")
    })
    it("sin slide activa (-1) muestra 0/total", () => {
        expect(slideTrackerText({ type: "number" }, -1, 0)).toBe("0/0")
    })
    it("barra, grupos y proyecto no son texto", () => {
        expect(slideTrackerText({ type: "bar" }, 2, 12)).toBeNull()
        expect(slideTrackerText({ type: "group" }, 2, 12)).toBeNull()
        expect(slideTrackerText({ type: "project" }, 2, 12)).toBeNull()
    })
})

describe("variableText", () => {
    it("número: el valor, 0 si falta", () => {
        expect(variableText({ type: "number", number: 42 })).toBe("42")
        expect(variableText({ type: "number" })).toBe("0")
    })
    it("texto: el texto tal cual", () => {
        expect(variableText({ type: "text", text: "Hola {x}" })).toBe("Hola {x}")
        expect(variableText({ type: "text" })).toBe("")
    })
    it("texto deshabilitado se oculta sólo con hideText; el número no", () => {
        expect(variableText({ type: "text", text: "Hola", enabled: false })).toBe("")
        expect(variableText({ type: "text", text: "Hola", enabled: false }, false)).toBe("Hola")
        expect(variableText({ type: "number", number: 3, enabled: false })).toBe("3")
    })
    it("variable inexistente o de otro tipo da vacío", () => {
        expect(variableText(undefined)).toBe("")
        expect(variableText({})).toBe("")
    })
})

const NOW = new Date(2026, 10, 7, 12, 0, 0)
const ev = (o: Partial<CalendarEvent> & { name: string; from: Date; to: Date }): CalendarEvent => ({ type: "event", ...o, from: o.from.toISOString(), to: o.to.toISOString() })
const culto = ev({ name: "Culto", from: new Date(2026, 10, 8, 10, 30), to: new Date(2026, 10, 8, 12, 0), time: true, location: "Salón", notes: "Traer Biblia" })
const ensayo = ev({ name: "Ensayo", from: new Date(2026, 10, 9, 19, 0), to: new Date(2026, 10, 9, 20, 0) })
const pasado = ev({ name: "Viejo", from: new Date(2026, 10, 1, 9, 0), to: new Date(2026, 10, 1, 10, 0) })

describe("eventsText", () => {
    it("hora, nombre, lugar y notas como en DynamicEvents", () => {
        expect(eventsText({}, [culto], NOW)).toBe(`10:30 Culto - Salón:\n${NB}Traer Biblia`)
    })
    it("sin hora ni lugar ni notas es sólo el nombre; un evento por línea ordenados por fecha", () => {
        expect(eventsText({}, [ensayo, culto], NOW)).toBe(`10:30 Culto - Salón:\n${NB}Traer Biblia\nEnsayo`)
    })
    it("descarta eventos terminados, los que no son de tipo event y los sin nombre", () => {
        const accion = { ...ensayo, type: "action" as const }
        const sinNombre = { ...ensayo, name: "" }
        expect(eventsText({}, [pasado, accion, sinNombre], NOW)).toBe("")
    })
    it("maxEvents recorta; 0 no recorta", () => {
        expect(eventsText({ maxEvents: 1 }, [ensayo, culto], NOW)).toContain("Culto")
        expect(eventsText({ maxEvents: 1 }, [ensayo, culto], NOW)).not.toContain("Ensayo")
        expect(eventsText({ maxEvents: 0 }, [ensayo, culto], NOW)).toContain("Ensayo")
    })
    it("justOneDay filtra por la franja horaria del día de inicio", () => {
        const opts = { justOneDay: true, startDaysFromToday: 1, fromTime: "00:00", toTime: "23:59" }
        expect(visibleEvents(opts, [culto, ensayo], NOW).map((e) => e.name)).toEqual(["Culto"])
    })
    it("enableStartDate arranca en la fecha dada", () => {
        const opts = { enableStartDate: true, startDate: "2026-11-09T00:00", startTime: "19:30" }
        expect(visibleEvents(opts, [culto, ensayo, pasado], NOW).map((e) => e.name)).toEqual(["Ensayo"])
    })
})

describe("slideTrackerParts", () => {
    it("separa el número actual del total", () => {
        expect(slideTrackerParts({ type: "number" }, 2, 12)).toEqual({ current: "3", total: "12" })
    })
    it("null si no es modo número", () => {
        expect(slideTrackerParts({ type: "bar" }, 2, 12)).toBeNull()
    })
})

describe("eventsLines", () => {
    it("hora en negrita Arial a 0.8, nombre base, lugar en cursiva a 0.9 con los dos puntos, notas a 0.8", () => {
        expect(eventsLines({}, [culto], NOW)).toEqual([[{ text: "10:30 ", bold: true, scale: 0.8, family: "Arial" }, { text: "Culto" }, { text: " - Salón:", italic: true, scale: 0.9 }], [{ text: NB + "Traer Biblia", scale: 0.8 }]])
    })
    it("sin lugar los dos puntos van con el nombre", () => {
        const e = { ...ensayo, notes: "n" }
        expect(eventsLines({}, [e], NOW)[0]).toEqual([{ text: "Ensayo:" }])
    })
    it("sin hora ni lugar ni notas es sólo el nombre", () => {
        expect(eventsLines({}, [ensayo], NOW)).toEqual([[{ text: "Ensayo" }]])
    })
})

describe("hasTimeToken", () => {
    it.each(["{time_hours}:{time_minutes}", "Faltan {timer_oracion}", "en {video_countdown}", "{video_time}", "{audio_time}", "{audio_countdown}", "{time_str_day+1}"])("%s cambia solo", (text) => {
        expect(hasTimeToken(text)).toBe(true)
    })
    it.each(["hola", "{show_name}", "{video_duration}", "{audio_title}", "{$mi_variable}", "time_hours sin llaves"])("%s no cambia solo", (text) => {
        expect(hasTimeToken(text)).toBe(false)
    })
})

describe("joinStaticText", () => {
    it("excluye los ítems live: un reloj no cambia el texto plano", () => {
        const items = [{ text: "Bienvenidos" }, { text: "10:00", live: true }]
        expect(joinStaticText(items)).toBe("Bienvenidos")
        expect(joinStaticText([items[0], { text: "10:01", live: true }])).toBe(joinStaticText(items))
    })
})
