import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react"
import { get } from "svelte/store"
import type { Item } from "../../../../types/Show"
import { activeEdit, showsCache } from "../../../stores"
import { clone } from "../../../components/helpers/array"
import { getStyles } from "../../../components/helpers/style"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { Icon } from "../../helpers/Icon"
import styles from "./Table.module.css"

export interface TableProps {
    item: Item
    edit?: boolean
    ref?: { showId?: string; id?: string; [key: string]: unknown }
    ratio?: number
    index?: number
}

interface TableCell {
    text: string
    style?: string
}

interface TableRow {
    cells: TableCell[]
}

interface TableData {
    borderColor?: string
    borderWidth?: number
    rows: TableRow[]
}

const DEFAULT_TABLE: TableData = {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    rows: [
        {
            cells: [
                { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" },
                { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" },
                { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" }
            ]
        },
        { cells: [{ text: "" }, { text: "" }, { text: "" }] },
        { cells: [{ text: "" }, { text: "" }, { text: "" }] }
    ]
}

// (F24.18a).
export function Table({ item, edit = false, ref = {}, ratio = 1, index = -1 }: TableProps) {
    const [tableData, setTableData] = useState<TableData>(() => item.table || clone(DEFAULT_TABLE))
    const containerRef = useRef<HTMLDivElement | null>(null)
    const lastRightClicked = useRef<{ row: number | null; col: number | null }>({ row: null, col: null })
    const [isAnyCellFocused, setIsAnyCellFocused] = useState(false)

    // El show puede cambiar de slide mientras el componente sigue montado.
    useEffect(() => {
        setTableData(item.table || clone(DEFAULT_TABLE))
    }, [item.table])

    function updateItem(data: TableData) {
        if (!ref?.showId || get(activeEdit).slide === null) return
        showsCache.update((cache) => {
            const show = cache[ref.showId!]
            if (!show) return cache
            const slide = show.slides[ref.id || ""]
            if (!slide) return cache
            const items = slide.items
            if (index > -1 && items[index]) {
                items[index].table = clone(data)
            }
            return cache
        })
    }

    function commit(next: TableData) {
        setTableData(next)
        updateItem(next)
    }

    function addRow(rowIndex: number) {
        const rows = tableData.rows || []
        const colCount = rows[0]?.cells?.length || 3
        let refRowIdx = rowIndex - 1
        if (refRowIdx < 0 && rows.length > 0) refRowIdx = 0
        const newCells = Array.from({ length: colCount }, (_, colIdx) => {
            const style = (refRowIdx >= 0 && rows[refRowIdx]?.cells?.[colIdx]?.style) || undefined
            return style ? { text: "", style } : { text: "" }
        })
        const next = clone(tableData)
        next.rows.splice(rowIndex, 0, { cells: newCells })
        commit(next)
    }

    function deleteRow(rowIndex: number) {
        if (tableData.rows.length <= 1) return
        const next = clone(tableData)
        next.rows.splice(rowIndex, 1)
        commit(next)
    }

    function addColumn(colIndex: number) {
        const next = clone(tableData)
        next.rows.forEach((row) => {
            let refColIdx = colIndex - 1
            if (refColIdx < 0 && row.cells.length > 0) refColIdx = 0
            const style = (refColIdx >= 0 && row.cells[refColIdx]?.style) || undefined
            row.cells.splice(colIndex, 0, style ? { text: "", style } : { text: "" })
        })
        commit(next)
    }

    function deleteColumn(colIndex: number) {
        if ((tableData.rows[0]?.cells?.length || 0) <= 1) return
        const next = clone(tableData)
        next.rows.forEach((row) => row.cells.splice(colIndex, 1))
        commit(next)
    }

    function handleCellInput(text: string, rIdx: number, cIdx: number) {
        const next = clone(tableData)
        if (!next.rows[rIdx]?.cells[cIdx]) return
        next.rows[rIdx].cells[cIdx].text = text
        commit(next)
    }

    function handleCellKeydown(e: KeyboardEvent<HTMLDivElement>, rIdx: number, cIdx: number) {
        if (e.key !== "Tab") return
        const isLastRow = rIdx === tableData.rows.length - 1
        const isLastCol = cIdx === tableData.rows[rIdx].cells.length - 1
        if (!isLastRow || !isLastCol || e.shiftKey) return

        e.preventDefault()
        addRow(tableData.rows.length)
        // Esperar al próximo macro-task para que la fila nueva esté en el DOM.
        setTimeout(() => {
            const rowsList = containerRef.current?.querySelectorAll("tr")
            const cellEl = rowsList?.[rowsList.length - 1]?.querySelector("[contenteditable]") as HTMLElement | null | undefined
            if (!cellEl) return
            cellEl.focus()
            const selection = window.getSelection()
            const range = document.createRange()
            range.selectNodeContents(cellEl)
            range.collapse(true)
            selection?.removeAllRanges()
            selection?.addRange(range)
        }, 100)
    }

    function handleContextMenu(e: MouseEvent, rIdx: number, cIdx: number) {
        e.preventDefault()
        lastRightClicked.current = { row: rIdx, col: cIdx }
    }

    useEffect(() => {
        const handleDelRow = () => {
            if (lastRightClicked.current.row === null) return
            deleteRow(lastRightClicked.current.row)
            lastRightClicked.current = { row: null, col: null }
        }
        const handleDelCol = () => {
            if (lastRightClicked.current.col === null) return
            deleteColumn(lastRightClicked.current.col)
            lastRightClicked.current = { row: null, col: null }
        }
        window.addEventListener("delete-row", handleDelRow)
        window.addEventListener("delete-col", handleDelCol)
        return () => {
            window.removeEventListener("delete-row", handleDelRow)
            window.removeEventListener("delete-col", handleDelCol)
        }
    }, [tableData])

    function handleFocusOut(e: FocusEvent<HTMLDivElement>) {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setIsAnyCellFocused(false)
    }

    const borderColor = tableData.borderColor || "rgba(255,255,255,0.2)"
    const borderWidth = tableData.borderWidth !== undefined ? tableData.borderWidth : 1
    const alignStyles = getStyles(item.align || "")
    const verticalAlign = alignStyles["align-items"] || "center"
    const textAlign = alignStyles["text-align"] || "center"

    return (
        <div ref={containerRef} className={`${styles.container} ${edit ? styles.editMode : ""}`} style={{ "--ratio-zoom": ratio || 1 } as CSSProperties} onFocus={() => setIsAnyCellFocused(true)} onBlur={handleFocusOut}>
            <table style={{ border: `${borderWidth}px solid ${borderColor}`, borderCollapse: "collapse", width: "100%", height: "100%" }}>
                <tbody>
                    {tableData.rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: `${borderWidth}px solid ${borderColor}` }}>
                            {row.cells.map((cell, cIdx) => (
                                <td key={cIdx} className={edit ? `edit context #edit_box__table_context` : ""} data-row={rIdx} data-col={cIdx} onContextMenu={(e) => handleContextMenu(e, rIdx, cIdx)} style={{ borderRight: `${borderWidth}px solid ${borderColor}`, position: "relative", padding: 0, textAlign, "--vertical-align": verticalAlign, ...(cell.style ? cssTextToStyle(cell.style) : {}) } as CSSProperties}>
                                    {edit ? (
                                        <div
                                            className={`${styles.cellContent} edit`}
                                            contentEditable
                                            suppressContentEditableWarning
                                            ref={(el) => {
                                                if (el && el.textContent !== cell.text && document.activeElement !== el) el.textContent = cell.text
                                            }}
                                            onInput={(e) => handleCellInput(e.currentTarget.textContent || "", rIdx, cIdx)}
                                            onKeyDown={(e) => handleCellKeydown(e, rIdx, cIdx)}
                                            style={{ padding: "8px 12px", width: "100%", height: "100%", outline: "none", boxSizing: "border-box", minHeight: "38px" }}
                                        />
                                    ) : (
                                        <div className={styles.cellContent} style={{ padding: "8px 12px", width: "100%", height: "100%", boxSizing: "border-box", minHeight: "38px" }}>
                                            {cell.text}
                                        </div>
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {edit && isAnyCellFocused ? (
                <>
                    <button
                        tabIndex={-1}
                        className={`${styles.circleAddBtn} ${styles.rightBtn}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            addColumn(tableData.rows[0]?.cells?.length || 0)
                        }}
                        title="Add Column"
                    >
                        <Icon id="add" size={3.2} white />
                    </button>
                    <button
                        tabIndex={-1}
                        className={`${styles.circleAddBtn} ${styles.bottomBtn}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            addRow(tableData.rows.length)
                        }}
                        title="Add Row"
                    >
                        <Icon id="add" size={3.2} white />
                    </button>
                </>
            ) : null}
        </div>
    )
}
