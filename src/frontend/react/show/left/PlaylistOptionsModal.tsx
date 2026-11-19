import { getDefaultProjectName, getProjectName, projectReplacers } from "../../../shared/utils/helpers/historyHelpers"
import { special } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { TextField } from "../../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../../shared/ui/kit/toggle-field/ToggleField"
import { ModalBase } from "./ModalBase"
import styles from "./PlaylistOptionsModal.module.css"

// Port de components/show/left/PlaylistOptionsModal.svelte: modal completo, se monta directo
// (FULL_MODALS), así que la base (backdrop, tarjeta, header y cierre) vive en ModalBase.
function updateSpecial(value: string | boolean | null, key: string, allowEmpty = false) {
    special.update((a) => {
        const next = { ...a }
        if (!allowEmpty && !value) delete next[key]
        else next[key] = value
        return next
    })
}

export function PlaylistOptionsModal() {
    const specialValue = useStore(special)

    const projectName = specialValue.default_project_name ?? getDefaultProjectName()
    const replacerTitle = projectReplacers.map((a) => (a.id === "D0" ? "" : `• <b>${a.title}:</b> {${a.id}}`)).join("<br>")

    return (
        <ModalBase title="edit.options" width={520} height={260} lockOutsideClick={false}>
            <div className={styles.options}>
                <TextField label={`settings.default_project_name<span style='opacity: 0.5;padding-left: 8px;font-size: 0.8em;color: var(--text);'>${getProjectName("", specialValue)}</span>`} title={replacerTitle} value={projectName} defaultValue={getDefaultProjectName()} onChange={(value) => updateSpecial(value, "default_project_name", true)} />
                <ToggleField label="settings.startup_projects_list" checked={specialValue.startupProjectsList} defaultValue={false} onChange={(value) => updateSpecial(value, "startupProjectsList")} />
            </div>
        </ModalBase>
    )
}
