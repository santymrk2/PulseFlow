// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "./Editor"

vi.mock("../../stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ slide: 0, items: [], type: "show" })
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
vi.mock("../../utils/cloudSync", () => ({ isActiveShowInUseByCloudUser: () => false }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "sl1" }] }))
vi.mock("../../components/edit/scripts/chords", () => ({ getSlideChords: () => [] }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getSlideText: () => "" }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: any) => <span>{id}</span> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: any) => <div>{children}</div> }))
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="island" /> }))
vi.mock("./editors/SlideEditor", () => ({ SlideEditor: () => <div data-testid="slide-editor" /> }))
vi.mock("../show/TextEditor", () => ({ TextEditor: () => <div data-testid="text-editor" /> }))
vi.mock("../../components/main/Splash.svelte", () => ({ default: {} }))
vi.mock("../../components/edit/editors/OverlayEditor.svelte", () => ({ default: {} }))
vi.mock("../../components/edit/editors/TemplateEditor.svelte", () => ({ default: {} }))
vi.mock("../../components/edit/editors/MediaEditor.svelte", () => ({ default: {} }))
vi.mock("./SceneEditor", () => ({ SceneEditor: () => <div /> }))
vi.mock("./EffectEditor", () => ({ EffectEditor: () => <div /> }))
vi.mock("./CameraEditor", () => ({ CameraEditor: () => <div /> }))
vi.mock("./AudioEditor", () => ({ AudioEditor: () => <div /> }))
vi.mock("./ItemAddMenu", () => ({ ItemAddMenu: () => <div /> }))

afterEach(cleanup)

describe("Editor", () => {
    it("renderiza el contenedor principal del editor", () => {
        const { container } = render(<Editor />)
        expect(container.querySelector(".editor")).toBeTruthy()
    })
})
