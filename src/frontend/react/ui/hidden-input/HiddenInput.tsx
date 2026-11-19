import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { get } from "../../../shared/core/lib/store"
import type { ActiveEdit } from "../../../../types/Main"
import { cn } from "../../../shared/core/lib/utils"
import { activeEdit, activePage, activeProject, activeRename, dictionary, projectView } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { useDerivedState } from "../../hooks/useDerivedState"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import styles from "./HiddenInput.module.css"

// Port de ui/hidden-input/hidden-input.svelte: texto que se vuelve input al mantener el click o con `activeRename`.
// dispatch("edit", { value, id }) → onEdit; `bind:edit` → edit inicial + onEditChange. `value` es de una vía (se normaliza adentro).
export interface HiddenInputEdit {
    value: string
    id: string
}

export interface HiddenInputProps {
    value?: string
    style?: CSSProperties
    id: string
    allowEmpty?: boolean
    allowEdit?: boolean
    edit?: boolean | string
    onEdit?: (detail: HiddenInputEdit) => void
    onEditChange?: (edit: boolean | string) => void
}

const HOLD_TIME = 700

export function HiddenInput({ value: valueProp = "", style, id, allowEmpty = true, allowEdit = true, edit: editProp = false, onEdit, onEditChange }: HiddenInputProps) {
    const dict = useStore(dictionary)
    const rename = useStore(activeRename)
    const [edit, setEditState] = usePropState(editProp)
    const [prevVal, setPrevVal] = useState("")

    // `$: value = edit ? value.replaceAll("  ", " ") : value.trim()` y `$: if (!edit && !value.length && prevVal.length) value = prevVal`
    const normalized = edit ? valueProp.replaceAll("  ", " ") : valueProp.trim()
    const value = !edit && !normalized.length && prevVal.length ? prevVal : normalized

    const nameElem = useRef<HTMLParagraphElement>(null)
    const inputElem = useRef<HTMLInputElement>(null)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    // `$: if (id) updateState()`: se recalcula sólo cuando cambia `id`
    const [initiallyEmpty] = useDerivedState(id, () => !value)

    const editingActive = edit === id && allowEdit

    function setEdit(next: boolean | string) {
        setEditState(next)
        onEditChange?.(next)
    }

    function focusInput() {
        setTimeout(() => inputElem.current?.focus(), 10)
    }

    function click(target: EventTarget | null) {
        if (target === nameElem.current) {
            activeRename.set(id)
            setPrevVal(value)
            focusInput()
        } else if (target !== inputElem.current) {
            cancelEdit()
        }
    }

    // Layout y no efecto: en Svelte el input ya está en el primer render, sin un cuadro con el texto.
    useLayoutEffect(() => {
        if (rename === id) {
            setEdit(id)
            focusInput()
        } else if (rename === null) setEdit(false)
    }, [rename, id])

    function mousedown(e: MouseEvent) {
        const target = e.target
        if (target === nameElem.current && allowEdit) {
            timeout.current = setTimeout(() => handlers.current.click(target), HOLD_TIME)
            return
        }

        if (target instanceof Element && (target.closest("input") || target.closest(".edit") || target.closest(".contextMenu"))) return

        cancelEdit()
    }

    function stopTimeout() {
        if (timeout.current) clearTimeout(timeout.current)
    }

    function keydown(e: globalThis.KeyboardEvent) {
        if (e.key === "Enter" || e.key === "Tab") {
            const renaming: string | null = get(activeRename)
            if (renaming?.includes("project_") && get(activeProject) === renaming.slice(renaming.indexOf("_") + 1)) {
                setTimeout(() => projectView.set(false), 20)
            }

            cancelEdit()
        }
    }

    // <svelte:window on:mousedown on:mouseup on:dragstart on:keydown>: los handlers cambian en cada render, el listener no
    const handlers = useRef({ mousedown, keydown, click })
    useEffect(() => {
        handlers.current = { mousedown, keydown, click }
    })
    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => handlers.current.mousedown(e)
        const onKeyDown = (e: globalThis.KeyboardEvent) => handlers.current.keydown(e)
        window.addEventListener("mousedown", onMouseDown)
        window.addEventListener("mouseup", stopTimeout)
        window.addEventListener("dragstart", stopTimeout)
        window.addEventListener("keydown", onKeyDown)
        return () => {
            window.removeEventListener("mousedown", onMouseDown)
            window.removeEventListener("mouseup", stopTimeout)
            window.removeEventListener("dragstart", stopTimeout)
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [])

    function change(e: Event) {
        const typed = ((e.target as HTMLInputElement | null)?.value || "").trim()
        if (allowEmpty || typed.length) onEdit?.({ value: typed, id })

        if (!initiallyEmpty || id.includes("category")) return

        const objectId = id.slice(id.indexOf("_") + 1)
        // open editor if no name (probably just created)
        if (id.includes("template") || id.includes("overlay") || id.includes("effect") || id.startsWith("scene")) {
            const type = id.slice(0, id.indexOf("_")) as NonNullable<ActiveEdit["type"]>
            activeEdit.set({ type, id: objectId, items: [] })
            activePage.set("edit")
        }
    }

    function cancelEdit() {
        if (!edit && get(activeRename) === null) return

        // check if active rename actually exists anywhere
        const renameIsActive = !!document.querySelector(".edit.nocontext._rename.name")
        // can only be canceled by itself or any rename elem if it's not actually active
        if (renameIsActive && !editingActive) return

        setEdit(false)
        activeRename.set(null)
    }

    useEffect(() => {
        if (editingActive) setTimeout(() => inputElem.current?.select(), 10)
    }, [editingActive])

    // `change` nativo (Enter o blur), como on:change de Svelte
    useEffect(() => {
        const el = inputElem.current
        if (!el) return
        el.addEventListener("change", change)
        return () => el.removeEventListener("change", change)
    })

    // `{value}` de Svelte es de una vía: el DOM conserva lo escrito mientras `value` no cambie
    useEffect(() => {
        if (inputElem.current && inputElem.current.value !== value) inputElem.current.value = value
    }, [value])

    return editingActive ? (
        <input
            ref={inputElem}
            defaultValue={value}
            // stop space from triggering other keydown events
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === " " && e.stopPropagation()}
            className={cn("edit nocontext _rename name", styles.field)}
        />
    ) : (
        <p id={id} style={style} ref={nameElem} className={cn("_rename", styles.name)}>
            {value.length ? value : <span style={{ opacity: 0.5, fontStyle: "italic", pointerEvents: "none" }}>{translateText("main.unnamed", dict)}</span>}
        </p>
    )
}
