import { useState, type KeyboardEvent } from "react"
import { actions, activeProject, editingProjectTemplate, projects, projectTemplates, special } from "../../shared/core/stores"
import { getActionIcon, runAction } from "../../components/actions/actions"
import { keysToID, sortByName } from "../../shared/utils/helpers/array"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../../shared/ui/helpers/Icon"
import { Tip } from "../../react/main/Tip"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { Title } from "../../shared/ui/kit/title/Title"
import { Button } from "../../shared/ui/kit/button/Button"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TimeField } from "../../shared/ui/kit/time-field/TimeField"
import { Input } from "../../shared/ui/kit/input/Input"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Notes } from "./tools/Notes"
import styles from "./Section.module.css"

export interface SectionProps {
    section: {
        id?: string
        index?: number
        name?: string
        notes?: string
        color?: string
        data?: { time?: string; settings?: { triggerAction?: string } }
    }
}

interface ActionData {
    id?: string
    name?: string
}

interface ProjectShow {
    id?: string
    name?: string
    notes?: string
    color?: string
    data?: { time?: string; settings?: { triggerAction?: string } } & Record<string, unknown>
}

interface ProjectData {
    shows?: ProjectShow[]
    sectionsLocked?: boolean
    modified?: number
}

// (F24.20a).
export function Section({ section }: SectionProps) {
    const currentActions = useStore(actions)
    const currentActiveProject = useStore(activeProject)
    const currentEditingTemplate = useStore(editingProjectTemplate)
    const currentProjects = useStore(projects)
    const currentTemplates = useStore(projectTemplates)
    const currentSpecial = useStore(special)
    const [settingsOpened, setSettingsOpened] = useState(false)

    const isTemplate = !!currentEditingTemplate
    const projectId = isTemplate ? currentEditingTemplate : currentActiveProject
    const projectStore = isTemplate ? projectTemplates : projects
    const currentProject = (isTemplate ? currentTemplates[projectId || ""] : currentProjects[projectId || ""]) as unknown as ProjectData
    const sectionIndex = section.index ?? -1
    const sectionUpdated = (currentProject?.shows?.[sectionIndex] || section) as ProjectShow
    const isLocked = !!currentProject?.sectionsLocked

    const note = sectionUpdated?.notes || ""
    const actionOptions = sortByName(keysToID(currentActions)).map((action) => ({ value: action.id || "", label: action.name || "" }))
    const localAction = currentProject?.shows?.[sectionIndex]?.data?.settings?.triggerAction || ""
    const currentActionId = localAction || currentSpecial.sectionTriggerAction
    const currentAction = (currentActionId ? { ...(currentActions[currentActionId] as ActionData), id: currentActionId } : null) as ActionData & { id: string }

    function updateProject(update: (project: ProjectData) => ProjectData) {
        if (!projectId) return
        projectStore.update((all) => {
            const project = all[projectId] as unknown as ProjectData
            if (!project?.shows) return all
            const next = update(project)
            next.modified = Date.now()
            ;(all as unknown as Record<string, ProjectData>)[projectId] = next as never
            return all
        })
    }

    function edit(value: string) {
        if (section.notes === value || !projectId) return
        updateProject((project) => {
            const shows = [...(project.shows || [])]
            const index = shows.findIndex((item) => item.id === section.id)
            if (index >= 0) shows[index] = { ...shows[index], notes: value }
            return { ...project, shows }
        })
    }

    function updateSection(key: string, value: unknown) {
        if (!projectId) return
        updateProject((project) => {
            const shows = [...(project.shows || [])]
            const index = shows.findIndex((item) => item.id === section.id)
            if (index >= 0) shows[index] = { ...shows[index], [key]: value }
            return { ...project, shows }
        })
    }

    function updateSectionData(key: string, value: unknown) {
        if (!projectId) return
        updateProject((project) => {
            const shows = [...(project.shows || [])]
            const current = shows[sectionIndex]
            if (!current) return project
            shows[sectionIndex] = { ...current, data: { ...(current.data || {}), [key]: value } }
            return { ...project, shows }
        })
    }

    function updateName(event: { currentTarget: { value: string } }) {
        updateSection("name", event.currentTarget.value || "")
    }

    function keydown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== "Enter") return
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }

    function updateTrigger(value: string | null) {
        if (!value) return
        special.update((state) => {
            state.sectionTriggerAction = value
            return state
        })
    }

    function updateTriggerLocal(value: string | null) {
        updateSectionData("settings", { triggerAction: value || "" })
    }

    function settings() {
        return (
            <div className={styles.settings}>
                <Title label="popup.action" icon="actions" />
                <Tip type="info" value="settings.section_trigger_action" style="justify-content: left;" bottom={10} />
                <InputRow>
                    <SelectField label="groups.global" disabled={!!localAction && !!currentActions[localAction]} options={actionOptions} value={currentSpecial.sectionTriggerAction || ""} onChange={updateTrigger} allowEmpty />
                    <SelectField label="groups.current" options={actionOptions} value={localAction} onChange={updateTriggerLocal} allowEmpty />
                </InputRow>
            </div>
        )
    }

    function content() {
        return (
            <>
                <InputRow>
                    <h4 id="sectionTitle" className={`${!sectionUpdated?.name ? styles.empty : ""} ${styles.title}`} style={{ flex: 6, borderBottom: `1.2px solid ${sectionUpdated.color || "var(--primary-lighter)"}` }}>
                        <Input value={sectionUpdated?.name || ""} placeholder={translateText("main.unnamed")} disabled={isLocked} onInput={updateName} onKeyDown={keydown} />
                    </h4>
                    <TimeField label="calendar.time" value={sectionUpdated?.data?.time || ""} disabled={isLocked} style={{ flex: 1, height: "100%" }} onChange={(value) => updateSectionData("time", value || "")} />
                </InputRow>
                <Notes value={note} disabled={isLocked} onEdit={edit} />
            </>
        )
    }

    return (
        <>
            {settingsOpened ? settings() : <div key={section.id}>{content()}</div>}
            {currentAction && !settingsOpened ? (
                <FloatingBar side="left" onlyOne>
                    <Button title="actions.run_action" onClick={() => runAction(currentAction as never, { source: "section" })}>
                        <Icon id={getActionIcon(currentActionId)} />
                        {currentAction.name}
                    </Button>
                </FloatingBar>
            ) : null}
            <FloatingBar round>
                <Button isActive={settingsOpened} title="menu.settings" onClick={() => setSettingsOpened(!settingsOpened)}>
                    <Icon size={1.1} id="options" white={!settingsOpened} />
                </Button>
            </FloatingBar>
        </>
    )
}
