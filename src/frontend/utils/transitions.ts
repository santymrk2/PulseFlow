import type { TransitionType } from "./../../types/Show"
import type { API_transition } from "../components/actions/api"
import { transitionData } from "../stores"

export const transitionTypes: { id: TransitionType; name: string }[] = [
    { id: "none", name: "transition.none" },
    { id: "fade", name: "transition.fade" },
    { id: "blur", name: "transition.blur" },
    { id: "spin", name: "transition.spin" },
    { id: "scale", name: "transition.scale" },
    { id: "slide", name: "transition.slide" }
]

interface TransitionEffect {
    delay?: number
    duration?: number
    easing?: (t: number) => number
    css?: (t: number) => string
}
interface TransitionOptions {
    opacity?: number
    amount?: number
    x?: number
    y?: number
    start?: number
    direction?: string
    [key: string]: unknown
}
interface CustomTransitionData {
    type?: TransitionType
    duration?: number
    easing?: string
    delay?: number
    custom?: TransitionOptions
}
interface EasingOption {
    value: string
    label: string
    function: (t: number) => number
}
type TransitionFn = (node: HTMLElement, data?: TransitionOptions) => TransitionEffect

const linear = (t: number) => t
const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const cubicInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const circInOut = (t: number) => (t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2)
const backInOut = (t: number) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
}
const elasticInOut = (t: number) => {
    const c4 = (2 * Math.PI) / 3
    if (t === 0 || t === 1) return t
    if (t < 0.5) return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c4)) / 2
    return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c4)) / 2 + 1
}
const bounceOut = (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75
    if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375
    return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375
}
const bounceInOut = (t: number) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2)

function opacityOf(node: HTMLElement): number {
    const value = typeof getComputedStyle === "function" ? Number(getComputedStyle(node).opacity) : 1
    return Number.isFinite(value) ? value : 1
}
function transformOf(node: HTMLElement): string {
    if (typeof getComputedStyle !== "function") return ""
    const value = getComputedStyle(node).transform
    return value && value !== "none" ? value : ""
}

const fade: TransitionFn = (node) => {
    const o = opacityOf(node)
    return { css: (t) => `opacity: ${t * o}` }
}

const blur: TransitionFn = (node, data = {}) => {
    const o = opacityOf(node)
    const amount = typeof data.amount === "number" ? data.amount : 5
    const filter = typeof getComputedStyle === "function" ? getComputedStyle(node).filter : ""
    const current = filter && filter !== "none" ? filter : ""
    return { css: (t) => `opacity: ${t * o}; filter: blur(${(1 - t) * amount}px) ${current}` }
}

const fly: TransitionFn = (node, data = {}) => {
    const o = opacityOf(node)
    const transform = transformOf(node)
    const x = typeof data.x === "number" ? data.x : 0
    const y = typeof data.y === "number" ? data.y : 0
    return { css: (t) => `transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px); opacity: ${t * o}` }
}

const scale: TransitionFn = (node, data = {}) => {
    const o = opacityOf(node)
    const transform = transformOf(node)
    const start = typeof data.start === "number" ? data.start : 0
    return { css: (t) => `transform: ${transform} scale(${start + (1 - start) * t}); opacity: ${t * o}` }
}

// El `crossfade` de Svelte es una fábrica de `send`/`receive` y no se usa en la UI (está fuera de transitionTypes).
const crossfade: TransitionFn = () => ({ css: () => "" })

export const transitions: { [key in TransitionType]: TransitionFn } = {
    none: fade,
    blur,
    fade,
    crossfade,
    fly,
    scale,
    slide: (_node, data = {}) => {
        return {
            css: (t: number) => {
                const direction = typeof data.direction === "string" ? data.direction : "left_right"
                const pos = (1 - t) * 100
                if (direction === "left_right") return `transform: translate(-${pos}%)`
                if (direction === "right_left") return `transform: translate(${pos}%)`
                if (direction === "bottom_top") return `transform: translateY(${pos}%)`
                if (direction === "top_bottom") return `transform: translateY(-${pos}%)`
                return ""
            }
        }
    },
    spin: (node) => {
        const o = opacityOf(node)
        return { css: (t: number) => `opacity: ${t * o}; transform: rotate(${t * 360}deg)` }
    }
}

export const easings: EasingOption[] = [
    { value: "linear", label: "easings.linear", function: linear },
    { value: "back", label: "easings.back", function: backInOut },
    { value: "sine", label: "easings.sine", function: sineInOut },
    { value: "circ", label: "easings.circ", function: circInOut },
    { value: "cubic", label: "easings.cubic", function: cubicInOut },
    { value: "elastic", label: "easings.elastic", function: elasticInOut },
    { value: "bounce", label: "easings.bounce", function: bounceInOut }
]

export function custom(node: HTMLElement, data: CustomTransitionData = {}): TransitionEffect {
    const type = data.type ?? "fade"
    const duration = data.duration ?? 500
    const easing = data.easing ?? "sine"
    const delay = data.delay ?? 0
    return {
        ...transitions[type](node, data.custom),
        duration: type === "none" ? 0 : duration,
        easing: easings.find((a) => a.value === easing)?.function || linear,
        delay
    }
}

export function updateTransition(data: API_transition) {
    transitionData.update((a) => {
        a[data.id || "text"] = {
            type: data.type || "fade",
            duration: data.duration ?? 500,
            easing: data.easing || "sine"
        }
        return a
    })
}
