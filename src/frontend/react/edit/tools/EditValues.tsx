// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react"
import type { CustomFont } from "../../../../types/Show"
import { actions, activeEdit, activePage, activeStage, outputs, special, timers } from "../../../shared/core/stores"
import { throttle } from "../../../shared/utils/common"
import { translateText } from "../../../shared/utils/language"
import { mediaExtensions } from "../../../shared/core/values/extensions"
import { getSortedTimers } from "../../../components/drawer/timers/timers"
import { clone, keysToID, sortByName } from "../../../shared/utils/helpers/array"
import { getFilters, getStyles } from "../../../shared/utils/helpers/style"
import { FormInput } from "../../../shared/ui/form/FormInput"
import { getIsoLanguages } from "../../../components/main/popups/localization/translation"
import { SlideTimeline } from "../../../components/timeline/SlideTimeline"
import { parseShadowValue } from "../../../components/edit/scripts/edit"
import { filterItemStyle, mergeWithStyle } from "../../../components/edit/scripts/itemClipboard"
import { getShapeOutsideStyle, parseShapeOutsideValue } from "../../../components/edit/scripts/shapeOutside"
import type { EditBoxSection, EditInput } from "../../../components/edit/values/boxes"
import { captionTranslateLanguages } from "../../../components/edit/values/captionLanguages"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Button } from "../../../shared/ui/kit/button/Button"
import { FileField } from "../../../shared/ui/kit/file-field/FileField"
import { FontField } from "../../../shared/ui/kit/font-field/FontField"
import { InputRow } from "../../../shared/ui/kit/input-row/InputRow"
import { PopupField } from "../../../shared/ui/kit/popup-field/PopupField"
import { TextareaField } from "../../../shared/ui/kit/textarea-field/TextareaField"
import styles from "./EditValues.module.css"

export interface EditValuesProps {
    sections?: { [key: string]: EditBoxSection }
    styles?: { [key: string]: string }
    customValues?: { [key: string]: string }
    customLocalFonts?: CustomFont[]
    item?: Record<string, unknown>
    isStage?: boolean
    type?: string
    onChange?: (input: EditInput) => void
}

export function EditValues({ sections = {}, styles: styleValues = {}, customValues = {}, customLocalFonts = [], item = {}, isStage = false, type = "", onChange }: EditValuesProps) {
    const currentActions = useStore(actions)
    const currentActiveEdit = useStore(activeEdit)
    const currentActivePage = useStore(activePage)
    const currentActiveStage = useStore(activeStage)
    const currentOutputs = useStore(outputs)
    const currentSpecial = useStore(special)
    const currentTimers = useStore(timers)

    const [openedSections, setOpenedSections] = useState<string[]>([])
    const [timelineUpdater, setTimelineUpdater] = useState(0)
    const lastChanged = useRef({ value: "", key: "" })

    function dispatchChange(input: EditInput) {
        onChange?.(clone(input))
    }

    function getStyleString(input: EditInput) {
        let style = ""
        const isItem = input.id === "CSS_item"
        const currentStyle = isItem ? item?.style : input.values?.value
        style = (item.type || "text") === "text" && !isStage ? currentStyle : filterItemStyle(currentStyle, isItem)
        if (!style) return ""

        const split = style.split(";").filter((a) => a)
        const sorted = split.sort((a, b) => a.localeCompare(b))
        style = sorted.join(";") + ";"

        style = style.replaceAll(";", ";\n").replaceAll(": ", ":").replaceAll(":", ": ").trim()
        return style
    }

    function getValue(input: EditInput, _updater: unknown = null) {
        if (!item) return ""

        if (input.type === "toggle") return styleValues[input.key || ""] || ""
        if (input.type === "radio") return customValues[input.key || ""] || ""
        if (input.id.includes("CSS")) return getStyleString(input)

        const defaultValue = input.value
        let value: unknown = null
        if (input.id === "filter" || input.id === "backdrop-filter") {
            value = getFilters((item as Record<string, string>)[input.id] || getStyles(String((item as Record<string, string>).style))[input.id])?.[input.key || ""] || input.values.value || input.value
        } else if (input.key) {
            value = styleValues[input.key || ""]
            const valueStr = typeof value === "string" ? value : String(value ?? "")
            if (input.type === "checkbox") {
                if (input.key === "box-shadow" || input.key === "text-shadow") {
                    value = valueStr.includes("inset") || false
                } else if (input.styleValue) {
                    value = valueStr.includes(input.styleValue) || false
                } else {
                    value = !!value
                }
            } else if (input.valueIndex !== undefined) {
                if (input.key === "box-shadow" || input.key === "text-shadow") {
                    const arr = parseShadowValue(value)
                    value = arr[input.valueIndex]
                } else if (input.key === "shape-outside") {
                    const arr = parseShapeOutsideValue(value)
                    value = arr[input.valueIndex]
                } else {
                    value = valueStr.split(" ")[input.valueIndex]
                }
            }
            if (input.extension && value !== "" && typeof value !== "boolean") value = Number(String(value ?? "").replace(input.extension, ""))
        } else {
            const parts = input.id.split(".")
            if (parts.length > 1) value = (item as Record<string, Record<string, unknown>>)[parts[0]]?.[parts[1]]
            else value = (item as Record<string, unknown>)[input.id]
        }

        if (input.type === "number") {
            if (value === "") value = undefined
            else value = Number(value)
            if (Number.isNaN(value as number)) value = undefined
        }
        if (value === undefined) value = defaultValue

        if (input.multiplier && typeof value === "number") value = value * input.multiplier

        if (input.type === "fontDropdown" && typeof value === "string") value = value.replaceAll("'", "")

        return value
    }

    function changed(e: unknown, input: EditInput, sectionId = "", onlyTimeline = false) {
        const ev = e as { detail?: unknown } | null
        let value: unknown = ev?.detail ?? e

        if (input.multiplier) {
            if (!value || Number.isNaN(Number(value))) value = input.value || 0
            value = Number(value) / input.multiplier
        }

        if (currentSpecial.slideTimelineActive && currentActivePage === "edit" && (currentActiveEdit.type || "show") === "show" && (onlyTimeline || SlideTimeline.hasActionWithKey(input.key || "", type))) {
            let timelineValue = value

            if (!onlyTimeline && lastChanged.current.key === input.key && lastChanged.current.value === value) return
            lastChanged.current = { key: input.key || "", value }

            if (input.key === "width" || input.key === "left") timelineValue = 1920 * (timelineValue / 100)
            if (input.key === "height" || input.key === "top") timelineValue = 1080 * (timelineValue / 100)

            const indexes = currentActiveEdit?.items?.length ? currentActiveEdit.items : [0]
            SlideTimeline.addKeyframe({ name: input.values?.label, key: input.key, value: timelineValue, type, indexes }, onlyTimeline)
            if (onlyTimeline) return
        }

        if (input.extension) value += input.extension

        if (input.valueIndex !== undefined) {
            if (sections[sectionId]) {
                const allKeyValues = sections[sectionId]?.inputs.flat().filter((a) => a.key === input.key)
                const sortedKeys = allKeyValues.sort((a, b) => (a.valueIndex || 0) - (b.valueIndex || 0))

                let currentValue = styleValues[input.key || ""] || ""
                const isInset = (input.key === "box-shadow" || input.key === "text-shadow") && currentValue.includes("inset")
                let arr: string[]
                if (input.key === "box-shadow" || input.key === "text-shadow") arr = parseShadowValue(currentValue)
                else if (input.key === "shape-outside") arr = parseShapeOutsideValue(currentValue)
                else arr = currentValue.split(" ").filter(Boolean)
                arr[input.valueIndex] = value

                for (let i = 0; i < sortedKeys.length; i++) {
                    if (sortedKeys[i].extension && arr[i] !== undefined && arr[i] !== "") {
                        if (!arr[i].toString().endsWith(sortedKeys[i].extension)) {
                            arr[i] = String(arr[i]).replace(/[^0-9.\-]+$/, "") + String(sortedKeys[i].extension)
                        }
                    }
                }

                if (input.key === "shape-outside") {
                    value = getShapeOutsideStyle(arr[0], arr[1], arr[2], arr[3], item?.style)
                } else {
                    value = arr.join(" ")
                    if (isInset) value = "inset " + value
                }
            } else {
                value = ""
            }
        } else if (input.type === "checkbox" && (input.key === "box-shadow" || input.key === "text-shadow")) {
            let currentValue = styleValues[input.key || ""] || ""
            const isInset = value
            currentValue = currentValue.replace(/\binset\b/gi, "").trim()
            if (isInset) value = "inset " + currentValue
            else value = currentValue
        } else if (input.type === "checkbox" && input.key && input.id === "style") {
            if (input.styleValue) value = value ? input.styleValue : null
            else if (!value) value = null
        }

        if (input.key === "color" && item?.lines && sections["shadow"] && !hasChangedValues("shadow") && typeof value === "string" && value.includes("gradient")) {
            toggleSection("shadow")
        }

        if (input.id.includes("CSS")) {
            value = String(value).replaceAll("\n", "")
            value = (item.type || "text") === "text" && !isStage ? String(value) : mergeWithStyle(String(value), String(item.style || ""), input.id === "CSS_item")
        }

        const dispatchedInput = clone(input)
        if (!dispatchedInput.values) dispatchedInput.values = {}
        dispatchedInput.values.value = value

        const inputKey = `${input.id}${input.key || ""}${input.valueIndex ?? ""}`
        throttle(inputKey, dispatchedInput, (val) => dispatchChange(val), 20)

        if (input.values) input.values.value = ev?.detail ?? e
    }

    function toggle(input: EditInput & { value?: string; values?: { value?: string } }) {
        let value = styleValues[input.key || ""] || ""

        const token = String(input.value || "")
        const exists: number = value.indexOf(token)
        if (exists > -1) value = value.slice(0, exists) + value.substring(exists + token.length)
        else value = value + " " + token
        value = value.trim()

        input.values.value = value
        dispatchChange(clone(input))
    }

    function radio(input: EditInput & { value?: string; values?: { value?: string } }) {
        if (!input.values) input.values = {}
        input.values.value = input.value
        dispatchChange(clone(input))
    }

    function isDefaultValue(input: EditInput, defaultValue: unknown) {
        if (defaultValue === undefined || defaultValue === null) defaultValue = input.value
        let currentValue = getValue(input)

        if (input.type === "toggle") {
            return !String(currentValue || "").includes(String(defaultValue ?? ""))
        }

        if (input.multiplier && typeof defaultValue === "number") defaultValue = defaultValue * input.multiplier

        return currentValue === defaultValue
    }

    function hasChangedValues(id: string, _updater: unknown = null) {
        if (!sections[id]) return false

        const allInputsToCheck: EditInput[] = []
        const filterOut: string[] = []

        sections[id].inputs.flat().forEach((input) => {
            if (filterOut.includes(input.key || "")) return
            if (input.type === "radio") filterOut.push(input.key || "")
            allInputsToCheck.push(input)
        })

        const hasChanged = allInputsToCheck.some((a, i) => !isDefaultValue(a, sections[id].defaultValues?.[i]))
        return hasChanged
    }

    // preserve behavior: auto-open changed sections
    useEffect(() => {
        setOpenedSections((prev) => {
            let next = prev
            Object.keys(sections || {}).forEach((id) => {
                if (sections[id]?.noReset) return
                if (hasChangedValues(id) && !next.includes(id)) {
                    if (next === prev) next = [...prev]
                    next.push(id)
                }
            })
            return next
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections, styleValues, item, customValues])

    function toggleSection(id: string) {
        setOpenedSections((prev) => {
            const activeIndex = prev.indexOf(id)
            if (activeIndex < 0) {
                if (sections[id]?.expandAutoValue) {
                    Object.entries(sections[id].expandAutoValue || {}).forEach(([key, value]) => {
                        const input = clone(sections[id].inputs.flat().find((a) => a.id === key || a.key === key))
                        if (!input) return

                        const inputAny = input as Record<string, unknown>
                        if (input.valueIndex !== undefined) {
                            delete inputAny.valueIndex
                            delete inputAny.extension
                        }

                        let nextValue: unknown = value
                        if (key === "shape-outside") {
                            const [size = "45", top = "0", left = "100", radius = "0"] = typeof value === "string" ? value.split(/\s+/) : []
                            nextValue = getShapeOutsideStyle(size, top, left, radius, String(item?.style || ""))
                        }

                        changed({ detail: nextValue }, input, id)
                    })
                }

                return [...prev, id]
            }

            const next = [...prev]
            next.splice(activeIndex, 1)
            return next
        })
    }

    function resetSection(id: string) {
        sections[id].inputs.forEach((inputRow, rowIndex) => {
            inputRow.forEach((input) => {
                const customDefaultValue = sections[id].defaultValues?.[rowIndex]
                if (isDefaultValue(input, customDefaultValue)) return

                let defaultValue = customDefaultValue ?? input.value

                if (input.type === "toggle") defaultValue = ""
                if (input.type === "radio" && input.value !== defaultValue) return

                if (input.multiplier) defaultValue *= input.multiplier

                setTimeout(() => changed({ detail: defaultValue }, input))
            })
        })

        if (sections[id].expandAutoValue) setTimeout(() => toggleSection(id))
    }

    const sectionValues = useMemo(() => Object.entries(sections || {}), [sections])

    function getOptions(options: string | unknown[] | undefined): { value: string; label: string; data?: unknown }[] {
        if (typeof options === "string") {
            if (options === "timers") {
                return getSortedTimers(currentTimers, { showHours: (item as { timer?: { showHours?: boolean } })?.timer?.showHours !== false, firstActive: isStage }).map((a: { id?: string; name?: string; extraInfo?: unknown }) => ({ value: String(a.id || ""), label: String(a.name || ""), data: a.extraInfo }))
            }
            if (options === "actions") {
                return sortByName(keysToID(currentActions) as { id: string; name?: string }[]).map((a) => ({ value: String(a.id), label: String(a.name || "") }))
            }
            if (options === "outputWindows") {
                return sortByName((keysToID(currentOutputs) as { id: string; name?: string; stageOutput?: string }[]).filter((a) => a.stageOutput !== currentActiveStage.id)).map((a) => ({ value: String(a.id), label: String(a.name || "") }))
            }
            if (options === "captionTranslateLanguages") {
                return (item as { captions?: { googlekey?: string } })?.captions?.googlekey ? [{ value: "", label: "—" }, ...getIsoLanguages().map((a) => ({ value: String((a as { code?: string; value?: string }).code || (a as { value?: string }).value || ""), label: String((a as { name?: string; label?: string }).name || (a as { label?: string }).label || "") }))] : captionTranslateLanguages.map((a) => ({ value: a.id, label: a.name }))
            }
            return []
        }
        return (options || []) as { value: string; label: string; data?: unknown }[]
    }

    function getValues(input: EditInput & { values?: Record<string, unknown> }) {
        const values = clone(input.values || {})
        if (input.type === "dropdown") {
            if (values.options === "timers") values.addNew = "new.timer"
            values.options = getOptions(values.options)
        }
        return values
    }

    useEffect(() => {
        if (!sections?.timeline) return
        const interval = setInterval(() => setTimelineUpdater((v) => v + 1), 100)
        return () => clearInterval(interval)
    }, [sections?.timeline])

    return (
        <div className={styles.tools}>
            {sectionValues.map(([id, section]) => {
                const hasChanged = section.noReset ? false : hasChangedValues(id, { styleValues, item })
                const expanded = id === "default" || !!section.alwaysOpen || openedSections.includes(id)

                return (
                    <div key={id} className={styles.section} style={expanded ? { marginBottom: "3px" } : undefined}>
                        {id !== "default" ? (
                            <div className={styles.title}>
                                <Button style={{ width: "100%", padding: hasChanged ? "4px 12px" : "8px 12px" }} disabled={hasChanged || section.alwaysOpen} onClick={() => toggleSection(id)}>
                                    <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                        {id === "CSS" ? (
                                            <>
                                                <Icon id="code" white />
                                                <p>CSS</p>
                                            </>
                                        ) : (
                                            <>
                                                <Icon id={id} />
                                                <p>{translateText(section.name || "edit." + id)}</p>
                                            </>
                                        )}
                                    </span>

                                    {hasChanged ? (
                                        <Button title="actions.reset" style={{ pointerEvents: "all", padding: "4px" }} onClick={() => resetSection(id)}>
                                            <Icon id="reset" size={0.8} white />
                                        </Button>
                                    ) : !section.alwaysOpen ? (
                                        <Icon id={section.expandAutoValue && !expanded ? "add" : "arrow_back_modern"} className={`${styles.arrow} ${expanded ? styles.open : ""}`} size={section.expandAutoValue && !expanded ? 0.9 : 0.6} style={{ opacity: 0.5 }} white />
                                    ) : null}
                                </Button>
                            </div>
                        ) : null}

                        {expanded
                            ? section.inputs.map((inputRow, rowIndex) => (
                                  <InputRow key={rowIndex}>
                                      {inputRow.map((input, inputIndex) => {
                                          if (input.hidden) return null
                                          const value = getValue(input, { styleValues, item, customValues })
                                          const values = getValues(input)
                                          const hasTimelineAction = !!(currentSpecial.slideTimelineActive && currentActivePage === "edit" && (currentActiveEdit.type || "show") === "show" && SlideTimeline.hasActionAtTime(input.key || "", type, currentActiveEdit?.items?.length ? currentActiveEdit.items : [0], timelineUpdater))

                                          if (input.type === "fontDropdown") {
                                              return <FontField key={`${input.id}-${input.key}-${inputIndex}`} label={values.label} value={String(value ?? "")} style={values.style} fontStyleValue={input.styleValue || ""} customLocalFonts={customLocalFonts} onChange={(v) => changed({ detail: v }, input)} onFontStyle={(v) => changed({ detail: v }, { ...input, key: "font" } as EditInput)} enableFontStyles />
                                          }
                                          if (input.type === "toggle") {
                                              return (
                                                  <Button key={`${input.id}-${input.key}-${inputIndex}`} style={{ minWidth: "50px", flex: 1 }} title={String((values as { label?: string }).label || "")} onClick={() => toggle(input)}>
                                                      <Icon id={String((values as { icon?: string }).icon || "")} size={1.2} white />
                                                      <div className={`${styles.highlight} ${String(value || "").includes(String(input.value || "")) ? styles.active : ""}`}></div>
                                                  </Button>
                                              )
                                          }
                                          if (input.type === "radio") {
                                              return (
                                                  <Button key={`${input.id}-${input.key}-${inputIndex}`} style={{ minWidth: "50px", flex: 1 }} title={String((values as { label?: string }).label || "")} onClick={() => radio(input)}>
                                                      <Icon id={String((values as { icon?: string }).icon || "")} size={1.2} white />
                                                      <div className={`${styles.highlight} ${styles.radio} ${value === input.value ? styles.active : ""}`}></div>
                                                  </Button>
                                              )
                                          }
                                          if (input.type === "textarea") {
                                              return <TextareaField key={`${input.id}-${input.key}-${inputIndex}`} label={String((values as { label?: string }).label || "")} value={String(value ?? "")} onChange={(v) => changed({ detail: v }, input, id)} />
                                          }
                                          if (input.type === "media") {
                                              return <FileField key={`${input.id}-${input.key}-${inputIndex}`} label={String((value ? (values as { label?: string }).label : "") || "edit.choose_media")} value={String(value ?? "")} filter={{ name: "Media files", extensions: mediaExtensions }} onChange={(v) => changed({ detail: Array.isArray(v) ? v[0] : v }, input, id)} autoTrigger={currentActiveEdit.type !== "template"} allowEmpty />
                                          }
                                          if (input.type === "popup") {
                                              return <PopupField key={`${input.id}-${input.key}-${inputIndex}`} {...(values as Record<string, unknown>)} label={String((values as { label?: string }).label || "")} name={String((values as { name?: string }).name || "")} popupId={String((values as { popupId?: string }).popupId || "")} value={value as string | undefined} onChange={(v) => changed({ detail: v }, input, id)} allowEmpty={(values as { allowEmpty?: boolean }).allowEmpty !== false} />
                                          }
                                          if (input.type === "tip") {
                                              return (
                                                  <p key={`${input.id}-${input.key}-${inputIndex}`} className={styles.tip}>
                                                      {(values as { label?: string }).label ? translateText(String((values as { label?: string }).label)) : null}
                                                      <span dangerouslySetInnerHTML={{ __html: String((input.values as { subtext?: string } | undefined)?.subtext || "") }} />
                                                      {String((input.values as { subtext?: string } | undefined)?.subtext || "").includes("<a href=") ? <Icon id="launch" white /> : null}
                                                  </p>
                                              )
                                          }

                                          return <FormInput key={`${input.id}-${input.key}-${inputIndex}`} input={{ type: input.type, ...values, value }} hasTimelineAction={hasTimelineAction} onChange={(newValue) => changed(newValue, input, id)} onKeyframe={(newValue) => changed(newValue, input, id, true)} />
                                      })}
                                  </InputRow>
                              ))
                            : null}
                    </div>
                )
            })}
        </div>
    )
}
