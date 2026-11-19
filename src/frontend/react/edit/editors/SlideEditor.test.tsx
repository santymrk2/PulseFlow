// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SlideEditor } from "./SlideEditor"

vi.mock("../../../shared/core/stores", () => ({
    activeEdit: {
        subscribe: (r: any) => {
            r({ slide: 0, items: [], showId: "s1" })
            return () => {}
        },
        update: (fn: any) => fn({ slide: 0, items: [] }),
        set: vi.fn()
    },
    activePopup: {
        set: vi.fn(),
        subscribe: (r: any) => {
            r(null)
            return () => {}
        }
    },
    activeShow: {
        subscribe: (r: any) => {
            r({ id: "s1" })
            return () => {}
        }
    },
    alertMessage: {
        set: vi.fn(),
        subscribe: (r: any) => {
            r("")
            return () => {}
        }
    },
    editMode: {
        subscribe: (r: any) => {
            r("default")
            return () => {}
        }
    },
    focusMode: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        }
    },
    media: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    outputs: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    overlays: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    playerVideos: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    resized: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    showsCache: {
        subscribe: (r: any) => {
            r({ s1: { slides: { sl1: { items: [] } }, layouts: {}, settings: { activeLayout: "" }, media: {} } })
            return () => {}
        },
        update: vi.fn()
    },
    slideNotesActive: {
        subscribe: (r: any) => {
            r(false)
            return () => {}
        },
        set: vi.fn()
    },
    special: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    styles: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        }
    },
    previewOutputId: {
        subscribe: (r: any) => {
            r("")
            return () => {}
        }
    }
}))
vi.mock("../../../shared/utils/chordTranspose", () => ({ transposeText: (t: string) => t }))
vi.mock("../../../shared/utils/common", () => ({ DEFAULT_WIDTH: 300 }))
vi.mock("../../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../shared/utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../../components/actions/actions", () => ({ slideHasAction: () => false }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: ({ id }: any) => <span>{id}</span> }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/media", () => ({ getExtension: () => "", getMedia: vi.fn(async () => null), getMediaFileFromClipboard: vi.fn(async () => null), getMediaStyle: () => ({}), getMediaType: () => "image", getThumbnailPath: () => "", mediaSize: { slideSize: "s" } }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getFirstActiveOutput: () => ({}), getResolution: () => ({ width: 1920, height: 1080 }), getSlideFilter: () => "" }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "sl1", data: {} }], isSlideLocked: () => false }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [{ id: "sl1", items: [] }], set: vi.fn() }) }) }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../features/slide/logic/getStyleResolution", () => ({ getStyleResolution: () => "" }))
vi.mock("../../../features/show/logic/formatTextEditor", () => ({ formatText: vi.fn() }))
vi.mock("../../../features/show/logic/getTextEditor", () => ({ getPlainEditorText: () => "" }))
vi.mock("../../../components/edit/scripts/chords", () => ({ getShowChords: () => [], getUsedChords: () => [] }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ addItem: vi.fn() }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ setCaretAtEnd: vi.fn() }))
vi.mock("../../../components/edit/scripts/zoom", () => ({ centerZoom: vi.fn() }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../../shared/ui/kit/zoom-control/ZoomControl", () => ({ ZoomControl: () => <div /> }))
vi.mock("../../../shared/ui/system/Center", () => ({ Center: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../../shared/ui/system/DropArea", () => ({ DropArea: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../../shared/ui/system/Resizeable", () => ({ Resizeable: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../../shared/ui/system/Snaplines", () => ({ Snaplines: () => <div /> }))
vi.mock("../../../features/slide/Zoomed", () => ({ Zoomed: ({ children }: any) => <div>{children}</div> }))
vi.mock("../../../features/slide/Textbox", () => ({ Textbox: () => <div /> }))
vi.mock("../../../features/drawer/media/MediaLoader", () => ({ MediaLoader: () => <div /> }))
vi.mock("../../../features/show/tools/Notes", () => ({ Notes: () => <div /> }))
vi.mock("../../../features/timeline/Timeline", () => ({ Timeline: () => <div /> }))
vi.mock("../editbox/Editbox", () => ({ Editbox: () => <div data-testid="editbox" /> }))
vi.mock("../EditHeader", () => ({ EditHeader: () => <div /> }))

afterEach(cleanup)

describe("SlideEditor", () => {
    it("renderiza el área de edición de slide", () => {
        const { container } = render(<SlideEditor />)
        expect(container.querySelector(".editArea")).toBeTruthy()
    })
})
