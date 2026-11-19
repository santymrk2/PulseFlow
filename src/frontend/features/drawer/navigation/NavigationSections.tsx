import { Fragment, useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { translateText } from "../../../shared/utils/language"
import { activeActionTagFilter, activeDrawerTab, activeEdit, activeTimerTagFilter, activeVariableTagFilter, dictionary, drawerTabsData, labelsDisabled } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { DrawerTab } from "../DrawerTab"
import styles from "./NavigationSections.module.css"

// Port de components/drawer/navigation/NavigationSections.svelte.
// Los slots con nombre de Svelte pasan a props de React: section0 … section4.
export interface NavCategory {
    id: string
    label: string
    name?: string
    icon?: string | null
    count?: number
    hidden?: boolean
    color?: string
    boxedIcon?: boolean
    customIcon?: boolean
    readOnly?: boolean
    action?: string
    template?: string
    metadata?: string
    option?: { title: string; icon: string; style?: string } | null
    onDoubleClick?: () => void
    openTrigger?: (id: string, add?: boolean) => void
    submenu?: { options: NavCategory[] }
}

export type NavSectionItem = NavCategory | "SEPARATOR"
export type NavSection = NavSectionItem[]

export interface NavigationSectionsProps {
    sections: NavSectionItem[][]
    active: string
    onRename?: (detail: { id: string; value: string }) => void
    section0?: ReactNode
    section1?: ReactNode
    section2?: ReactNode
    section3?: ReactNode
    section4?: ReactNode
}

// El tipo exacto de `category` lo define el DrawerTab (otra tanda); se toma de su propia firma.
type DrawerTabCategory = ComponentProps<typeof DrawerTab>["category"]

function notATab(tab: NavSectionItem): boolean {
    if (tab === "SEPARATOR") return true
    return tab.id === "SEPARATOR" || tab.id === "TITLE"
}

export function NavigationSections({ sections, active, onRename, section0, section1, section2, section3, section4 }: NavigationSectionsProps) {
    const labelsOff = useStore(labelsDisabled)
    const dict = useStore(dictionary)
    const activeDrawer = useStore(activeDrawerTab)
    const edit = useStore(activeEdit)
    const [ready, setReady] = useState(false)

    // onMount: dar tiempo a las sub pestañas especiales (content providers) para cargar
    useEffect(() => {
        const timeout = setTimeout(() => setReady(true), 50)
        return () => clearTimeout(timeout)
    }, [])

    function setSubTab(tabId: string) {
        drawerTabsData.update((a) => {
            const next = { ...a }
            next[activeDrawer] = { activeSubTab: tabId, enabled: a[activeDrawer]?.enabled !== false }
            return next
        })
        // los submenús de tags se cierran al navegar con el teclado
        activeActionTagFilter.set([])
        activeVariableTagFilter.set([])
        activeTimerTagFilter.set([])
    }

    // `$: if (ready && sections.length && (!active || !sections.flat().find(...)))`
    useEffect(() => {
        if (!ready || !sections.length) return
        const flat = sections.flat()
        if (active && flat.some((item) => item !== "SEPARATOR" && item.id === active)) return

        const tabs = flat.filter((item): item is NavCategory => item !== "SEPARATOR" && item.id !== "SEPARATOR" && item.id !== "TITLE")
        if (tabs.length) setSubTab(tabs[0].id)
    }, [ready, sections, active, activeDrawer])

    // <svelte:window on:keydown> -> listener con cleanup
    useEffect(() => {
        function keydown(event: KeyboardEvent) {
            if (edit.items.length) return
            const target = event.target instanceof Element ? event.target : null
            if (target?.closest(".edit") || !(event.ctrlKey || event.metaKey)) return

            const flatSections = sections.flat().filter((item) => item === "SEPARATOR" || !item.hidden)

            if (event.key === "ArrowDown") {
                const index = flatSections.findIndex((item) => item !== "SEPARATOR" && item.id === active)
                let nextIndex = index + 1
                while (nextIndex < flatSections.length && notATab(flatSections[nextIndex])) nextIndex++

                if (nextIndex < flatSections.length) {
                    const next = flatSections[nextIndex]
                    if (next !== "SEPARATOR") setSubTab(next.id)
                }
            } else if (event.key === "ArrowUp") {
                const index = flatSections.findIndex((item) => item !== "SEPARATOR" && item.id === active)
                let nextIndex = index - 1
                while (nextIndex >= 0 && notATab(flatSections[nextIndex])) nextIndex--

                if (nextIndex >= 0) {
                    const next = flatSections[nextIndex]
                    if (next !== "SEPARATOR") setSubTab(next.id)
                }
            }
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [sections, active, edit.items.length, activeDrawer])

    function slotFor(index: number): ReactNode {
        if (index === 0) return section0
        if (index === 1) return section1
        if (index === 2) return section2
        if (index === 3) return section3
        if (index === 4) return section4
        return null
    }

    return (
        <div className={styles.tabSection}>
            {sections.map((buttons, index) => {
                const first = buttons[0]
                const firstHidden = first !== undefined && first !== "SEPARATOR" && first.hidden === true
                if (!(buttons.length > 1 || !firstHidden)) return null

                return (
                    <div key={index} className={styles.section}>
                        {buttons.length
                            ? buttons.map((category, categoryIndex) => {
                                  if (typeof category === "string") {
                                      return (
                                          <div key={`separator-${categoryIndex}`} className={styles.separator}>
                                              <hr className={styles.divider} />
                                          </div>
                                      )
                                  }

                                  if (category.id === "TITLE") {
                                      return (
                                          <Fragment key={`title-${categoryIndex}`}>
                                              <div className={styles.title}>{translateText(category.label, dict)}</div>
                                              {labelsOff ? <div className={styles.add_button}>{slotFor(index)}</div> : null}
                                          </Fragment>
                                      )
                                  }

                                  if (category.id === "SEPARATOR") {
                                      return (
                                          <div key={`separator-${categoryIndex}`} className={styles.separator}>
                                              {category.label ? <div className={styles.sepLabel}>{translateText(category.label, dict)}</div> : null}
                                              <hr className={styles.divider} />
                                          </div>
                                      )
                                  }

                                  if (category.hidden) return null

                                  return <DrawerTab key={category.id} category={category as unknown as DrawerTabCategory} active={active} onRename={onRename} />
                              })
                            : null}

                        {!labelsOff ? slotFor(index) : null}
                    </div>
                )
            })}
        </div>
    )
}
