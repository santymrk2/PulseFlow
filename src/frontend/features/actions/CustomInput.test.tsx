// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/core/ipc/main", () => ({ requestMain: vi.fn(async () => []) }))
vi.mock("../../shared/audio/audioMicrophone", () => ({ AudioMicrophone: { getList: vi.fn(async () => []) } }))
vi.mock("../../shared/audio/routing/audioRoutingManager", () => ({ AudioRoutingManager: { sortChannels: (x: unknown) => x } }))
vi.mock("../media/logic/cameraManager", () => ({ cameraManager: { getCamerasList: vi.fn(async () => []) } }))
vi.mock("../../app/wiring/obsTalk", () => ({ obsGetScenes: vi.fn(async () => []) }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ keysToID: () => [], sortByName: (a: unknown[]) => a }))
vi.mock("../show/logic/tools/groups", () => ({ getGlobalGroupName: () => "" }))
vi.mock("../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button>{children}</button> }))
vi.mock("../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: () => <input type="number" /> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: () => <select /> }))
vi.mock("../../shared/ui/kit/text-field/TextField", () => ({ TextField: () => <input /> }))
vi.mock("./ChooseEmitter", () => ({ ChooseEmitter: () => <div data-testid="choose-emitter" /> }))
vi.mock("./specific/ChooseStyle", () => ({ ChooseStyle: () => <div data-testid="choose-style" /> }))
vi.mock("./MidiValues", () => ({ MidiValues: () => <div data-testid="midi" /> }))
vi.mock("./RestValues", () => ({ RestValues: () => <div data-testid="rest" /> }))
vi.mock("./specific/VariableInputs", () => ({ VariableInputs: () => <div data-testid="variable-inputs" /> }))

import { CustomInput } from "./CustomInput"

describe("CustomInput", () => {
    afterEach(() => cleanup())

    it("renderiza sin crashear para un input simple", () => {
        const { container } = render(<CustomInput inputId="strval" value={{ value: "" }} actionId="test" />)
        expect(container.querySelector("input")).toBeTruthy()
    })
})
