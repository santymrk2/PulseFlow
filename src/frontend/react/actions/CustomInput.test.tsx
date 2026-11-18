// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../IPC/main", () => ({ requestMain: vi.fn(async () => []) }))
vi.mock("../../audio/audioMicrophone", () => ({ AudioMicrophone: { getList: vi.fn(async () => []) } }))
vi.mock("../../audio/routing/audioRoutingManager", () => ({ AudioRoutingManager: { sortChannels: (x: unknown) => x } }))
vi.mock("../../media/cameraManager", () => ({ cameraManager: { getCamerasList: vi.fn(async () => []) } }))
vi.mock("../../utils/obsTalk", () => ({ obsGetScenes: vi.fn(async () => []) }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ keysToID: () => [], sortByName: (a: unknown[]) => a }))
vi.mock("../../components/show/tools/groups", () => ({ getGlobalGroupName: () => "" }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button>{children}</button> }))
vi.mock("../ui/number-field/NumberField", () => ({ NumberField: () => <input type="number" /> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: () => <select /> }))
vi.mock("../ui/text-field/TextField", () => ({ TextField: () => <input /> }))
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
