import { keysToID } from "../../../shared/utils/helpers/array"
import { activePopup, activeScripture, drawerTabsData, labelsDisabled, openScripture, scriptures } from "../../../shared/core/stores"
import type { BibleCategories } from "../../../../types/Tabs"
import { cn } from "../../../shared/core/lib/utils"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../hooks/useStore"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { NavigationSections, type NavCategory, type NavSection } from "./NavigationSections"
import styles from "./ScriptureTabs.module.css"

interface Access {
    global?: string
    [id: string]: string | undefined
}

// Port de components/drawer/navigation/ScriptureTabs.svelte
export function ScriptureTabs() {
    const readOnly = (getAccess("scripture") as Access).global === "read"

    const drawerTabs = useStore(drawerTabsData)
    const labelsOff = useStore(labelsDisabled)
    const scripture = useStore(activeScripture)
    const scripturesValue = useStore(scriptures)

    const activeSubTab = drawerTabs.scripture?.activeSubTab || ""
    const scripturesList = keysToID(scripturesValue)

    const collections = scripturesList.filter((a) => a.collection)
    const apiBibles = scripturesList.filter((a) => a.api)
    const localBibles = scripturesList.filter((a) => !a.collection && !a.api)
    const favoritesList = scripturesList.filter((a) => a.favorite)

    const spaced = apiBibles.length || localBibles.length

    const sections: NavSection[] = [...(favoritesList.length ? [[{ id: "TITLE", label: "category.favourites" }, ...convertToButton(favoritesList)]] : []), [{ id: "TITLE", label: "scripture.collections" }, ...convertToButton(collections)], [{ id: "TITLE", label: "scripture.bibles_section" }, ...convertToButton(localBibles), ...(localBibles.length && apiBibles.length ? [{ id: "SEPARATOR", label: "API" }] : []), ...convertToButton(apiBibles)]]

    function convertToButton(categories: Array<BibleCategories & { id: string }>): NavCategory[] {
        return categories
            .sort((a, b) => (b.customName || b.name).localeCompare(a.customName || a.name))
            .reverse()
            .map((a) => {
                const icon = a.api ? "scripture_alt" : a.collection ? "collection" : "scripture"
                const count = a.collection?.versions?.length || 0
                return { id: a.id, label: a.customName || a.name, icon, count, onDoubleClick: () => startScripture(), boxedIcon: true }
            })
    }

    function startScripture() {
        openScripture.set({
            play: true,
            book: Number(scripture.reference?.book || 1),
            chapter: scripture.reference?.chapters[0],
            verses: scripture.reference?.verses
        })
    }

    function newScripture() {
        activePopup.set("import_scripture")
    }

    function createCollection() {
        activePopup.set("create_collection")
    }

    function updateName({ id, value }: { id: string; value: string }) {
        scriptures.update((a) => {
            if (!a[id]) return a
            const next = { ...a }
            next[id] = { ...a[id], customName: value }
            return next
        })
    }

    const collectionButton = (disabled: boolean) => (
        <Button title="popup.import_scripture" variant="outline" disabled={disabled} onClick={createCollection} size="xs" className={styles.addButton}>
            <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
            {!labelsOff ? <T id="new.collection" /> : null}
        </Button>
    )
    const scriptureButton = (
        <Button title="popup.import_scripture" variant="outline" disabled={readOnly} onClick={newScripture} size="xs" className={styles.addButton}>
            <Icon id="add" size={labelsOff ? 0.9 : 1} white={labelsOff} />
            {!labelsOff ? <T id="new.scripture" /> : null}
        </Button>
    )

    return (
        <NavigationSections
            sections={sections}
            active={activeSubTab}
            onRename={updateName}
            section0={<div className={favoritesList.length ? undefined : cn(styles.slot, collections.length && styles.spaced)}>{!favoritesList.length ? collectionButton(readOnly || (!apiBibles.length && !localBibles.length)) : null}</div>}
            section1={<div className={cn(styles.slot, spaced && styles.spaced)}>{favoritesList.length ? collectionButton(readOnly || (!apiBibles.length && !localBibles.length)) : scriptureButton}</div>}
            section2={<div className={cn(styles.slot, spaced && styles.spaced)}>{favoritesList.length ? scriptureButton : null}</div>}
        />
    )
}
