import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { OUTPUT } from "../../../types/Channels"
import type { Transition as TransitionValue } from "../../../types/Show"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { activeEdit, activeShow, overlays, popupData, selected, showsCache, styles, templates, transitionData } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { send } from "../../utils/request"
import { easings, transitionTypes } from "../../utils/transitions"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Tabs } from "../main/Tabs"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import stylesModule from "./Transition.module.css"

// Port de components/main/popups/Transition.svelte. Lee: popupData (al montar), transitionData, styles, selected, activeEdit, overlays y templates.
// Escribe: popupData = {} al montar (salvo trigger), transitionData global, history para slides/items/styles y trigger(valor), además de un
// send(OUTPUT, ["SHOWS"]) 500 ms después de cambiar una transición de slide.
// Las pestañas son el port React (P11c): onActiveChange actualiza selectedType y selectedSpecific.
// Los SVG `{@html icons[type.id]}` se conservan como dangerouslySetInnerHTML con la misma fuente del Svelte.
type TransitionKey = "type" | "duration" | "easing" | "fadeInOffset" | "custom"
type TransitionTypes = "text" | "media"

const icons = {
    none: '<g><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    fade: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_0" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_0);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_1" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_1);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    blur: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_4" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_4);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_5" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_5);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><filter id="F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7" x="-200%" y="-200%" width="400%" height="400%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feGaussianBlur xmlns="http://www.w3.org/2000/svg" stdDeviation="5.968116597346249"/></filter></defs><g filter="url(#F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7)"><path d="M 39 25 L 71 25 C 73.208 25 75 26.792 75 29 L 75 61 C 75 63.208 73.208 65 71 65 L 39 65 C 36.792 65 35 63.208 35 61 L 35 29 C 35 26.792 36.792 25 39 25 Z" style="stroke:none;fill:#EBEBEB;stroke-miterlimit:10;opacity:0.5;"/></g></g>',
    spin: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_10" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_10);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_11" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="stroke:none;fill:url(#_lgradient_11);stroke-miterlimit:10;"/><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
    scale: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_6" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_6);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_7" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_7);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 L 55.5 44.5 Z  M 24.5 63.5 L 24.5 75.5 L 24.5 63.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="35" y1="75.5" x2="24.5" y2="75.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>',
    slide: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_8" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_8);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_9" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_9);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>'
}

const DEFAULT_TRANSITIONS = {
    text: { type: "fade", duration: 500, easing: "sine", custom: {} },
    media: { type: "fade", duration: 800, easing: "sine", custom: {} }
}
const SPECIFIC_SCENARIOS = ["in", "out", "between"]
const iconSize = 60

export function Transition() {
    const transitionDataValue = useStore(transitionData)
    const stylesValue = useStore(styles)
    const selectedValue = useStore(selected)

    const [initial] = useState(() => {
        const data = get(popupData)
        const isItem = data.action === "transition"
        const isStyle = data.action === "style_transition" || data.id === "style"
        const popupDataId = (data.id as string) || ""
        const isSlide = get(selected).id === "slide"
        const ref = isSlide || isItem ? getLayoutRef() : []
        const activeEditValue = get(activeEdit)
        const slideIndex = isItem ? activeEditValue.slide : get(selected).data?.[0]?.index
        const slideRef = (ref as unknown as { id?: string; data?: Record<string, unknown> }[])[slideIndex as number] || {}
        let slideItems: Record<string, unknown>[] = []
        if (isItem) {
            if (activeEditValue.type === "overlay") slideItems = (get(overlays)[activeEditValue.id || ""]?.items || []) as unknown as unknown as Record<string, unknown>[]
            else if (activeEditValue.type === "template") slideItems = (get(templates)[activeEditValue.id || ""]?.items || []) as unknown as unknown as Record<string, unknown>[]
            else slideItems = (_show().get("slides")?.[slideRef.id || ""]?.items || []) as unknown as unknown as Record<string, unknown>[]
        }
        const firstItem = (slideItems[activeEditValue.items[0]] || {}) as { actions?: { transition?: TransitionValue } }
        const firstSlide = (slideRef.data || {}) as { transition?: TransitionValue; mediaTransition?: TransitionValue }
        return { currentValue: data.active || "", trigger: data.trigger as ((value: unknown) => void) | undefined, isItem, isStyle, popupDataId, isSlide, ref, slideIndex, slideRef, slideItems, firstItem, firstSlide }
    })

    const [selectedType, setSelectedType] = useState<TransitionTypes>("text")
    const [selectedSpecific, setSelectedSpecific] = useState(SPECIFIC_SCENARIOS[0])
    const [enableSpecific, setEnableSpecific] = useState(false)
    const [showMore, setShowMore] = useState(false)

    useEffect(() => {
        if (!initial.trigger) popupData.set({})
    }, [])

    const slideItemTransition = initial.isItem ? clone(initial.firstItem.actions?.transition || transitionDataValue.text || clone(DEFAULT_TRANSITIONS.text)) : ({} as TransitionValue)
    const slideTextTransition = initial.isSlide ? clone(initial.firstSlide.transition || transitionDataValue.text || clone(DEFAULT_TRANSITIONS.text)) : ({} as TransitionValue)
    const slideMediaTransition = initial.isSlide ? clone(initial.firstSlide.mediaTransition || transitionDataValue.media || clone(DEFAULT_TRANSITIONS.media)) : ({} as TransitionValue)

    const styleTransition = clone(initial.currentValue || stylesValue[initial.popupDataId]?.transition || { text: clone(DEFAULT_TRANSITIONS.text), media: clone(DEFAULT_TRANSITIONS.media) })
    const styleTextTransition = styleTransition.text || {}
    const styleMediaTransition = styleTransition.media || {}

    const slideLabel = initial.isSlide ? translateText(" transition.current_slide") : ""
    const transitionTabs = {
        text: { id: "text", name: translateText("transition.text") + slideLabel, icon: "text" },
        media: { id: "media", name: translateText("transition.media") + slideLabel, icon: "image" }
    }
    const specificTabs = {
        in: { id: "in", name: translateText("transition.in"), icon: "down" },
        out: { id: "out", name: translateText("transition.out"), icon: "up" },
        between: { id: "between", name: translateText("transition.between"), icon: "arrow_forward" }
    }
    const specificTabsMedia = { in: specificTabs.in, out: specificTabs.out }
    const specificScenatios = initial.isItem || selectedType === "media" ? SPECIFIC_SCENARIOS.slice(0, 2) : [...SPECIFIC_SCENARIOS]

    const currentTextTransition = clone(initial.isItem ? slideItemTransition : initial.isSlide ? slideTextTransition : initial.isStyle ? styleTextTransition : transitionDataValue.text) as TransitionValue
    const currentMediaTransition = clone(initial.isSlide ? slideMediaTransition : initial.isStyle ? styleMediaTransition : transitionDataValue.media) as TransitionValue
    const currentTransitionFull = selectedType === "text" ? currentTextTransition : currentMediaTransition

    useEffect(() => {
        if (specificScenatios.find((a) => (currentTransitionFull as unknown as Record<string, unknown>)?.[a]) || showMore) setEnableSpecific(true)
        else {
            setSelectedSpecific(specificScenatios[0])
            setEnableSpecific(false)
        }
    }, [specificScenatios.join(","), showMore, JSON.stringify(currentTransitionFull)])

    let currentTransition = currentTransitionFull
    if (enableSpecific) currentTransition = (currentTransitionFull[selectedSpecific as keyof TransitionValue] as TransitionValue) || currentTransitionFull

    const isDisabled = currentTransition.type === "none"
    const durationValue = currentTransition.duration ?? 0.5
    const easingValue = currentTransition.easing ?? "sine"

    function updateSpecific(data: TransitionValue, key: TransitionKey, value: unknown, reset = false): TransitionValue {
        if (!enableSpecific) return { ...data, [key]: value } as TransitionValue

        let changeSpecific = [selectedSpecific]
        if (selectedSpecific === "in") {
            specificScenatios
                .filter((a) => a !== selectedSpecific)
                .forEach((sKey) => {
                    const current = (data as unknown as Record<string, unknown>)[sKey]
                    const specific = (data as unknown as Record<string, unknown>)[selectedSpecific]
                    if (!current || JSON.stringify(current) === JSON.stringify(specific)) changeSpecific.push(sKey)
                })
        }

        const next = clone(data) as unknown as Record<string, unknown>
        changeSpecific.forEach((sKey) => {
            if (reset) {
                delete next[sKey]
            } else {
                if (!next[sKey]) next[sKey] = copyTransition(data)
                ;(next[sKey] as unknown as Record<string, unknown>)[key] = value
            }
        })

        if (reset) return { ...next, [key]: value } as unknown as TransitionValue
        return next as unknown as TransitionValue
    }

    function copyTransition(data: TransitionValue) {
        let next: Record<string, unknown> = { type: data.type, duration: data.duration, easing: data.easing }
        if (data.delay) next.delay = data.delay
        return clone(next)
    }

    function changeTransition(id: TransitionTypes, key: TransitionKey, value: unknown, reset = false) {
        let nextValue: unknown = key === "duration" ? Number(value) : value

        if (initial.trigger) {
            nextValue = { ...styleTransition, [selectedType]: updateSpecific(styleTransition[selectedType] || {}, key, nextValue, reset) }
            initial.trigger(nextValue)
            return
        }

        if (initial.isItem) {
            const indexes = get(activeEdit).items
            nextValue = updateSpecific(slideItemTransition, key, nextValue, reset)
            const actions = initial.slideItems.map((item, i) => {
                if (!indexes.includes(i)) return item.actions as Record<string, unknown>
                if (!item.actions) item.actions = {}
                ;(item.actions as Record<string, unknown>).transition = nextValue as TransitionValue
                return item.actions as Record<string, unknown>
            })

            if (indexes.some((i) => !initial.slideItems[i])) return

            if (get(activeEdit).type === "overlay" || get(activeEdit).type === "template") {
                history({
                    id: "UPDATE",
                    oldData: { id: get(activeEdit).id },
                    newData: { key: "items", subkey: "actions", data: actions, indexes },
                    location: { page: "edit", id: `${get(activeEdit).type}_items`, override: `itemaction_${indexes.join(",")}` }
                })
                return
            }

            history({
                id: "setItems",
                newData: { style: { key: "actions", values: actions } },
                location: { page: "edit", show: get(activeShow)!, slide: initial.slideRef.id, items: indexes, override: `itemaction_${initial.slideRef.id}_items_${indexes.join(",")}` }
            })
        } else if (initial.isSlide) {
            const updated = updateSpecific(currentTransitionFull, key, nextValue, reset)
            const globalValues = transitionDataValue[id]
            let valueToSave: TransitionValue | undefined = updated
            if (updated.type === globalValues.type && updated.duration === globalValues.duration && updated.easing === globalValues.easing && !SPECIFIC_SCENARIOS.find((a) => (updated as unknown as Record<string, unknown>)[a])) valueToSave = undefined

            const type = id === "text" ? "transition" : "mediaTransition"
            const indexes = selectedValue.data.map((a) => a.index)
            const override = `show#${get(activeShow)?.id}layout#${_show().get("settings.activeLayout")}indexes#${indexes.join(",")}${type}`
            history({ id: "SHOW_LAYOUT", newData: { key: type, data: valueToSave, indexes }, location: { page: "show", override } })

            setTimeout(() => send(OUTPUT, ["SHOWS"], get(showsCache)), 500)
        } else if (initial.isStyle) {
            nextValue = { ...styleTransition, [selectedType]: updateSpecific(styleTransition[selectedType] || {}, key, nextValue, reset) }
            if (!stylesValue[initial.popupDataId]) return

            history({ id: "UPDATE", newData: { key: "transition", data: nextValue }, oldData: { id: initial.popupDataId }, location: { page: "settings", id: "settings_style", override: `style_${key}` } })
        } else {
            transitionData.update((a) => {
                a[id] = updateSpecific(a[id] as TransitionValue, key, nextValue, reset)
                return a
            })
        }
    }

    function reset() {
        const defaults = DEFAULT_TRANSITIONS[selectedType]
        Object.keys(defaults).forEach((key) => {
            const defaultValue = defaults[key as keyof typeof defaults]
            changeTransition(selectedType, key as TransitionKey, (transitionDataValue[selectedType] as unknown as Record<string, unknown>)?.[key] || defaultValue, true)
        })
    }

    const slideTypes = [
        { value: "left_right", label: translateText("edit.left_right") },
        { value: "right_left", label: translateText("edit.right_left") },
        { value: "bottom_top", label: translateText("edit.bottom_top") },
        { value: "top_bottom", label: translateText("edit.top_bottom") }
    ]
    const slideDirection = currentTransition.custom?.direction || slideTypes[0].value
    const getCorrectedDirection = (value: string) => {
        if (selectedSpecific === "out") {
            if (value === "left_right") return "right_left"
            if (value === "right_left") return "left_right"
            if (value === "bottom_top") return "top_bottom"
            if (value === "top_bottom") return "bottom_top"
        }
        return value
    }
    const correctedSlideDirection = getCorrectedDirection(slideDirection)

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            {showMore ? <Button className="popup-reset" icon="reset" iconSize={1.1} title="actions.reset" onClick={reset} white /> : null}

            {!initial.isItem ? <Tabs tabs={transitionTabs} active={selectedType} onActiveChange={(id) => setSelectedType(id as TransitionTypes)} style="font-weight: normal;" /> : null}

            {enableSpecific ? (
                <Tabs tabs={selectedType === "media" ? specificTabsMedia : specificTabs} active={selectedSpecific} onActiveChange={setSelectedSpecific} style="font-weight: normal;" />
            ) : showMore ? (
                <Button variant="outline" style={{ fontWeight: "normal" }} onClick={() => setEnableSpecific(true)}>
                    <T id="transition.specific" />
                </Button>
            ) : null}

            <div className={stylesModule.types}>
                {transitionTypes.map((type) => {
                    const isActive = type.id === currentTransition.type
                    return (
                        <Button key={type.id} showOutline={isActive} isActive={isActive} style={type.id === "none" ? { fontStyle: "italic" } : undefined} onClick={() => changeTransition(selectedType, "type", type.id)}>
                            <svg viewBox="0 0 100 100" width={`${iconSize}pt`} height={`${iconSize}pt`} dangerouslySetInnerHTML={{ __html: icons[type.id] || "" }} />
                            <T id={type.name} />
                        </Button>
                    )
                })}
            </div>

            {currentTransition.type === "slide" ? <SelectField label="transition.direction" style={{ marginBottom: "10px" }} options={slideTypes} value={correctedSlideDirection} onChange={(value) => changeTransition(selectedType, "custom", { ...(currentTransition.custom || {}), direction: getCorrectedDirection(value || slideTypes[0].value) })} /> : null}

            <InputRow>
                <NumberField label="transition.duration" disabled={isDisabled} value={durationValue / 1000} max={20} step={0.1} onChange={(value) => changeTransition(selectedType, "duration", Number(value) * 1000)} />
                <SelectField label="transition.easing" disabled={isDisabled} options={easings.map((a) => ({ ...a, label: translateText(a.label) }))} value={easingValue} onChange={(value) => changeTransition(selectedType, "easing", value)} />
            </InputRow>

            {showMore && selectedType === "text" ? <NumberField label="transition.fade_in_offset (%)" disabled={isDisabled} value={currentTransition?.fadeInOffset ?? 50} defaultValue={50} max={100} step={10} onChange={(value) => changeTransition(selectedType, "fadeInOffset", value)} /> : null}
        </>
    )
}
