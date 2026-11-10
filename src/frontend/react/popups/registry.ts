import type { ElementType } from "react"
import type { Popups } from "../../../types/Main"
import { KitDemoReact } from "./KitDemoReact"

// Popups que ya viven en React. Al migrar uno, sale del mapa `popups` de components/main/popupComponents.ts y entra acá (nunca en los dos).
export const reactPopups: Partial<Record<Popups, ElementType>> = {
    kit_demo_react: KitDemoReact
}
