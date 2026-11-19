import type { TopViews } from "../../../types/Tabs"
import { activeEdit, activePage, activeShow, dictionary, editHistory, shows, special } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { Button } from "../ui/button/Button"

export interface TopButtonProps {
    id: TopViews
    disabled?: boolean
}

const keys: Partial<Record<TopViews, number>> = { show: 1, edit: 2, stage: 3 }

export function TopButton({ id, disabled = false }: TopButtonProps) {
    const page = useStore(activePage)
    const currentEdit = useStore(activeEdit)
    const currentShow = useStore(activeShow)
    const history = useStore(editHistory)
    const showsValue = useStore(shows)
    const specialValue = useStore(special)
    const dict = useStore(dictionary)

    const isActive = page === id

    function openPage() {
        activePage.set(id)
        if (id === "edit") openActiveShow()
    }

    function openActiveShow() {
        const showIsActive = currentShow && (currentShow.type || "show") === "show"
        const noEditSlide = currentEdit.slide === null || currentEdit.slide === undefined
        if (showIsActive && !currentEdit.id) openEdit()
        else if (showIsActive && noEditSlide) updateEditItem()
        else if (showIsActive && currentEdit.showId && currentEdit.showId !== currentShow?.id) openEdit()

        function updateEditItem() {
            return
        }

        function openEdit() {
            activeEdit.set({ slide: currentEdit.slide || 0, items: [], showId: currentShow?.id })
        }
    }

    void history
    void showsValue

    return (
        <Button
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            data-title={translateText(`menu._title_${id}${specialValue.numberKeys ? "" : ` [${keys[id]}]`}`, dict)}
            aria-current={isActive ? "page" : undefined}
            disabled={disabled}
            onClick={() => openPage()}
        >
            <Icon id={id} size={1} white />
        </Button>
    )
}
