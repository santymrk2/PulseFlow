<script lang="ts">
    // Opciones de playlists (antes colgaban del encabezado de `Projects.svelte`):
    // nombre por defecto de las playlists nuevas y abrir la lista al iniciar.
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"
    import ToggleField from "../../../lib/components/ui/toggle-field/toggle-field.svelte"
    import { special } from "../../../stores"
    import { getDefaultProjectName, getProjectName, projectReplacers } from "../../helpers/historyHelpers"
    import Modal from "../../main/Modal.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    $: projectName = $special.default_project_name ?? getDefaultProjectName()

    const replacerTitle = projectReplacers.map((a) => (a.id === "D0" ? "" : `• <b>${a.title}:</b> {${a.id}}`)).join("<br>")
</script>

<Modal title="edit.options" width={520} height={260} lockOutsideClick={false}>
    <div class="options">
        <TextField label="settings.default_project_name<span style='opacity: 0.5;padding-left: 8px;font-size: 0.8em;color: var(--text);'>{getProjectName('', $special)}</span>" title={replacerTitle} value={projectName} defaultValue={getDefaultProjectName()} on:change={(e) => updateSpecial(e.detail, "default_project_name", true)} />
        <ToggleField label="settings.startup_projects_list" checked={$special.startupProjectsList} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "startupProjectsList")} />
    </div>
</Modal>

<style>
    .options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
    }
</style>
