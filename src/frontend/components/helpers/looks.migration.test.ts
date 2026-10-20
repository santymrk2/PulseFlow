// F10.1 — migración idempotente al modelo de Looks (pantallas × looks).
// El fixture replica la estructura de un settings.json real de FreeShow
// (outputs en formato viejo con `style`/`stageOutput`, estilos con `layers`
// como array, looks con ids de estilo como strings).
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Output, Outputs } from "../../../../types/Output"
import type { Look, Styles } from "../../../../types/Settings"
import { buildLookStyle, computeLookBridgeStyles, computeLookOutputPointers, LOOK_STYLE_PREFIX, lookStyleId, migrateLooksSettings, type LooksMigrationInput } from "./looks"

// looks.ts importa stores con side-effects de la app (save/history); el test sólo
// ejercita las funciones puras, así que se stubbean esos módulos. language se
// mockea para cortar la cadena array → language → common → output → showActions →
// pdfjs (que necesita DOM y el test corre en node).
vi.mock("../../utils/save", () => ({ save: () => {} }))
vi.mock("./history", () => ({ history: () => {} }))
vi.mock("../../utils/language", () => ({ translateText: (id: string) => id, getLanguage: () => ({}), setLanguage: () => {} }))

// ---- fixture: 2 salidas de audiencia + 1 stage, 3 estilos, 2 looks (formato viejo) ----

const makeOutputs = (): Outputs => {
    const audience = (name: string, style: string): Output => ({
        enabled: true,
        active: true,
        name,
        color: "#FFFFFF",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        screen: "1",
        style
    })

    return {
        out1: audience("Principal", "styleA"),
        out2: audience("Lower thirds", "styleB"),
        // el formato viejo marca el stage con un string (id del layout de stage)
        stage1: { ...audience("Escenario", "styleStage"), stageOutput: "teaching" } as unknown as Output
    }
}

const makeStyles = (): { [id: string]: Styles } =>
    ({
        styleA: {
            name: "Principal",
            layers: ["background", "slide", "overlays"],
            template: "themeA",
            transition: { text: { type: "fade", duration: 300, easing: "" }, media: { type: "fade", duration: 300, easing: "" } },
            aspectRatio: { width: 16, height: 9 }
        },
        styleB: {
            name: "Lower thirds",
            layers: ["slide", "overlays"],
            template: "themeB",
            lines: 2,
            showAsFaded: true
        },
        styleStage: {
            name: "Stage",
            layers: ["background", "slide", "overlays"]
        }
    }) as unknown as { [id: string]: Styles }

const makeLooks = (): { [id: string]: Look } => ({
    // formato viejo: screens mapea outputId → id de estilo
    default: { name: "Default", screens: { out1: "styleA", out2: "styleB" } } as unknown as Look,
    letras: { name: "Sólo letras", screens: { out1: "styleB" } } as unknown as Look
})

const makeInput = (): LooksMigrationInput => ({
    looks: makeLooks(),
    styles: makeStyles(),
    outputs: makeOutputs(),
    activeLook: "letras",
    stylesLegacyBackup: {}
})

// ---------------------------------------------------------------- migración

describe("migrateLooksSettings", () => {
    it("convierte los ids de estilo de cada look en celdas LookScreen", () => {
        const result = migrateLooksSettings(makeInput())

        const defaultLook = result.looks.default
        expect(Object.keys(defaultLook.screens).sort()).toEqual(["out1", "out2"])

        // out1 venía de styleA: template → theme, layers array → booleanos
        expect(defaultLook.screens.out1.theme).toBe("themeA")
        expect(defaultLook.screens.out1.layers).toEqual({ media: true, slide: true, overlays: true })
        // styleB no tenía background → media apagado
        expect(defaultLook.screens.out2.layers).toEqual({ media: false, slide: true, overlays: true })
        expect(defaultLook.screens.out2.lines).toBe(2)

        // "Sólo letras" sólo mencionaba out1; out2 se completa con el estilo actual de la salida
        expect(result.looks.letras.screens.out2.theme).toBe("themeB")
    })

    it("las celdas de la salida de stage no viajan en los looks", () => {
        const result = migrateLooksSettings(makeInput())
        Object.values(result.looks).forEach((look) => {
            expect(Object.keys(look.screens)).not.toContain("stage1")
        })
    })

    it("stageOutput pasa a kind: stage + stageLayout y las audiencias ganan kind", () => {
        const result = migrateLooksSettings(makeInput())

        expect(result.outputs.stage1.kind).toBe("stage")
        expect(result.outputs.stage1.stageLayout).toBe("teaching")
        expect(result.outputs.out1.kind).toBe("audience")
        expect(result.outputs.out2.kind).toBe("audience")
    })

    it("aspectRatio del estilo pasa a la salida si no tenía propia", () => {
        const result = migrateLooksSettings(makeInput())
        expect(result.outputs.out1.aspectRatio).toEqual({ width: 16, height: 9 })
        expect(result.outputs.out2.aspectRatio).toBeUndefined()
    })

    it("copia los estilos originales a stylesLegacyBackup (sin entradas __look__)", () => {
        const result = migrateLooksSettings(makeInput())

        expect(Object.keys(result.stylesLegacyBackup).sort()).toEqual(["styleA", "styleB", "styleStage"])
        expect(result.stylesLegacyBackup.styleA).toEqual(makeStyles().styleA)
        expect(Object.keys(result.stylesLegacyBackup).some((id) => id.startsWith(LOOK_STYLE_PREFIX))).toBe(false)
    })

    it("todos los looks ganan transitionMs por defecto", () => {
        const result = migrateLooksSettings(makeInput())
        expect(result.looks.default.transitionMs).toBe(1000)
        expect(result.looks.letras.transitionMs).toBe(1000)
    })

    it("el look activo sigue existiendo", () => {
        const result = migrateLooksSettings(makeInput())
        expect(result.activeLook).toBe("letras")
        expect(result.looks[result.activeLook]).toBeTruthy()
    })

    it("correr la migración dos veces da exactamente lo mismo (idempotente)", () => {
        const first = migrateLooksSettings(makeInput())

        const secondInput: LooksMigrationInput = {
            looks: first.looks,
            styles: makeStyles(),
            outputs: first.outputs,
            activeLook: first.activeLook,
            stylesLegacyBackup: first.stylesLegacyBackup
        }
        const second = migrateLooksSettings(secondInput)

        expect(second.changed).toBe(false)
        expect(second.looks).toEqual(first.looks)
        expect(second.outputs).toEqual(first.outputs)
        expect(second.activeLook).toBe(first.activeLook)
        expect(second.stylesLegacyBackup).toEqual(first.stylesLegacyBackup)
    })

    it("sin looks crea 'Default' con el estilo actual de cada salida y lo pone en vivo", () => {
        const input = makeInput()
        input.looks = {}
        input.activeLook = ""

        const result = migrateLooksSettings(input)

        expect(Object.keys(result.looks)).toEqual(["default"])
        expect(result.looks.default.name).toBe("Default")
        expect(result.looks.default.screens.out1.theme).toBe("themeA")
        expect(result.looks.default.screens.out2.theme).toBe("themeB")
        expect(result.activeLook).toBe("default")
    })
})

// ------------------------------------------------------------------ puente

describe("puente Look → styles (F10.2)", () => {
    const migrated = migrateLooksSettings(makeInput())

    it("computeLookBridgeStyles genera una entrada __look__ por pantalla del look en vivo", () => {
        const look = migrated.looks.default
        const next = computeLookBridgeStyles(look, migrated.outputs, makeStyles())

        expect(next[lookStyleId("out1")]).toBeTruthy()
        expect(next[lookStyleId("out2")]).toBeTruthy()
        // la salida de stage no recibe entrada del puente
        expect(next[lookStyleId("stage1")]).toBeUndefined()
        // los estilos originales siguen intactos
        expect(next.styleA).toEqual(makeStyles().styleA)
    })

    it("computeLookBridgeStyles quita entradas __look__ viejas de looks anteriores", () => {
        const withOld: { [id: string]: Styles } = { ...makeStyles(), [lookStyleId("out1")]: { name: "vieja", layers: [] } as unknown as Styles }
        const next = computeLookBridgeStyles(migrated.looks.letras, migrated.outputs, withOld)

        expect(next[lookStyleId("out1")].name).toBe("Look")
        expect(Object.keys(next).filter((id) => id.startsWith(LOOK_STYLE_PREFIX))).toEqual([lookStyleId("out1"), lookStyleId("out2")])
    })

    it("buildLookStyle hornea la transición del look (transitionMs) cuando la celda no tiene propia", () => {
        const look: Look = { ...migrated.looks.default, transitionMs: 750 }
        // out2 viene de styleB, que no tenía transición propia
        const style = buildLookStyle(look, look.screens.out2)

        expect(style.transition).toEqual({
            text: { type: "fade", duration: 750, easing: "" },
            media: { type: "fade", duration: 750, easing: "" }
        })
    })

    it("buildLookStyle respeta la transición explícita de la celda", () => {
        const look: Look = { ...migrated.looks.default, transitionMs: 750 }
        // out1 hereda la transición de styleA (300ms) y tiene prioridad sobre transitionMs
        const style = buildLookStyle(look, look.screens.out1)

        expect(style.transition.text.duration).toBe(300)
    })

    it("computeLookOutputPointers sólo apunta las salidas que cambian y no toca el stage", () => {
        // out1 ya apunta a su entrada del puente; out2 quedó con el estilo viejo
        const outputsData: Outputs = {
            ...migrated.outputs,
            out1: { ...migrated.outputs.out1, style: lookStyleId("out1") }
        }

        const pointers = computeLookOutputPointers(migrated.looks.default, outputsData)
        expect(pointers).toEqual({ out2: lookStyleId("out2") })
        expect(pointers.stage1).toBeUndefined()
    })

    it("sin look activo no hay punteros ni entradas del puente", () => {
        expect(computeLookOutputPointers(undefined, migrated.outputs)).toEqual({})
        expect(computeLookBridgeStyles(undefined, migrated.outputs, makeStyles())).toEqual(makeStyles())
    })
})
