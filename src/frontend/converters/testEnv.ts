// Entorno mínimo para importar los conversores en vitest (entorno "node"): algunas dependencias de
// `components/helpers` (pdf.js, el DOM) esperan globales del navegador que acá no existen.
// Importar este archivo PRIMERO en cada test de conversor.

const globals = globalThis as any
globals.DOMMatrix ??= class DOMMatrix {}
globals.Path2D ??= class Path2D {}
globals.ImageData ??= class ImageData {}
globals.window ??= globals
globals.window.addEventListener ??= () => {}
globals.window.removeEventListener ??= () => {}
globals.document ??= { createElement: () => ({ style: {}, getContext: () => null }), addEventListener: () => {}, documentElement: { style: {} } }
globals.navigator ??= { userAgent: "node", language: "es-ES", platform: "test" }
for (const name of ["AudioWorkletNode", "AudioContext", "GainNode", "AnalyserNode", "AudioNode", "BiquadFilterNode", "HTMLElement", "HTMLMediaElement", "HTMLCanvasElement", "HTMLVideoElement", "Worker", "MutationObserver", "ResizeObserver", "IntersectionObserver", "Image", "Audio", "MediaStream"]) {
    globals[name] ??= class {}
}
globals.requestAnimationFrame ??= (callback: () => void) => setTimeout(callback, 0)
globals.CSS ??= { supports: () => false }
globals.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }

// los conversores XML usan `DOMParser` del navegador
const { DOMParser } = await import("linkedom")
globals.DOMParser ??= DOMParser

// en el navegador `Attr.nodeValue` es el valor del atributo; linkedom la deja en null y sólo expone `value`
const sampleAttr = new DOMParser().parseFromString('<a b="1"/>', "text/xml").documentElement?.attributes[0] as any
if (sampleAttr && sampleAttr.nodeValue == null) {
    Object.defineProperty(Object.getPrototypeOf(sampleAttr), "nodeValue", {
        get() {
            return this.value
        }
    })
}

// precarga: este orden de carga evita el ciclo de imports (components/edit/values/boxes ↔ helpers/array)
await import("../components/edit/scripts/itemHelpers")

export {}
