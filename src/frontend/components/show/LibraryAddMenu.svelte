<script lang="ts">
    // "+" de LIBRARY (F14.11): lo único que hace falta para crear shows, categorías y playlists.
    import Button from "../../lib/components/ui/button/button.svelte"
    import Menu from "../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../lib/components/ui/menu/menu-separator.svelte"
    import { activePopup } from "../../stores"
    import { translateText } from "../../utils/language"
    import { openDrawer } from "../edit/scripts/edit"
    import { history } from "../helpers/history"

    let open = false

    function run(action: () => void) {
        open = false
        action()
    }

    const newShow = () => activePopup.set("show")

    // la categoría se nombra en la lista del cajón: hay que abrirlo en la pestaña de shows
    function newCategory() {
        openDrawer("shows")
        history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    }

    const newProject = (folder = false) => history({ id: "UPDATE", newData: { replace: { parent: "/" } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })

    const importShows = () => activePopup.set("import")
</script>

<div class="anchor">
    <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="settings.add" onclick={() => (open = !open)} />
    <Menu {open} onclose={() => (open = false)}>
        <MenuItem onclick={() => run(newShow)}>{translateText("new.show")}</MenuItem>
        <MenuItem onclick={() => run(newCategory)}>{translateText("new.category")}</MenuItem>
        <MenuSeparator />
        <MenuItem onclick={() => run(() => newProject())}>{translateText("new.project")}</MenuItem>
        <MenuItem onclick={() => run(() => newProject(true))}>{translateText("new.folder")}</MenuItem>
        <MenuSeparator />
        <MenuItem onclick={() => run(importShows)}>{translateText("actions.import")}</MenuItem>
    </Menu>
</div>

<style>
    .anchor {
        position: relative;
        display: flex;
    }
</style>
