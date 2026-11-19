// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/search", () => ({ formatSearch: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v || {})) }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: () => ({}) }))
vi.mock("../../features/show/logic/tools/groups", () => ({ getGlobalGroupName: () => "" }))
vi.mock("../../components/actions/actionData", () => ({ actionData: {} }))
vi.mock("../../components/actions/actions", () => ({ getActionName: () => "", getActionTriggerId: (id: string) => id }))
vi.mock("../../components/actions/api", () => ({ API_ACTIONS: {} }))
vi.mock("../../features/output/logic/preview/SpotifyManager", () => ({ spotifyState: {} }))
vi.mock("../../shared/ui/kit/h-rule/HRule", () => ({ HRule: () => <hr /> }))
vi.mock("../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button>{children}</button> }))
vi.mock("../../shared/ui/kit/combined-input/CombinedInput", () => ({ CombinedInput: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../shared/ui/kit/dropdown/Dropdown", () => ({ Dropdown: () => <select /> }))
vi.mock("../../shared/ui/kit/text-field/TextField", () => ({ TextField: () => <input /> }))
vi.mock("../../shared/ui/kit/toggle-field/ToggleField", () => ({ ToggleField: () => <input type="checkbox" /> }))
vi.mock("../../shared/ui/system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("./CustomInput", () => ({ CustomInput: () => <div data-testid="custom-input" /> }))

import { CreateAction } from "./CreateAction"

describe("CreateAction", () => {
    afterEach(() => cleanup())

    it("renderiza sin crashear", () => {
        const { container } = render(<CreateAction actionId="" existingActions={[]} />)
        expect(container).toBeTruthy()
    })
})
