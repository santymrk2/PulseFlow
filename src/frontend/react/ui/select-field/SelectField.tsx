import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import type { DropdownOptions } from "../../../../types/Input"
import { cn } from "../../../shared/core/lib/utils"
import { newDropdown } from "../../../components/edit/scripts/edit"
import { dictionary } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { formatSearch } from "../../../shared/utils/search"
import { VirtualList } from "../../drawer/VirtualList"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { Icon } from "../../helpers/Icon"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import { InputRow } from "../input-row/InputRow"
import { TextField } from "../text-field/TextField"
import styles from "./SelectField.module.css"

// Port de ui/select-field/select-field.svelte. dispatch("change", string | null) → onChange(string | null) (reset despacha defaultValue, que puede ser null);
// dispatch("new", string) → onNew(string); dispatch("delete", string) → onDelete(string). `use:portal` → createPortal al <body>.
// La lista virtual (más de 100 opciones) usa react/drawer/VirtualList.
export interface SelectFieldProps {
    label: string
    value: string
    defaultValue?: string | null
    options: DropdownOptions
    id?: string
    disabled?: boolean
    allowEmpty?: boolean
    flags?: boolean
    onlyArrow?: boolean
    addNew?: string | null
    allowDeleting?: boolean
    style?: CSSProperties
    onChange?: (value: string | null) => void
    onNew?: (value: string) => void
    onDelete?: (value: string) => void
}

type Option = DropdownOptions[number]

export function SelectField({ label, value: valueProp, defaultValue = null, options, id = "", disabled = false, allowEmpty = false, flags = false, onlyArrow = false, addNew = null, allowDeleting = false, style, onChange, onNew, onDelete }: SelectFieldProps) {
    const dict = useStore(dictionary)
    const [value, setValue] = usePropState(valueProp)
    const [open, setOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [maxHeight, setMaxHeight] = useState(320)
    const [menuPos, setMenuPos] = useState<CSSProperties>({})
    const [searchValue, setSearchValue] = useState("")
    const [resetFromValue, setResetFromValue] = useState("")
    const [addNewTextbox, setAddNewTextbox] = useState(false)
    const [newValue, setNewValue] = useState("")
    const dropdownEl = useRef<HTMLDivElement>(null)
    const scrollElem = useRef<HTMLUListElement>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const selected = options.find((o) => o.value === value)
    const useVirtualList = options.length > 100
    const hasValue = !!value || (value === "" && options[0]?.value === "")
    // el botón de borrar/restablecer va sobre el campo: se reserva su ancho para que no pise el texto
    const hasRemove = (allowEmpty && hasValue) || (defaultValue !== null && (value !== defaultValue || !!resetFromValue))

    function toggleDropdown(force?: boolean) {
        if (disabled) return
        setAddNewTextbox(false)

        const next = typeof force === "boolean" && value ? force : !open
        setOpen(next)
        if (next) positionMenu()

        setHighlightedIndex(next && value ? options.findIndex((o) => o.value === value) : -1)
    }

    // POSICIÓN: el menú va en el <body> con posición fija (no lo recorta ningún panel) y se abre hacia arriba si abajo no entra
    function positionMenu() {
        if (!dropdownEl.current) return
        const rect = dropdownEl.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom - 12
        const spaceAbove = rect.top - 12
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
        const height = Math.max(120, Math.min(320, openUp ? spaceAbove : spaceBelow))
        const width = onlyArrow ? 220 : rect.width
        const left = onlyArrow ? Math.max(8, rect.right - width) : rect.left
        setMaxHeight(height)
        setMenuPos({ left: `${left}px`, minWidth: `${width}px`, maxHeight: `${height}px`, ...(openUp ? { bottom: `${window.innerHeight - rect.top + 4}px` } : { top: `${rect.bottom + 4}px` }) })
    }

    // SELECT

    function selectOption(e: MouseEvent | null, optionValue: string) {
        if (e?.target instanceof Element && e.target.closest(".delete-button")) return

        setValue(optionValue)
        setOpen(false)
        onChange?.(optionValue)
    }

    function handleKeydown(event: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (searchValue && event.key === " ") return

            if (open && highlightedIndex >= 0) {
                selectOption(null, options[highlightedIndex].value)
            } else {
                toggleDropdown(true)
            }
            return
        } else if (event.key === "ArrowDown") {
            event.preventDefault()
            if (!open) toggleDropdown(true)
            else {
                // loops back around when reached end
                const index = (highlightedIndex + 1) % options.length
                setHighlightedIndex(index)
                scrollToHighlighted(index)
            }
            return
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            if (!open) toggleDropdown(true)
            else {
                // loops back around when reached end
                const index = (highlightedIndex - 1 + options.length) % options.length
                setHighlightedIndex(index)
                scrollToHighlighted(index)
            }
            return
        } else if (event.key === "Escape") {
            setOpen(false)
            return
        }

        if (!open) return

        event.preventDefault()
        if (event.key === "Backspace") {
            setSearchValue("")
            const index = options.findIndex((o) => o.value === value)
            setHighlightedIndex(index)
            scrollToHighlighted(index)
        } else if (event.key.length === 1) {
            const search = formatSearch(searchValue + event.key, true)
            setSearchValue(search)

            let activeIndex = options.findIndex((a) => formatSearch(a.label, true).startsWith(search))
            if (activeIndex < 0) activeIndex = options.findIndex((a) => formatSearch(a.label, true).includes(search))
            if (activeIndex < 0) return

            // enter to select
            setHighlightedIndex(activeIndex)

            scrollToHighlighted(activeIndex)
        }
    }

    function handleScrolling(e: WheelEvent) {
        const ctrl = e.ctrlKey || e.metaKey
        if (disabled || nextScrollTimeout.current || !ctrl) return
        e.preventDefault()

        let index = options.findIndex((a) => a.value === value)
        if (e.deltaY > 0) {
            // scroll down
            index = Math.min(options.length - 1, index + 1)
        } else {
            // scroll up
            if (index === 0 && allowEmpty && value) {
                onChange?.("")
                return
            }
            if (index < 1) return

            index = index - 1
        }

        const newValue = options[index].value
        if (value === newValue) return

        onChange?.(newValue)

        // slow down trackpad scrolling
        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout.current = setTimeout(() => {
            nextScrollTimeout.current = null
        }, 500)
    }

    // scroll

    function scrollToHighlighted(index: number) {
        const list = scrollElem.current
        if (index < 0 && allowEmpty) return list?.scrollTo(0, 0)

        if (!list || index < 0) return
        if (list.offsetHeight >= list.scrollHeight) return

        const activeElem = list.querySelectorAll("li")[index === 0 ? 0 : index - 1]
        if (!activeElem) return

        list.scrollTo(0, activeElem.offsetTop)
    }

    // Los listeners nativos (click afuera, wheel no-pasivo, resize/scroll) y el timeout viven fuera del render: leen siempre lo último
    const latest = useRef({ handleScrolling, positionMenu, scrollToHighlighted, open, highlightedIndex })
    useEffect(() => {
        latest.current = { handleScrolling, positionMenu, scrollToHighlighted, open, highlightedIndex }
    })

    useEffect(() => {
        function handleClickOutside(event: Event) {
            const target = event.target instanceof Element ? event.target : null
            if (target?.closest(".select-menu")) return
            const el = dropdownEl.current
            if (el && !el.contains(event.target as Node) && !event.composedPath().includes(el)) {
                setOpen(false)
                setAddNewTextbox(false)
            }
        }

        function reposition(e?: Event) {
            if (!latest.current.open) return
            // el scroll de la propia lista no mueve el menú
            if (e?.target instanceof Element && e.target.closest(".select-menu")) return
            latest.current.positionMenu()
        }

        document.addEventListener("click", handleClickOutside)
        window.addEventListener("resize", reposition)
        window.addEventListener("scroll", reposition, true)
        return () => {
            document.removeEventListener("click", handleClickOutside)
            window.removeEventListener("resize", reposition)
            window.removeEventListener("scroll", reposition, true)
        }
    }, [])

    const trigger = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = trigger.current
        if (!el) return
        const wheel = (e: WheelEvent) => latest.current.handleScrolling(e)
        el.addEventListener("wheel", wheel, { passive: false })
        return () => el.removeEventListener("wheel", wheel)
    }, [])

    // `$: if (open) searchValue = ""`
    useEffect(() => {
        if (open) setSearchValue("")
    }, [open])

    // `$: if (open && !useVirtualList) setTimeout(scrollToHighlighted)`
    useEffect(() => {
        if (!open || useVirtualList) return
        const timeout = setTimeout(() => latest.current.scrollToHighlighted(latest.current.highlightedIndex))
        return () => clearTimeout(timeout)
    }, [open, useVirtualList])

    // RESET

    function reset() {
        setResetFromValue(value)
        onChange?.(defaultValue)
        setTimeout(() => setResetFromValue(""), 3000)
    }

    function undoReset() {
        onChange?.(resetFromValue)
        setResetFromValue("")
    }

    // CREATE NEW

    function createNew() {
        const action = newDropdown[addNew as keyof typeof newDropdown]
        if (action) return action()

        setOpen(false)
        setAddNewTextbox(true)
    }

    function createNewEvent(created: string) {
        onNew?.(created)
        setAddNewTextbox(false)
        setNewValue("")
    }

    function newKeydown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault()
            createNewEvent(e.currentTarget.value || "")
        }
    }

    function renderOption(option: Option, i: number) {
        const liStyle: CSSProperties = { ...(option.data ? { justifyContent: "space-between" } : {}), ...(option.style ? cssTextToStyle(option.style) : {}) }
        return (
            <li key={i} style={liStyle} role="option" aria-selected={option.value === value} className={cn(option.value === value && styles.selected, i === highlightedIndex && styles.highlighted)} onClick={(e) => selectOption(e, option.value)}>
                {option.icon ? <Icon id={option.icon} style={{ marginRight: "5px" }} color={option.iconColor} boxed={!!option.iconColor} white /> : null}

                {option.prefix ? <span className={styles.prefix}>{option.prefix}</span> : null}
                {option.label || "—"}

                {option.data ? (
                    <div className={styles.data} data-title={option.data}>
                        {option.data}
                    </div>
                ) : null}

                {allowDeleting && option.value !== value ? <Button title="actions.delete" className="delete-button" style={{ position: "absolute", right: "2px", width: "40px" }} icon="delete" onClick={() => onDelete?.(option.value)} red /> : null}
            </li>
        )
    }

    const addNewItem = addNew ? (
        <li style={{ fontStyle: "italic", opacity: 0.9 }} role="option" onClick={createNew}>
            <Icon id="add" />
            {translateText(addNew)}
        </li>
    ) : null

    return (
        <div ref={dropdownEl} className={cn("textfield", styles.textfield, disabled && "disabled", disabled && styles.disabled, flags && styles.flags, onlyArrow && styles.onlyArrow, hasRemove && styles.hasRemove)} style={style}>
            <div className={styles.background} />

            <div ref={trigger} className={cn("input", "edit", "dropdown-trigger", styles.dropdownTrigger)} data-title={`${translateText(label)}${selected ? `: <b>${selected.label || "—"}</b>` : ""}`} role="button" tabIndex={disabled ? undefined : 0} onClick={() => toggleDropdown()} onKeyDown={handleKeydown} aria-haspopup="listbox" aria-expanded={open}>
                {!onlyArrow ? (
                    <span className={styles.selectedText} style={selected?.style ? cssTextToStyle(selected.style) : undefined}>
                        {selected?.icon ? <Icon id={selected.icon} style={{ marginRight: "5px" }} color={selected?.iconColor} boxed={!!selected?.iconColor} white /> : null}
                        {selected?.prefix ? <span className={styles.prefix}>{selected.prefix}</span> : null}
                        {/* show value if options list has not loaded yet (e.g. fonts) */}
                        {selected?.value !== undefined ? selected?.label || "—" : value ? value : null}
                    </span>
                ) : null}
                <svg className={cn(styles.arrow, open && styles.open)} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" />
                </svg>
            </div>

            {!onlyArrow ? <label htmlFor={id} className={cn(styles.label, hasValue && styles.selected)} dangerouslySetInnerHTML={{ __html: translateText(label, dict) }} /> : null}
            <span className={styles.underline} />

            {allowEmpty && hasValue ? (
                <div className={cn("remove", styles.remove)}>
                    <Button onClick={() => selectOption(null, "")} title="clear.general" white>
                        <Icon id="close" white />
                    </Button>
                </div>
            ) : null}
            {defaultValue !== null ? (
                <div className={cn("remove", styles.remove)}>
                    {value !== defaultValue ? (
                        <Button onClick={reset} title="actions.reset" white>
                            <Icon id="reset" white />
                        </Button>
                    ) : resetFromValue ? (
                        <Button onClick={undoReset} title="actions.undo" white>
                            <Icon id="undo" white />
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {open ? (
                <>
                    {useVirtualList
                        ? createPortal(
                              <div className={cn(styles.dropdown, "select-menu", styles.virtual)} style={menuPos}>
                                  <VirtualList items={options} height={`${maxHeight}px`} activeIndex={highlightedIndex} className={styles.viewport} render={renderOption} />

                                  {addNewItem ? <div className={styles.addNewButton}>{addNewItem}</div> : null}
                              </div>,
                              document.body
                          )
                        : createPortal(
                              <ul style={menuPos} className={cn(styles.dropdown, "select-menu")} role="listbox" tabIndex={-1} ref={scrollElem}>
                                  {allowEmpty ? (
                                      <li style={{ opacity: 0.5, fontStyle: "italic" }} role="option" aria-selected={!value} className={cn(!value && styles.selected, highlightedIndex < 0 && styles.highlighted)} onClick={() => selectOption(null, "")}>
                                          {translateText("main.none")}
                                      </li>
                                  ) : null}

                                  {options.map((option, i) => renderOption(option, i))}

                                  {addNewItem}
                              </ul>,
                              document.body
                          )}

                    {searchValue ? <div className={styles.search}>{searchValue}</div> : null}
                </>
            ) : null}

            {addNew && addNewTextbox ? (
                <div className={cn(styles.dropdown, styles.inline)}>
                    <InputRow>
                        <TextField label="inputs.name" value={newValue} autofocus onInput={(v) => setNewValue(v ?? "")} onKeyDown={newKeydown} />
                        <Button disabled={!newValue.length} title={addNew} onClick={() => createNewEvent(newValue)}>
                            <Icon id="check" size={1.2} white />
                        </Button>
                    </InputRow>
                </div>
            ) : null}
        </div>
    )
}
