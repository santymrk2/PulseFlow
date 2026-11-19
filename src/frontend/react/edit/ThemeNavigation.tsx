import { drawerTabsData, templates } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { history } from "../../shared/utils/helpers/history"
import { Templates } from "../drawer/pages/Templates"
import { useStore } from "../../shared/ui/hooks/useStore"
import { LeftPanel } from "../show/left/LeftPanel"
import { Button } from "../../shared/ui/kit/button/Button"
import { CategoryPicker } from "./CategoryPicker"

export function ThemeNavigation() {
    const currentDrawerTabsData = useStore(drawerTabsData)
    const currentTemplates = useStore(templates)

    const profile = getAccess("templates")
    const readOnly = profile.global === "read"

    const active = currentDrawerTabsData.templates?.activeSubTab || "all"
    const visibleTemplates = Object.values(currentTemplates).filter((a) => a && profile[(a as { category?: string }).category || ""] !== "none" && (a as { settings?: { mode?: string } })?.settings?.mode !== "text")

    const newTemplate = () => history({ id: "UPDATE", location: { page: "drawer", id: "template" } })

    return (
        <LeftPanel title={translateText("tabs.templates")} count={visibleTemplates.length} actions={<Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="new.template" disabled={readOnly} onClick={newTemplate} />}>
            <CategoryPicker kind="templates" />
            <div style={{ height: "calc(100% - 62px)" }}>
                <Templates active={active} columns={1} editOnClick />
            </div>
        </LeftPanel>
    )
}
