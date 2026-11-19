import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { history } from "../../components/helpers/history"
import { activePopup, selected, shows } from "../../shared/core/stores"
import { setPopupSubmit } from "../../utils/popup"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"

// Port de components/main/popups/DeleteShow.svelte. Lee: selected.data (una vez, sin los shows bloqueados) y shows (nombres).
// Escribe (botón o Enter): history SHOWS { oldData: { data } } (es lo que borra los shows), selected = { id: null, data: [] } y activePopup = null.
// Cerrar sin confirmar (Esc, clic afuera, X) no escribe nada.
export function DeleteShow() {
    const showsValue = useStore(shows)
    const [showsToDelete] = useState(() => get(selected).data.filter((a) => !get(shows)[a.id]?.locked))

    function deleteSelected() {
        history({ id: "SHOWS", oldData: { data: showsToDelete }, location: { page: "drawer" } })

        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }

    useEffect(() => setPopupSubmit(deleteSelected), [])

    return (
        <>
            <p style={{ fontWeight: "bold" }}>
                <T id="popup.delete_show_confirmation" />:
            </p>

            <ul style={{ listStylePosition: "inside", marginBottom: "20px" }}>
                {showsToDelete.map((show, i) => (
                    <li key={i}>{showsValue[show.id]?.name}</li>
                ))}
            </ul>

            <Button variant="default" icon="delete" info={showsToDelete.length.toString()} onClick={deleteSelected} white>
                <T id="actions.delete" />
            </Button>
        </>
    )
}
