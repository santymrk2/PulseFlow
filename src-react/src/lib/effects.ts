// ----- FreeShow -----
// Efectos visuales animados (subconjunto del motor de `types/Effects.ts`).
// Cada efecto es una capa de partículas dibujada en canvas sobre la salida.

export type EffectType = "rain" | "snow" | "stars" | "bubbles" | "confetti" | "spotlight"

export interface EffectOption {
    id: EffectType
    label: string
}

export const EFFECT_TYPES: { id: EffectType; label: string }[] = [
    { id: "rain", label: "Lluvia" },
    { id: "snow", label: "Nieve" },
    { id: "stars", label: "Estrellas" },
    { id: "bubbles", label: "Burbujas" },
    { id: "confetti", label: "Confeti" },
    { id: "spotlight", label: "Foco" },
]

export interface Effect {
    id: string
    name: string
    type: EffectType
    color: string
    /** Número de partículas. */
    quantity: number
    /** Multiplicador de velocidad. */
    speed: number
}

export type Effects = Record<string, Effect>

export const DEFAULT_EFFECTS: Effects = {
    lluvia: { id: "lluvia", name: "Lluvia", type: "rain", color: "#7dd3fc", quantity: 220, speed: 1 },
    nieve: { id: "nieve", name: "Nieve", type: "snow", color: "#ffffff", quantity: 160, speed: 0.7 },
    estrellas: { id: "estrellas", name: "Estrellas", type: "stars", color: "#fef08a", quantity: 120, speed: 0.4 },
    burbujas: { id: "burbujas", name: "Burbujas", type: "bubbles", color: "#a5b4fc", quantity: 90, speed: 0.6 },
    confeti: { id: "confeti", name: "Confeti", type: "confetti", color: "#fb7185", quantity: 140, speed: 0.9 },
}
