// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actions, activeActionTagFilter, activeDrawerTab, activePlaylist, activeTimerTagFilter, activeVariableTagFilter, audioPlaylists, dictionary, drawerTabsData, outputs, templates } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { DrawerTab, type DrawerTabCategory } from "./DrawerTab"
import styles from "./DrawerTab.module.css"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

interface ClickDetail {
    ctrl: boolean
    shift: boolean
    alt: boolean
    doubleClick: boolean
    target: EventTarget
}

vi.mock("../system/SelectElem", () => ({
    SelectElem: ({ children, className, style, draggable, selectable }: { children?: ReactNode; className?: string; style?: CSSProperties; draggable?: boolean; selectable?: boolean }) => (
        <div data-testid="select-elem" data-draggable={draggable} data-selectable={selectable} className={className} style={style}>
            {children}
        </div>
    )
}))

vi.mock("../ui/button/Button", () => ({
    Button: ({ children, className, style, tab, isActive, onClick, onDblClick }: { children?: ReactNode; className?: string; style?: CSSProperties; tab?: boolean; isActive?: boolean; onClick?: (detail: ClickDetail, event: ReactMouseEvent<HTMLElement>) => void; onDblClick?: (detail: ClickDetail, event: ReactMouseEvent<HTMLElement>) => void }) => {
        const detail = (event: ReactMouseEvent<HTMLElement>): ClickDetail => ({ ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, doubleClick: false, target: event.target })
        return (
            <div role="button" data-testid={tab ? "tab-button" : "submenu-button"} className={`${className ?? ""}${isActive ? " isActive" : ""}`} style={style} onClick={(event) => onClick?.(detail(event), event)} onDoubleClick={(event) => onDblClick?.(detail(event), event)}>
                {children}
            </div>
        )
    }
}))

vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))

vi.mock("../ui/hidden-input/HiddenInput", () => ({
    HiddenInput: ({ value, id, onEdit }: { value?: string; id: string; onEdit?: (detail: { value: string; id: string }) => void }) => (
        <span role="button" data-testid="rename-input" onClick={() => onEdit?.({ value: "Nuevo", id })}>
            {value}
        </span>
    )
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let restaurar: () => void = () => {}

function categoria(overrides: Partial<DrawerTabCategory> = {}): DrawerTabCategory {
    return { id: "cat-1", label: "media.cat", icon: "folder", ...overrides }
}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([
        looseEntry(dictionary, { media: { cat: "Categoría" }, main: { unnamed: "Sin nombre" } }),
        looseEntry(activeDrawerTab, "media"),
        looseEntry(activeActionTagFilter, ["cat-1"]),
        looseEntry(activeVariableTagFilter, []),
        looseEntry(activeTimerTagFilter, []),
        looseEntry(activePlaylist, null),
        looseEntry(audioPlaylists, {}),
        looseEntry(drawerTabsData, { media: { activeSubTab: "", enabled: true, openedSubmenus: [] } }),
        looseEntry(outputs, {}),
        looseEntry(templates, {}),
        looseEntry(actions, {})
    ])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("DrawerTab", () => {
    it("renderiza_el_label_traducido_y_el_count", () => {
        const { container } = render(<DrawerTab category={categoria({ count: 5 })} active="cat-1" />)
        expect(screen.getByText("Categoría")).toBeTruthy()
        expect(screen.getByText("5")).toBeTruthy()
        expect(container.querySelector("[data-title='Categoría']")).not.toBeNull()
    })

    it("click_normal_actualiza_activeSubTab_y_llama_openTrigger", () => {
        const openTrigger = vi.fn()
        render(<DrawerTab category={categoria({ openTrigger })} active="otro" />)
        fireEvent.click(screen.getByTestId("tab-button"))
        expect(openTrigger).toHaveBeenCalledWith("cat-1", false)
        expect(get(drawerTabsData).media.activeSubTab).toBe("cat-1")
    })

    it("click_con_ctrl_no_hace_nada", () => {
        const openTrigger = vi.fn()
        render(<DrawerTab category={categoria({ openTrigger })} active="otro" />)
        fireEvent.click(screen.getByTestId("tab-button"), { ctrlKey: true })
        expect(openTrigger).not.toHaveBeenCalled()
        expect(get(drawerTabsData).media.activeSubTab).toBe("")
    })

    it("click_con_shift_solo_llama_openTrigger_y_no_cambia_activeSubTab", () => {
        const openTrigger = vi.fn()
        render(<DrawerTab category={categoria({ openTrigger })} active="otro" />)
        fireEvent.click(screen.getByTestId("tab-button"), { shiftKey: true })
        expect(openTrigger).toHaveBeenCalledWith("cat-1", true)
        expect(get(drawerTabsData).media.activeSubTab).toBe("")
    })

    it("doble_click_llama_onDoubleClick", () => {
        const onDoubleClick = vi.fn()
        render(<DrawerTab category={categoria({ onDoubleClick })} active="cat-1" />)
        fireEvent.doubleClick(screen.getByTestId("tab-button"))
        expect(onDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("rename_reenvia_el_detalle_con_id_y_valor", () => {
        const onRename = vi.fn()
        render(<DrawerTab category={categoria()} active="cat-1" onRename={onRename} />)
        fireEvent.click(screen.getByTestId("rename-input"))
        expect(onRename).toHaveBeenCalledWith({ id: "cat-1", value: "Nuevo" })
    })

    it("abre_y_cierra_el_submenu_y_renderiza_las_opciones", () => {
        const subOpcion = categoria({ id: "sub-1", label: "media.sub" })
        const { container } = render(<DrawerTab category={categoria({ submenu: { options: [subOpcion] } })} active="cat-1" />)
        expect(container.querySelector(`.${styles.submenus}`)).toBeNull()

        fireEvent.click(screen.getByTestId("submenu-button"))
        expect(get(drawerTabsData).media.openedSubmenus).toEqual(["cat-1"])
        expect(container.querySelectorAll(`.${styles.submenus}`)).toHaveLength(1)

        fireEvent.click(screen.getByTestId("submenu-button"))
        expect(get(drawerTabsData).media.openedSubmenus).toEqual([])
        expect(container.querySelector(`.${styles.submenus}`)).toBeNull()
    })

    it("submenu_activo_por_filtro_de_tags", () => {
        render(<DrawerTab category={categoria()} active="actions" isSubmenu />)
        expect(screen.getByTestId("tab-button").className).toContain("isActive")
    })
})
