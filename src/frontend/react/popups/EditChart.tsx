import { useEffect, useState } from "react"
import { get } from "../../lib/store"
import { popupData } from "../../stores"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { TextField } from "../ui/text-field/TextField"

// Port de components/main/popups/EditChart.svelte. Lee (al montar): popupData.active (JSON de filas [nombre, valor, color] o líneas "nombre: valor") y
// llama a popupData.trigger(JSON.stringify(grid)) al montar y en cada cambio de la grilla. No escribe ningún store.
// Los TextField no pueden despachar null aquí (sin defaultValue no hay botón de reset): `?? ""` es sólo para el tipo.
const defaultColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e", "#06b6d4", "#14b8a6"]

function getDefaultColor(rowIdx: number, currentGrid: string[][]) {
    if (rowIdx === 0) return defaultColors[0]
    const hasHeader = currentGrid[0] && currentGrid[0][0] === "Label" && isNaN(parseFloat(currentGrid[0][1]))
    const dataIdx = hasHeader ? rowIdx - 1 : rowIdx
    return defaultColors[dataIdx % defaultColors.length]
}

function readGrid(active: unknown): string[][] {
    let grid: string[][] = [["", "0", defaultColors[0]]]
    try {
        if (active) {
            const parsed = JSON.parse(active as string)
            if (Array.isArray(parsed) && parsed.every((row) => Array.isArray(row))) {
                const temp: string[][] = parsed.map((row) => [row[0] || "", row[1] || "0", row[2] || ""])
                grid = temp.map((row, rowIdx) => {
                    if (!row[2]) row[2] = getDefaultColor(rowIdx, temp)
                    return row
                })
            }
        }
    } catch {
        if (active && typeof active === "string") {
            const lines = active.split("\n").filter((l) => l.trim())
            const temp = lines.map((line) => {
                const parts = line.split(":")
                return [parts[0].trim(), parts[1] ? parts[1].trim() : "0", ""]
            })
            grid = temp.map((row, rowIdx) => {
                row[2] = getDefaultColor(rowIdx, temp)
                return row
            })
        }
    }

    if (grid.length === 0) grid = [["", "0", defaultColors[0]]]
    return grid
}

export function EditChart() {
    const [grid, setGrid] = useState(() => readGrid(get(popupData).active))

    // Trigger immediate updates on change
    useEffect(() => {
        get(popupData).trigger?.(JSON.stringify(grid))
    }, [grid])

    function setCell(rowIdx: number, col: number, value: string) {
        setGrid(grid.map((row, i) => (i === rowIdx ? row.map((cell, c) => (c === col ? value : cell)) : row)))
    }

    function addRow() {
        const nextColor = getDefaultColor(grid.length, grid)
        setGrid([...grid, ["", "0", nextColor]])
    }

    function removeRow(idx: number) {
        if (grid.length <= 1) return
        setGrid(grid.filter((_, i) => i !== idx))
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)" }}>
            {grid.map((row, rowIdx) => (
                // sin key en el original: la posición
                <InputRow key={rowIdx}>
                    <TextField label="inputs.name" value={row[0]} onInput={(value) => setCell(rowIdx, 0, value ?? "")} />
                    <TextField label="variables.value" value={row[1] || ""} onInput={(value) => setCell(rowIdx, 1, value ?? "")} />
                    <ColorField label="edit.color" style={{ maxWidth: "150px" }} value={row[2] || getDefaultColor(rowIdx, grid)} onChange={(value) => setCell(rowIdx, 2, value)} noLabel />

                    <Button variant="outline" icon="delete" disabled={grid.length <= 1} onClick={() => removeRow(rowIdx)} red />
                </InputRow>
            ))}

            <Button variant="outline" icon="add" onClick={addRow}>
                <T id="settings.add" />
            </Button>
        </div>
    )
}
