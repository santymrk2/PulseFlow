import { drawerTabsData, effects, overlays } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { history } from "../../components/helpers/history"
import { Overlays } from "../drawer/pages/Overlays"
import { useStore } from "../hooks/useStore"
import { LeftPanel } from "../show/left/LeftPanel"
import { Button } from "../ui/button/Button"
import { CategoryPicker } from "./CategoryPicker"

export function OverlayNavigation() {
    const currentDrawerTabsData = useStore(drawerTabsData)
    const currentEffects = useStore(effects)
    const currentOverlays = useStore(overlays)

    const profile = getAccess("overlays")
    const readOnly = profile.global === "read"

    const active = currentDrawerTabsData.overlays?.activeSubTab || "all"
    const isEffects = active === "effects"
    const count = isEffects ? Object.keys(currentEffects).length : Object.values(currentOverlays).filter((a) => a && profile[(a as { category?: string }).category || ""] !== "none").length

    const add = () => history({ id: "UPDATE", location: { page: "drawer", id: isEffects ? "effect" : "overlay" } })

    return (
        <LeftPanel title={translateText(isEffects ? "tabs.effects" : "tabs.overlays")} count={count} actions={<Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title={isEffects ? "new.effect" : "new.overlay"} disabled={readOnly} onClick={add} />}>
            <CategoryPicker kind="overlays" extraOptions={[{ value: "effects", label: translateText("tabs.effects") }]} />
            <div style={{ height: "calc(100% - 62px)" }}>
                <Overlays active={active} columns={1} editOnClick />
            </div>
        </LeftPanel>
    )
}
