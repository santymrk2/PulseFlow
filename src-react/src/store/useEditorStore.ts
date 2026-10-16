// ----- FreeShow -----
// Estado de edición de items (cajas de contenido) del editor. Guarda qué item
// está activo en la diapositiva seleccionada, para que el panel "Elemento"
// aplique cambios sobre el item correcto. Es estado de UI (no se persiste).

import { create } from "zustand"

interface EditorState {
    /** Id de la diapositiva a la que pertenece la selección actual. */
    slideId: string | null
    /** Índice del item activo dentro de la diapositiva (o `null`). */
    itemIndex: number | null
    /** Selecciona un item de una diapositiva concreta. */
    selectItem: (slideId: string | null, index: number | null) => void
    /** Limpia la selección (al cambiar de diapositiva o al salir del editor). */
    clear: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
    slideId: null,
    itemIndex: null,
    selectItem: (slideId, itemIndex) => set({ slideId, itemIndex }),
    clear: () => set({ slideId: null, itemIndex: null }),
}))

/** Devuelve el índice activo sólo si pertenece a la diapositiva indicada. */
export function activeItemFor(slideId: string | null): number | null {
    const { slideId: current, itemIndex } = useEditorStore.getState()
    if (!slideId || slideId !== current) return null
    return itemIndex
}
