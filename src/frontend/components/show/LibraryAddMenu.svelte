<script lang="ts">
    // "+" de ÍTEMS cuando la fuente es una biblioteca: crear un show en ella o importar shows.
    // (Bibliotecas y playlists se crean desde el "+" de su propio panel.)
    import Button from "../../lib/components/ui/button/button.svelte"
    import Menu from "../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../lib/components/ui/menu/menu-item.svelte"
    import { activePopup } from "../../stores"
    import { translateText } from "../../utils/language"

    export let readOnly = false

    let open = false

    function run(action: () => void) {
        open = false
        action()
    }
</script>

<div class="anchor">
    <Button variant="ghost" size="icon-sm" icon="add" iconSize={0.9} title="new.show" disabled={readOnly} onclick={() => (open = !open)} />
    <Menu {open} onclose={() => (open = false)}>
        <MenuItem onclick={() => run(() => activePopup.set("show"))}>{translateText("new.show")}</MenuItem>
        <MenuItem onclick={() => run(() => activePopup.set("import"))}>{translateText("actions.import")}</MenuItem>
    </Menu>
</div>

<style>
    .anchor {
        position: relative;
        display: flex;
    }
</style>
