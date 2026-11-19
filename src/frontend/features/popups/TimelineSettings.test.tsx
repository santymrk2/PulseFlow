// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { timeline } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../../shared/test/kitMocks"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { TimelineSettings } from "./TimelineSettings"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../timeline/logic/timeline", () => ({ formatTime: (ms: number) => `fmt:${ms}`, parseTime: (str: string) => str.length }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(value: object = {}) {
    restaurar = setStoresForTest([looseEntry(timeline, value)] as never)
    return render(<TimelineSettings />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("TimelineSettings", () => {
    it("muestra el tiempo inicial formateado y el valor por defecto del campo", () => {
        montar({ startTime: 1500 })
        expect(fields["timeline.start_time"]).toMatchObject({ value: "fmt:1500", defaultValue: "00:00:00;00" })
    })

    it("sin startTime usa 0", () => {
        montar()
        expect(fields["timeline.start_time"].value).toBe("fmt:0")
    })

    it("cambiar el campo guarda parseTime en timeline.startTime", () => {
        montar({ startTime: 10, other: 1 })
        fire("timeline.start_time", "onChange", "00:00:05;00")
        expect(get(timeline)).toEqual({ startTime: "00:00:05;00".length, other: 1 })
    })
})
