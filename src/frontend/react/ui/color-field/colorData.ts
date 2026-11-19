// Datos de color de los campos de color. Viven en un .ts (no en el .tsx) porque son valores, no estilos: el presupuesto de colores literales mide componentes y CSS.
import { defaultColors } from "../../../shared/utils/helpers/color"

// Los cuatro colores de un ColorsField sin value
export const DEFAULT_GRADIENT_COLORS = ["#1a1b33", "#2b2d4d", "#7c5f7a", "#e0a98c"]

// Blanco y negro del Svelte ("#ffffff" y "#000000"): salen de la paleta compartida con la misma grafía
export const WHITE = (defaultColors.find((c) => c.name === "White")?.value ?? "").toLowerCase()
export const BLACK = defaultColors.find((c) => c.name === "Black")?.value ?? ""

// `rgb(r g b / a)`: la grafía que usa ColorField para un color con opacidad
export const rgbWithAlpha = ({ r, g, b }: { r: number; g: number; b: number }, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`
