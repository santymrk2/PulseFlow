import { useEffect, useState } from "react"
import { keysToID, sortObject } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { categories, drawerTabsData, labelsDisabled, shows } from "../../../shared/core/stores"
import type { TrimmedShow } from "../../../../types/Show"
import type { Category } from "../../../../types/Tabs"
import { hasNewerUpdate } from "../../../shared/utils/common"
import { getAccess } from "../../../shared/utils/profile"
import { cn } from "../../../shared/core/lib/utils"
import { useStore } from "../../hooks/useStore"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { NavigationSections, type NavCategory, type NavSection } from "./NavigationSections"
import styles from "./ShowsTabs.module.css"

interface Access {
    global?: string
    [id: string]: string | undefined
}

// Port de components/drawer/navigation/ShowsTabs.svelte
export function ShowsTabs() {
    const profile = (getAccess("shows") as Access) || {}
    const readOnly = profile.global === "read"

    const categoriesValue = useStore(categories)
    const drawerTabs = useStore(drawerTabsData)
    const labelsOff = useStore(labelsDisabled)
    const showsValue = useStore(shows)
    const [currentShows, setCurrentShows] = useState<TrimmedShow[]>([])

    const activeSubTab = drawerTabs.shows?.activeSubTab || ""

    useEffect(() => {
        let cancelled = false
        async function updateShows() {
            if (await hasNewerUpdate("SHOWS_TABS", 200)) return
            if (!cancelled) setCurrentShows(Object.values(showsValue))
        }
        updateShows()
        return () => {
            cancelled = true
        }
    }, [showsValue])

    const categoriesList = keysToID(categoriesValue)
    const unarchivedCategoriesList = categoriesList.filter((a) => !a.isArchive && profile[a.id] !== "none")
    const archivedCategoriesList = categoriesList.filter((a) => a.isArchive)

    const allVisibleShows = currentShows.filter((a) => a && !a.private && profile[a.category || ""] !== "none")
    const unarchivedShows = allVisibleShows.filter((a) => a.category === null || !categoriesValue[a.category]?.isArchive)
    const uncategorizedShowsLength = unarchivedShows.filter((a) => a.category === null || !categoriesValue[a.category]).length

    const sections: NavSection[] = [
        [
            { id: "all", label: "category.all", icon: "all", count: unarchivedShows.length },
            {
                id: "unlabeled",
                label: "category.unlabeled",
                icon: "noIcon",
                count: uncategorizedShowsLength,
                hidden: !uncategorizedShowsLength && activeSubTab !== "unlabeled"
            }
        ],
        [{ id: "TITLE", label: "guide_title.categories" }, ...convertToButton(unarchivedCategoriesList), ...(archivedCategoriesList.length ? [{ id: "SEPARATOR", label: "actions.archive_title" }, ...convertToButton(archivedCategoriesList)] : [])]
    ]

    function convertToButton(items: Array<Category & { id: string }>): NavCategory[] {
        return sortObject(items, "name").map((a) => {
            const metadata = a.metadata?.display
            const count = allVisibleShows.reduce((acc, show) => acc + (show.category === a.id ? 1 : 0), 0)
            const itemReadOnly = profile.global === "read" || profile[a.id] === "read"
            return {
                id: a.id,
                label: a.name,
                icon: a.icon,
                action: a.action,
                template: a.template,
                metadata,
                count,
                readOnly: itemReadOnly,
                customIcon: true,
                boxedIcon: true
            }
        })
    }

    function newCategory() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    }

    function updateName({ id, value }: { id: string; value: string }) {
        categories.update((a) => {
            const category = a[id]
            if (!category) return a
            const next = { ...a }
            const entry = { ...category }
            delete entry.default
            entry.name = value
            next[id] = entry
            return next
        })
    }

    return (
        <NavigationSections
            sections={sections}
            active={activeSubTab}
            onRename={updateName}
            section1={
                <div className={cn(styles.slot, categoriesList.length && styles.spaced)}>
                    <Button title="new.category" variant="outline" disabled={readOnly} onClick={newCategory} size="xs" className={styles.addButton}>
                        <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
                        {!labelsOff ? <T id="new.category" /> : null}
                    </Button>
                </div>
            }
        />
    )
}
