import { useEffect } from "react"
import type { Writable } from "../../../shared/core/lib/store"
import type { Tag } from "../../../../types/Show"
import { keysToID, sortByName, sortObject } from "../../../shared/utils/helpers/array"
import { actions, actionTags, activeActionTagFilter, activeTimerTagFilter, activeVariableTagFilter, drawerTabsData, obsData, timerTags, timers, variableTags, variables } from "../../../shared/core/stores"
import { getAccess } from "../../../shared/utils/profile"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { NavigationSections, type NavCategory, type NavSection } from "./NavigationSections"

interface Access {
    global?: string
    [id: string]: string | undefined
}

// Port de components/drawer/navigation/FunctionsTabs.svelte
export function FunctionsTabs() {
    const actionsAccess = getAccess("actions") as Access
    const variablesAccess = getAccess("variables") as Access
    const timersAccess = getAccess("timers") as Access
    const scenesAccess = getAccess("scenes") as Access

    const actionsValue = useStore(actions)
    const actionTagsValue = useStore(actionTags)
    const actionFilter = useStore(activeActionTagFilter)
    const variablesValue = useStore(variables)
    const variableTagsValue = useStore(variableTags)
    const variableFilter = useStore(activeVariableTagFilter)
    const timersValue = useStore(timers)
    const timerTagsValue = useStore(timerTags)
    const timerFilter = useStore(activeTimerTagFilter)
    const drawerTabs = useStore(drawerTabsData)
    const obs = useStore(obsData)

    const activeSubTab = drawerTabs.functions?.activeSubTab || ""

    const visibleActionTags = sortObject(sortByName(keysToID(actionTagsValue)), "color").filter((a) => actionsAccess[a.id] !== "none")
    const visibleVariableTags = sortObject(sortByName(keysToID(variableTagsValue)), "color").filter((a) => variablesAccess[a.id] !== "none")
    const visibleTimerTags = sortObject(sortByName(keysToID(timerTagsValue)), "color").filter((a) => timersAccess[a.id] !== "none")

    const sortedActions = tagButtons(
        visibleActionTags,
        Object.values(actionsValue).map((a) => a?.tags || []),
        activeActionTagFilter,
        actionFilter
    )
    const sortedVariables = tagButtons(
        visibleVariableTags,
        Object.values(variablesValue).map((a) => a?.tags || []),
        activeVariableTagFilter,
        variableFilter
    )
    const sortedTimers = tagButtons(
        visibleTimerTags,
        Object.values(timersValue).map((a) => a?.tags || []),
        activeTimerTagFilter,
        timerFilter
    )

    useEffect(() => {
        if (actionFilter.length) activeActionTagFilter.set(actionFilter.filter((tagId) => visibleActionTags.some((tag) => tag.id === tagId)))
        if (variableFilter.length) activeVariableTagFilter.set(variableFilter.filter((tagId) => visibleVariableTags.some((tag) => tag.id === tagId)))
        if (timerFilter.length) activeTimerTagFilter.set(timerFilter.filter((tagId) => visibleTimerTags.some((tag) => tag.id === tagId)))
        // onMount: sólo sanea los filtros iniciales
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const sections: NavSection[] = [
        ...(actionsAccess.global === "none"
            ? []
            : [
                  [
                      {
                          id: "actions",
                          label: "tabs.actions",
                          icon: "actions",
                          openTrigger: () => activeActionTagFilter.set([]),
                          submenu: { options: sortedActions }
                      }
                  ]
              ]),
        ...(timersAccess.global === "none"
            ? []
            : [
                  [
                      {
                          id: "timer",
                          label: "tabs.timers",
                          icon: "timer",
                          openTrigger: () => activeTimerTagFilter.set([]),
                          submenu: { options: sortedTimers }
                      }
                  ]
              ]),
        ...(variablesAccess.global === "none"
            ? []
            : [
                  [
                      {
                          id: "variables",
                          label: "tabs.variables",
                          icon: "variable",
                          openTrigger: () => activeVariableTagFilter.set([]),
                          submenu: { options: sortedVariables }
                      }
                  ]
              ]),
        ...(scenesAccess.global === "none" ? [] : [[{ id: "scenes", label: "tabs.scenes", icon: "scene" }]]),

        [{ id: "interactions", label: "tabs.interactions", icon: "game" }],

        ...(obs.enabled ? [[{ id: "obs", label: "OBS Studio", icon: "player" }]] : [])
    ]

    return <NavigationSections sections={sections} active={activeSubTab} />
}

function tagButtons(visible: Array<Tag & { id: string }>, tagsOnly: string[][], filter: Writable<string[]>, activeFilter: string[]): NavCategory[] {
    return visible.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id: string, add?: boolean) => filter.set([...(add ? activeFilter : []), id]),
        count: tagsOnly.filter((b) => b.includes(a.id)).length
    }))
}
