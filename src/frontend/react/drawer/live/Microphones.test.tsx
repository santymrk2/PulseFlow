// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../shared/test/mockCommon"
import { Microphones } from "./Microphones"

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioMicrophone", () => ({ AudioMicrophone: { getList: mocks.list, start: vi.fn() } }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div data-testid="select">{children}</div> }))
vi.mock("./Mic", () => ({ Mic: ({ mic }: { mic: { id: string; name: string } }) => <div>{mic.name}</div> }))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([
        { deviceId: "m1", groupId: "g1", label: "Mic 1" },
        { deviceId: "m2", groupId: "g1", label: "Mic 2" }
    ])
})
afterEach(() => cleanup())

describe("Microphones", () => {
    it("agrupa los micrófonos por groupId", async () => {
        render(<Microphones />)
        expect(await screen.findByText("Mic 1")).toBeTruthy()
        expect(screen.getByText("Mic 2")).toBeTruthy()
        expect(document.querySelectorAll("[data-testid='select']")).toHaveLength(2)
    })

    it("muestra empty cuando no hay dispositivos", async () => {
        mocks.list.mockResolvedValue([])
        render(<Microphones />)
        await act(async () => {})
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })
})
