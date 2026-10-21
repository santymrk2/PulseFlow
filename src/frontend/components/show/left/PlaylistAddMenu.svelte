<script lang="ts">
    // "+" de PLAYLISTS: crea lo que es de playlists (playlist, carpeta, desde plantilla,
    // plantilla nueva e importar). Lo de shows y bibliotecas vive en sus propios paneles.
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import Menu from "../../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../../lib/components/ui/menu/menu-separator.svelte"
    import { activeProject, activeRename, folders, projects, projectTemplates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getProjectName } from "../../helpers/historyHelpers"

    export let readOnly = false

    let open = false

    function run(action: () => void) {
        open = false
        action()
    }

    // nueva playlist/carpeta dentro de la carpeta de la playlist activa (o en la raíz)
    function currentParent() {
        const parent = $activeProject ? $projects[$activeProject]?.parent : ""
        return parent && $folders[parent] ? parent : "/"
    }

    const create = (folder = false) => history({ id: "UPDATE", newData: { replace: { parent: currentParent() } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })

    $: templates = sortByName(keysToID($projectTemplates)).filter((a) => !a.deleted)

    function fromTemplate(id: string) {
        const project = clone($projectTemplates[id])
        if (!project) return

        project.parent = currentParent()
        project.name = project.name?.includes("{") ? getProjectName(project.parent, { default_project_name: project.name }) : getProjectName(project.parent)

        const projectId = uid()
        history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        setTimeout(() => activeRename.set("project_" + projectId))
    }

    function newTemplate() {
        const id = uid()
        activeRename.set("project_" + id)
        history({ id: "UPDATE", newData: { data: { name: "", parent: "/", shows: [], created: 0 } }, oldData: { id }, location: { page: "show", id: "project_template" } })
    }

    function importProject() {
        sendMain(Main.IMPORT, { channel: "freeshow_project", format: { extensions: ["project", "shows", "json", "zip"], name: translateText("formats.project") } })
    }
</script>

<div class="anchor">
    <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="ui.new_playlist" disabled={readOnly} onclick={() => (open = !open)} />
    <Menu {open} onclose={() => (open = false)}>
        <MenuItem onclick={() => run(() => create())}>{translateText("new.project")}</MenuItem>
        <MenuItem onclick={() => run(() => create(true))}>{translateText("new.folder")}</MenuItem>
        {#if templates.length}
            <MenuSeparator />
            {#each templates as template (template.id)}
                <MenuItem onclick={() => run(() => fromTemplate(template.id))}>{template.name}</MenuItem>
            {/each}
        {/if}
        <MenuSeparator />
        <MenuItem onclick={() => run(newTemplate)}>{translateText("actions.project_template")}</MenuItem>
        <MenuItem onclick={() => run(importProject)}>{translateText("actions.import")}</MenuItem>
    </Menu>
</div>

<style>
    .anchor {
        position: relative;
        display: flex;
    }
</style>
