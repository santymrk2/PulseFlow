// Port del action `observeResize` de Zoomed.svelte (F24.18b): un único ResizeObserver compartido.
const sharedCallbacks = new WeakMap<Element, (rect: DOMRectReadOnly) => void>()
let sharedObserver: ResizeObserver | null = null

export interface ResizeObservation {
    destroy(): void
}

export function observeResize(node: Element, cb: (rect: DOMRectReadOnly) => void): ResizeObservation {
    let prevWidth = 0
    let prevHeight = 0

    if (!sharedObserver && typeof ResizeObserver !== "undefined") {
        sharedObserver = new ResizeObserver((entries) => {
            for (const entry of entries) sharedCallbacks.get(entry.target)?.(entry.contentRect)
        })
    }

    sharedCallbacks.set(node, (rect) => {
        if (prevWidth !== rect.width || prevHeight !== rect.height) {
            prevWidth = rect.width
            prevHeight = rect.height
            cb(rect)
        }
    })
    sharedObserver?.observe(node)
    return {
        destroy() {
            sharedCallbacks.delete(node)
            sharedObserver?.unobserve(node)
        }
    }
}
