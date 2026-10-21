<script lang="ts">
    // "⋯" de ÍTEMS cuando la fuente es una playlist: lo que antes colgaba del encabezado de
    // `Projects.svelte` (exportar, enlace, línea de tiempo, secciones, OnStage).
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import Menu from "../../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../../lib/components/ui/menu/menu-separator.svelte"
    import { contentProviderData, projects, providerConnections, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { exportProject } from "../../export/project"
    import { shareProjectLink } from "../../export/projectLink"

    export let projectId: string

    let open = false
    const run = (action: () => void) => {
        open = false
        action()
    }

    $: project = $projects[projectId]
    $: isOnStage = !!$providerConnections.onstage && (project?.origin === "onstage" || projectId.startsWith("onstage_"))
    $: hasSections = !!project?.shows?.some((a) => a.type === "section")

    function update(key: string, value: any) {
        projects.update((a) => {
            if (a[projectId]) a[projectId][key] = value
            return a
        })
    }

    const syncOnStage = () => sendMain(Main.ONSTAGE_LOAD_SERVICE, { serviceId: projectId.replace("onstage_", ""), data: $contentProviderData.onstage })
</script>

{#if project}
    <div class="anchor">
        <Button variant="ghost" size="icon-sm" icon="more" iconSize={0.9} title="create_show.more_options" onclick={() => (open = !open)} />
        <Menu {open} onclose={() => (open = false)}>
            {#if isOnStage}
                <MenuItem onclick={() => run(syncOnStage)}>{translateText("cloud.sync")}</MenuItem>
                <MenuSeparator />
            {/if}
            {#if project.sourcePath}
                <MenuItem onclick={() => run(() => exportProject(project, projectId, project.sourcePath))}>{translateText("actions.save_to_file")}</MenuItem>
            {/if}
            <MenuItem onclick={() => run(() => exportProject(project, projectId))}>{translateText("actions.export")}</MenuItem>
            <MenuItem onclick={() => run(() => shareProjectLink(project, projectId))}>{translateText("export.data_link")}</MenuItem>
            <MenuSeparator />
            <MenuItem onclick={() => run(() => special.update((a) => ({ ...a, projectTimelineActive: !a.projectTimelineActive })))}>{translateText("timeline.toggle_timeline")}{$special.projectTimelineActive ? " ✓" : ""}</MenuItem>
            {#if hasSections}
                <MenuSeparator />
                <MenuItem onclick={() => run(() => update("sectionsCollapsed", !project.sectionsCollapsed))}>{translateText("actions.collapsed")}{project.sectionsCollapsed ? " ✓" : ""}</MenuItem>
                <MenuItem onclick={() => run(() => update("sectionsLocked", !project.sectionsLocked))}>{translateText("actions.lock_sections")}{project.sectionsLocked ? " ✓" : ""}</MenuItem>
            {/if}
        </Menu>
    </div>
{/if}

<style>
    .anchor {
        position: relative;
        display: flex;
    }
</style>
