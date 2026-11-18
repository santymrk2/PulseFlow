import { useEffect, useState, type MouseEvent } from "react"
import type { EffectItem } from "../../../types/Effects"
import type { TabsObj } from "../../../types/Tabs"
import Tabs from "../../components/main/Tabs.svelte"
import EditValues from "../../components/edit/tools/EditValues.svelte"
import { effectSections } from "../../components/edit/values/effects"
import { clone } from "../../components/helpers/array"
import { addToPos } from "../../components/helpers/mover"
import { activeEdit, effects, hoveredEffectItem } from "../../stores"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import stylesModule from "./EffectTools.module.css"

const tabs: TabsObj = {
    effect: { name: "items.effect", icon: "effects" },
    options: { name: "edit.options", icon: "options", overflow: true }
}

// Port de components/edit/EffectTools.svelte. Tabs es una isla Svelte (sin bind:active), así que el tab se deduce por clic.
export function EffectTools() {
    const currentActiveEdit = useStore(activeEdit)
    const currentEffects = useStore(effects)

    const [active, setActive] = useState(Object.keys(tabs)[0])
    const [openedMenus, setOpenedMenus] = useState<Record<string, boolean>>({})
    const [moved, setMoved] = useState(0)

    const effectId = currentActiveEdit.id || ""
    const currentEffect = currentEffects[effectId] || { items: [] }
    const currentItems = (currentEffect.items || []) as EffectItem[]

    useEffect(() => {
        return () => {
            hoveredEffectItem.set(null)
        }
    }, [])

    function valueChanged(input: unknown, itemIndex: number) {
        if (!effectId || !currentEffect?.items?.[itemIndex] || !input || typeof input !== "object") return
        const data = input as { id?: string; value?: unknown; values?: { value?: unknown } }
        if (!data.id) return
        const value = data.values?.value ?? data.value

        effects.update((all) => {
            if (!all[effectId]?.items?.[itemIndex]) return all
            all[effectId].items[itemIndex] = { ...all[effectId].items[itemIndex], [data.id as string]: value }
            return all
        })
    }

    function getItemSections(item: EffectItem) {
        if (!effectSections[item.type as keyof typeof effectSections]) return null
        return { default: clone(effectSections[item.type as keyof typeof effectSections]) }
    }

    function move(index: number, newIndex: number) {
        setOpenedMenus({})
        effects.update((all) => {
            if (!all[effectId]?.items) return all
            const item = all[effectId].items.splice(index, 1)
            all[effectId].items = addToPos(all[effectId].items, item, newIndex)
            return all
        })
        setMoved((value) => value + 1)
    }

    function handleTabsClick(event: MouseEvent<HTMLDivElement>) {
        const button = (event.target as Element).closest("button")
        const ids = Object.keys(tabs)
        const index = button ? Array.from(event.currentTarget.querySelectorAll(".tabs > button")).indexOf(button) : -1
        if (index > -1) setActive(ids[index])
    }

    const invertedItems = [...currentItems].reverse()

    return (
        <div className={`main border editTools ${stylesModule.main}`}>
            <div style={{ display: "contents" }} onClick={handleTabsClick}>
                <SvelteIsland component={Tabs} props={{ tabs, active }} />
            </div>

            <div className={stylesModule.content}>
                {active === "effect" ? (
                    <div className={stylesModule.items} key={moved}>
                        {invertedItems.map((item, displayIndex) => {
                            const index = currentItems.length - displayIndex - 1
                            const editContent = getItemSections(item)
                            const open = !!openedMenus[String(index)]

                            return (
                                <div key={`${index}-${moved}`} className={`item-row context #effect_item ${stylesModule.itemRow}`} id={String(index)} data-index={index} onMouseEnter={() => hoveredEffectItem.set(item.hidden ? null : index)} onMouseLeave={() => hoveredEffectItem.set(null)}>
                                    <InputRow arrow={!!editContent} open={open} onOpenChange={(value) => setOpenedMenus((current) => ({ ...current, [String(index)]: value }))} menu={editContent ? <SvelteIsland component={EditValues} props={{ sections: editContent, item }} events={{ change: (event) => valueChanged((event as CustomEvent).detail, index) }} /> : null}>
                                        <div className={stylesModule.title} style={item.hidden ? { opacity: 0.5 } : undefined}>
                                            <p style={{ width: "100%" }}>
                                                <T id={`effect.${(item.type as string) === "shape" ? (item as unknown as { shape?: string }).shape || (item.type as string) : (item.type as string)}`} />
                                            </p>
                                        </div>

                                        {displayIndex < invertedItems.length - 1 ? <Button className="down" icon="down" onClick={() => move(index, index - 1)} /> : null}
                                        {displayIndex > 0 ? <Button className="up" icon="up" onClick={() => move(index, index + 1)} /> : null}
                                    </InputRow>
                                </div>
                            )
                        })}
                    </div>
                ) : active === "options" ? (
                    <div className="section">
                        <ColorField
                            label="edit.background_color"
                            value={currentEffect.background || ""}
                            onInput={(value) => {
                                effects.update((all) => {
                                    if (!all[effectId]) return all
                                    all[effectId].background = value
                                    return all
                                })
                            }}
                            allowEmpty
                            noLabel
                        />
                        <NumberField
                            label="edit.opacity"
                            value={(currentEffect.opacity ?? 1) * 100}
                            max={100}
                            onChange={(value) => {
                                effects.update((all) => {
                                    if (!all[effectId]) return all
                                    all[effectId].opacity = Number(value) / 100
                                    return all
                                })
                            }}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    )
}
