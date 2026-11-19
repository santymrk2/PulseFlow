import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Condition, ConditionValue, Item } from "../../../types/Show"
import type { StageItem, StageLayout } from "../../../types/Stage"
import { checkConditionValue, isConditionMet } from "../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { getLayoutRef } from "../../components/helpers/show"
import { getSlideTextItems } from "../../components/stage/stage"
import { cn } from "../../shared/core/lib/utils"
import { activeEdit, activeShow, activeStage, overlays, popupData, showsCache, stageShows, templates } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { Textbox } from "../slide/Textbox"
import { Stagebox } from "../stage/Stagebox"
import { Button } from "../ui/button/Button"
import { ConditionsBox, type ConditionChange } from "./ConditionsBox"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { SelectField } from "../ui/select-field/SelectField"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import styles from "./Conditions.module.css"

// Port de components/main/popups/Conditions.svelte.
// Lee (al montar): popupData.obj.contextElem, activeEdit, activeShow, activeStage, y el slide/overlay/plantilla/stage con su item (showsCache, overlays, templates, stageShows).
// Escribe: popupData = {} al montar; y, en cada cambio, item.conditions (+ modified) en el store que corresponda. Sin `.editItem` (y fuera del escenario) no escribe.
// Svelte mutaba en el lugar `conditions`/`showItemValues`, que eran alias del `item.conditions` del store; aquí cada cambio trabaja sobre una copia profunda y la asigna entera a `item.conditions`.
//   El único caso observable que eso cambia es el de un contextElem sin `.editItem` fuera del escenario: el Svelte alteraba el alias sin avisar al store; el menú contextual sólo ofrece
//   "conditions" sobre `.editItem` o `.stage_item`, así que no es alcanzable.
// `slide`, `item` e `itemText` eran lets no reactivos (foto al montar y al cambiar de item): viven en `view`. `itemOptions` se calcula una vez.
// Textbox y Stagebox son ports React directos.
// Los nodos no tenían key en el Svelte: se usa la posición.
type Conditions = { [key: string]: Condition }
type ConditionItem = Item | StageItem
type ItemKey = string | number
type ItemHolder = { items: Record<ItemKey, ConditionItem | undefined>; modified?: number }

interface ConditionsContext {
    obj: { contextElem?: HTMLElement | null }
    edit: { type?: string; id?: string; items: number[] }
    showId: string
    slideId: string
    isStage: boolean
    isOverlay: boolean
    isTemplate: boolean
}

interface ConditionsView {
    itemIndex: ItemKey
    slide: ItemHolder | undefined
    item: ConditionItem | undefined
    itemText: string
    conditions: Conditions
}

const DEFAULT_CONDITIONS: Conditions = { showItem: [] }

function createContext(): ConditionsContext & { itemIndex: ItemKey } {
    const obj = get(popupData).obj || {}
    const edit = get(activeEdit)
    const showId = get(activeShow)?.id || ""
    const ref = getLayoutRef(showId)
    const slideId = ref[edit.slide || 0]?.id || ""

    const stageElem = obj.contextElem?.classList.contains("stage_item") ? obj.contextElem : obj.contextElem?.closest(".stage_item")
    const isStage = !!stageElem

    const itemIndex: ItemKey = isStage ? stageElem.id || get(activeStage).items[0] : Number(edit.items[0] || 0)
    return { obj, edit, showId, slideId, isStage, isOverlay: edit.type === "overlay", isTemplate: edit.type === "template", itemIndex }
}

function findSlide(ctx: ConditionsContext): ItemHolder | undefined {
    if (ctx.isStage) return get(stageShows)[get(activeStage).id || ""] as unknown as ItemHolder | undefined
    if (ctx.isOverlay) return get(overlays)[ctx.edit.id!] as unknown as ItemHolder | undefined
    if (ctx.isTemplate) return get(templates)[ctx.edit.id!] as unknown as ItemHolder | undefined
    return get(showsCache)[ctx.showId]?.slides?.[ctx.slideId] as unknown as ItemHolder | undefined
}

function createView(ctx: ConditionsContext, itemIndex: ItemKey): ConditionsView {
    const slide = findSlide(ctx)
    const item = slide?.items[itemIndex]
    return { itemIndex, slide, item, itemText: getItemText(item as Item), conditions: item?.conditions || clone(DEFAULT_CONDITIONS) }
}

// formato anterior: showItem = { values }
function getShowItemValues(conditions: Conditions): Condition {
    if (Array.isArray(conditions.showItem)) return conditions.showItem
    const legacy = conditions.showItem as unknown as { values?: ConditionValue[] } | undefined
    return legacy?.values?.length ? [[[legacy.values]]] : []
}

function writeConditions(ctx: ConditionsContext, itemIndex: ItemKey, conditions: Conditions) {
    if (ctx.isStage) {
        const stageId = get(activeStage).id || ""
        stageShows.update((a) => {
            const items = a[stageId]?.items as unknown as Record<ItemKey, StageItem | undefined> | undefined
            if (!items?.[itemIndex]) return a
            items[itemIndex].conditions = conditions
            a[stageId].modified = Date.now()
            return a
        })
        return
    }

    const contextElem = ctx.obj.contextElem
    if (!contextElem?.classList.contains("editItem") && !contextElem?.closest(".editItem")) return
    if (itemIndex === undefined) return

    const index = Number(itemIndex)
    if (ctx.isOverlay) {
        overlays.update((a) => {
            if (!a[ctx.edit.id!]?.items?.[index]) return a
            a[ctx.edit.id!].items[index].conditions = conditions
            a[ctx.edit.id!].modified = Date.now()
            return a
        })
    } else if (ctx.isTemplate) {
        templates.update((a) => {
            if (!a[ctx.edit.id!]?.items?.[index]) return a
            a[ctx.edit.id!].items[index].conditions = conditions
            a[ctx.edit.id!].modified = Date.now()
            return a
        })
    } else {
        showsCache.update((a) => {
            if (!a[ctx.showId]?.slides?.[ctx.slideId]?.items?.[index]) return a
            a[ctx.showId].slides[ctx.slideId].items[index].conditions = conditions
            a[ctx.showId].timestamps.modified = Date.now()
            return a
        })
    }
}

export function Conditions() {
    const [ctx] = useState(createContext)
    const [view, setView] = useState(() => createView(ctx, ctx.itemIndex))
    const live = useRef(view)
    const [clipboard, setClipboard] = useState<ConditionValue | null>(null)
    const [zoom, setZoom] = useState(1)
    const [conditionsUpdater, setConditionsUpdater] = useState(0)

    const [itemOptions] = useState(() => Object.entries(view.slide?.items || {}).map(([a, i]) => ({ value: a, label: getItemText(i as Item).slice(0, 30) || (i as Item).type || "", data: (ctx.isStage ? "" : Number(a) + 1).toString() })))

    const { itemIndex, slide, item, itemText, conditions } = view

    function updateItemIndex(value: string | null) {
        if (value === null) return
        const next = createView(ctx, ctx.isStage ? value : Number(value))
        live.current = next
        setView(next)
    }

    // UPDATE

    // copia profunda de showItem para editarla; el resultado se asigna entero a `conditions.showItem` y de ahí al store
    function editValues(edit: (values: Condition) => void) {
        const values = clone(getShowItemValues(live.current.conditions))
        edit(values)

        const next = { ...live.current.conditions, showItem: values }
        live.current = { ...live.current, conditions: next }
        setView(live.current)
        writeConditions(ctx, live.current.itemIndex, next)
    }

    function updateContent(key: string, value: ConditionChange["value"], a: number, b: number, c: number, d: number) {
        editValues((values) => {
            if (!values[a]) values[a] = []
            if (!values[a][b]) values[a][b] = []
            if (!values[a][b][c]) values[a][b][c] = []
            if (!values[a][b][c][d] || key === "element") values[a][b][c][d] = {}

            values[a][b][c][d][key] = value
        })
    }

    function addContent(fromClipboard = false, a: number | null = null, b: number | null = null, c: number | null = null) {
        editValues((values) => {
            if (a !== null && !values[a]) values[a] = []
            if (b !== null && !values[a!][b]) values[a!][b] = []
            if (c !== null && !values[a!][b!][c]) values[a!][b!][c] = []

            const content: ConditionValue = fromClipboard ? clone(clipboard || {}) : {}

            if (a === null) values.push([[[content]]])
            else if (b === null) values[a].push([[content]])
            else if (c === null) values[a][b].push([content])
            else values[a][b][c].push(content)
        })
    }

    function deleteContent(a: number, b: number, c: number, d: number) {
        editValues((values) => {
            if (values[a]?.[b]?.[c]?.[d]) values[a][b][c].splice(d, 1)

            if (values[a]?.[b]?.[c] && !values[a][b][c].length) values[a][b].splice(c, 1)
            if (values[a]?.[b] && !values[a][b].length) values[a].splice(b, 1)
            if (values[a] && !values[a].length) values.splice(a, 1)
        })
    }

    function pasteContent(a: number, b: number, c: number, d: number) {
        if (!clipboard) return
        editValues((values) => {
            if (!values[a]) values[a] = []
            if (!values[a][b]) values[a][b] = []
            if (!values[a][b][c]) values[a][b][c] = []

            values[a][b][c][d] = clone(clipboard)
        })
    }

    useEffect(() => {
        popupData.set({})

        if (item?.conditions) return
        // guess most likely condition

        const setLikelyValue = (value: string, key: string) => updateContent(key, value, 0, 0, 0, 0)

        // timer
        if (item?.type === "timer") {
            setLikelyValue("timer", "element")
            setLikelyValue((item as Item).timer?.id || "", "elementId")
            setLikelyValue("isRunning", "operator")
            return
        }

        const text = itemText

        // dynamic value / variable
        if (text.includes("{")) {
            if (text.includes("{scripture")) return

            const isVariable = text.includes("{$") || text.includes("{variable_")
            setLikelyValue(isVariable ? "variable" : "dynamicValue", "element")

            const valueId = text.replace("{", "").replace("}", "")
            setLikelyValue(valueId, "elementId")

            setLikelyValue("isNot", "operator")

            let emptyValue = ""
            if (text.includes("{video_")) emptyValue = "00:00"
            setLikelyValue(emptyValue, "value")
        }
    }, [])

    // SHOW ITEM

    const showItemValues = getShowItemValues(conditions)
    const OUTER_OR = showItemValues?.length ? showItemValues : [[]]
    // only show if multiple "outer and" (& it has content)
    const addMoreOuter = (showItemValues?.[0]?.length ?? 0) > 1 || (showItemValues?.length ?? 0) > 1

    const isMic = JSON.stringify(OUTER_OR || "").includes('"element":"volume"')

    useEffect(() => {
        const interval = setInterval(() => setConditionsUpdater((value) => value + 1), isMic ? 100 : 2000)
        return () => clearInterval(interval)
    }, [isMic])

    const mode = ctx.isStage ? "stage" : "default"
    const currentItemText =
        ctx.isStage && item?.type === "slide_text"
            ? getSlideTextItems(slide as unknown as StageLayout, item as StageItem)
                  .map((textItem) => getItemText(textItem as Item))
                  .join("")
            : itemText
    const showItemState = isConditionMet(OUTER_OR, currentItemText, mode, conditionsUpdater)

    return (
        <>
            {itemOptions.length > 1 ? (
                <>
                    <SelectField label="tools.item" style={{ marginBottom: "10px" }} options={itemOptions} value={itemIndex.toString()} onChange={updateItemIndex} />

                    <div className={styles.preview} style={showItemState ? undefined : { opacity: 0.2 }}>
                        <div className={styles.slide}>{ctx.isStage ? <Stagebox id={ctx.showId} item={item as StageItem | undefined} ratio={1} /> : item ? <Textbox item={item as unknown as Item} ref={{ id: ctx.showId }} /> : null}</div>
                    </div>
                </>
            ) : null}

            <div className="zoom center">
                <div className={cn("checkered", styles.nodes)} style={{ zoom: String(zoom) }}>
                    <div className={cn(styles.node, styles.root, showItemState && styles.isActive)}>
                        <p>{translateText("conditions.show_item")}</p>
                    </div>

                    {OUTER_OR.map((outerAnd, a) => {
                        const OUTER_AND = outerAnd?.length ? outerAnd : [[]]
                        // only show if multiple "inner or" (& it has content)
                        const addMoreInOuter = (outerAnd?.[0]?.length ?? 0) > 1 || (outerAnd?.length ?? 0) > 1

                        return (
                            <div key={a} className={cn(styles.node, styles.or, styles.outer, styles.trail, a === 0 && styles.first)} style={(OUTER_AND[0]?.length ?? 0) < 2 && !addMoreInOuter ? { padding: 0 } : undefined}>
                                {OUTER_AND.map((innerOr, b) => {
                                    const INNER_OR = innerOr?.length ? innerOr : [[]]
                                    const addMore = !!innerOr?.[0]?.[0]

                                    return (
                                        <div key={b} className={cn(styles.node, styles.and, styles.outer, b > 0 && styles.trail)} style={(INNER_OR[0]?.length ?? 0) < 2 && !addMore ? { padding: 0 } : undefined}>
                                            {INNER_OR.map((innerAnd, c) => {
                                                const INNER_AND = innerAnd?.length ? innerAnd : [{}]

                                                return (
                                                    <div key={c} className={cn(styles.node, styles.or, c > 0 && styles.trail)}>
                                                        {INNER_AND.map((content, d) => {
                                                            const CONTENT = content || {}

                                                            return (
                                                                <div key={d} className={cn(styles.node, styles.and, d > 0 && styles.trail, checkConditionValue(content, currentItemText, mode, conditionsUpdater) && styles.isActive)}>
                                                                    {innerAnd?.length || a !== 0 || b !== 0 || c !== 0 || d !== 0 ? (
                                                                        <>
                                                                            <div className={styles.delete}>
                                                                                <Button variant="outline" icon="delete" title="actions.delete" style={{ padding: "8px", borderRadius: "50%" }} onClick={() => deleteContent(a, b, c, d)} />
                                                                            </div>
                                                                            <div className={styles.copy}>
                                                                                <Button variant="outline" showOutline={JSON.stringify(CONTENT) === JSON.stringify(clipboard)} icon="copy" title="actions.copy" style={{ padding: "8px", borderRadius: "50%" }} onClick={() => setClipboard(clone(CONTENT))} />
                                                                            </div>
                                                                        </>
                                                                    ) : clipboard ? (
                                                                        <div className={cn(styles.delete, "paste")}>
                                                                            <Button variant="outline" icon="paste" title="actions.paste" style={{ padding: "8px", borderRadius: "50%" }} onClick={() => pasteContent(a, b, c, d)} />
                                                                        </div>
                                                                    ) : null}

                                                                    <ConditionsBox input={CONTENT} onChange={(change) => updateContent(change.key, change.value, a, b, c, d)} />
                                                                </div>
                                                            )
                                                        })}

                                                        {addMore ? (
                                                            <div className={cn(styles.buttons, styles.node, styles.and, styles.trail)}>
                                                                <Button variant="outline" icon="add" title="settings.add" onClick={() => addContent(false, a, b, c)} />
                                                                {clipboard ? <Button variant="outline" icon="paste" title="actions.paste" onClick={() => addContent(true, a, b, c)} /> : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}

                                            {addMore ? (
                                                <div className={cn(styles.buttons, styles.node, styles.or, styles.trail)}>
                                                    <Button variant="outline" icon="add" title="settings.add" onClick={() => addContent(false, a, b)} />
                                                    {clipboard ? <Button variant="outline" icon="paste" title="actions.paste" onClick={() => addContent(true, a, b)} /> : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                })}

                                {addMoreInOuter ? (
                                    <div className={cn(styles.buttons, styles.node, styles.and, styles.trail)}>
                                        <Button variant="outline" icon="add" title="settings.add" onClick={() => addContent(false, a)} />
                                        {clipboard ? <Button variant="outline" icon="paste" title="actions.paste" onClick={() => addContent(true, a)} /> : null}
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}

                    {addMoreOuter ? (
                        <div className={cn(styles.buttons, styles.node, styles.or, styles.trail)}>
                            <Button variant="outline" icon="add" title="settings.add" onClick={() => addContent(false)} />
                            {clipboard ? <Button variant="outline" icon="paste" title="actions.paste" onClick={() => addContent(true)} /> : null}
                        </div>
                    ) : null}
                </div>

                <FloatingBar style={addMoreOuter ? undefined : { border: "none" }} round>
                    <ZoomControl hidden={!addMoreOuter} columns={zoom} min={0.5} max={1.5} defaultValue={1} addValue={-0.1} onChange={setZoom} />
                </FloatingBar>
            </div>
        </>
    )
}
