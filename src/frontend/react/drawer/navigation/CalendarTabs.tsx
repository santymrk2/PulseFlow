import { activePopup, drawerTabsData, labelsDisabled } from "../../../shared/core/stores"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { Button } from "../../../shared/ui/kit/button/Button"
import { NavigationSections, type NavSection } from "./NavigationSections"
import styles from "./CalendarTabs.module.css"

interface Access {
    global?: string
    [id: string]: string | undefined
}

// Port de components/drawer/navigation/CalendarTabs.svelte
export function CalendarTabs() {
    const readOnly = (getAccess("calendar") as Access).global === "read"

    const drawerTabs = useStore(drawerTabsData)
    const labelsOff = useStore(labelsDisabled)
    const activeSubTab = drawerTabs.calendar?.activeSubTab || ""

    const sections: NavSection[] = [
        [
            // show title to show add icon
            ...(labelsOff ? [{ id: "TITLE", label: "tabs.calendar" }] : []),
            { id: "event", label: "menu._title_calendar", icon: "calendar" },
            { id: "action", label: "calendar.schedule_action", icon: "actions" }
        ]
    ]

    function importCalendar() {
        activePopup.set("import_calendar")
    }

    return (
        <NavigationSections
            sections={sections}
            active={activeSubTab}
            section0={
                <div className={styles.slot}>
                    <Button title="actions.import_calendar" variant="outline" disabled={readOnly} onClick={importCalendar} size="xs" className={styles.addButton}>
                        <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
                        {!labelsOff ? <T id="actions.import_calendar" /> : null}
                    </Button>
                </div>
            }
        />
    )
}
