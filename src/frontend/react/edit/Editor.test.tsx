// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "./Editor"

const editState = vi.hoisted(() => ({ value: { slide: 0 as number | null | undefined, items: [] as number[], type: "show" as string, id: "" } }))

vi.mock("../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r(editState.value)
            return () => {}
        },
        set: vi.fn()
    },
    activePage: {
        subscribe: (r: any) => {
            r("edit")
            return () => {}
        }
    },
    activePopup: { set: vi.fn() },
    activeShow: {
        subscribe: (r: any) => {
            r({ id: "s1" })
            return () => {}
        }
    },
    cloudUsers: {
        subscribe: (r: any) => {
            r([])
            return () => {}
        }
    },
    dictionary: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    drawer: {
        subscribe: (r: any) => {
            r({ height: 200 })
            return () => {}
        },
        set: vi.fn()
    },
    drawerOpenedInEdit: {
        subscribe: (r: any) => {
            r(true)
            return () => {}
        }
    },
    editMode: {
        subscribe: (r: any) => {
            r("default")
            return () => {}
        },
        set: vi.fn()
    },
    focusMode: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        }
    },
    labelsDisabled: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        }
    },
    openToolsTab: {
        subscribe: (r: any) => {
            r("")
            return () => {}
        },
        set: vi.fn()
    },
    refreshEditSlide: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        },
        set: vi.fn()
    },
    showsCache: {
        subscribe: (r: any) => {
            r({ s1: { slides: { sl1: { items: [] } }, layouts: {}, settings: { activeLayout: "" } } })
            return () => {}
        }
    },
    slideNotesActive: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        }
    },
    special: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    }
}))
vi.mock("../../app/wiring/cloudSync", () => ({ isActiveShowInUseByCloudUser: () => false }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "sl1" }] }))
vi.mock("../../components/edit/scripts/chords", () => ({ getSlideChords: () => [] }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getSlideText: () => "" }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../shared/ui/helpers/T", () => ({ T: ({ id }: any) => <span>{id}</span> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: any) => <div>{children}</div> }))
vi.mock("./editors/SlideEditor", () => ({ SlideEditor: () => <div data-testid="slide-editor" /> }))
vi.mock("../show/TextEditor", () => ({ TextEditor: () => <div data-testid="text-editor" /> }))
vi.mock("../main/Splash", () => ({ Splash: () => <div /> }))
vi.mock("./OverlayEditor", () => ({ OverlayEditor: () => <div data-testid="overlay-editor" /> }))
vi.mock("./TemplateEditor", () => ({ TemplateEditor: () => <div data-testid="template-editor" /> }))
vi.mock("./MediaEditor", () => ({ MediaEditor: () => <div data-testid="media-editor" /> }))
vi.mock("./SceneEditor", () => ({ SceneEditor: () => <div /> }))
vi.mock("./EffectEditor", () => ({ EffectEditor: () => <div /> }))
vi.mock("./CameraEditor", () => ({ CameraEditor: () => <div /> }))
vi.mock("./AudioEditor", () => ({ AudioEditor: () => <div /> }))
vi.mock("./ItemAddMenu", () => ({ ItemAddMenu: () => <div /> }))

afterEach(() => {
    cleanup()
    editState.value = { slide: 0, items: [], type: "show", id: "" }
})

describe("Editor", () => {
    it("renderiza el contenedor principal del editor", () => {
        const { container } = render(<Editor />)
        expect(container.querySelector(".editor")).toBeTruthy()
    })

    it.each([
        ["overlay", "overlay-editor"],
        ["template", "template-editor"],
        ["media", "media-editor"]
    ])("usa el port React de %s sin islas Svelte", (type, testId) => {
        editState.value = { slide: 0, items: [], type, id: "x" }
        const { getByTestId, queryByTestId } = render(<Editor />)
        expect(getByTestId(testId)).toBeTruthy()
        expect(queryByTestId("island")).toBeNull()
    })
})
