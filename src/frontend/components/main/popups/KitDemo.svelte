<script lang="ts">
    import Button from "../../../lib/components/ui/button/button.svelte"
    import Capsule from "../../../lib/components/ui/capsule/capsule.svelte"
    import ListRow from "../../../lib/components/ui/list-row/list-row.svelte"
    import Menu from "../../../lib/components/ui/menu/menu.svelte"
    import MenuItem from "../../../lib/components/ui/menu/menu-item.svelte"
    import MenuSeparator from "../../../lib/components/ui/menu/menu-separator.svelte"
    import SectionHeader from "../../../lib/components/ui/section-header/section-header.svelte"
    import SelectField from "../../../lib/components/ui/select-field/select-field.svelte"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"
    import ToggleField from "../../../lib/components/ui/toggle-field/toggle-field.svelte"

    // Página de muestra del kit base (F12.2). Sólo para revisar piezas en dev:
    // activePopup.set("kit_demo") desde la consola.

    const variants = ["default", "secondary", "ghost", "outline", "destructive", "live"] as const
    const sizes = ["xs", "sm", "md", "icon", "icon-sm"] as const

    let menuOpen = false
    let liveOn = false
    let checkedLook = "Default"
    const looks = ["Default", "Predicador", "Himnos"]
</script>

<div class="demo">
    <section>
        <SectionHeader>Botones</SectionHeader>
        <div class="row">
            {#each variants as variant}
                <Button {variant} size="sm">{variant}</Button>
            {/each}
        </div>
        <div class="row">
            {#each variants as variant}
                <Button {variant}>{variant}</Button>
            {/each}
        </div>
        <div class="row">
            {#each sizes as size}
                <Button {size} variant="secondary" title={size}>+</Button>
            {/each}
            <Button variant="live" aria-pressed={liveOn} onclick={() => (liveOn = !liveOn)}>Audiencia</Button>
        </div>
    </section>

    <section>
        <SectionHeader>Cápsula</SectionHeader>
        <Capsule>
            <Button variant="ghost" size="sm">Buscar</Button>
            <Button variant="ghost" size="sm">Texto</Button>
            <Button variant="ghost" size="sm">Tema</Button>
        </Capsule>
    </section>

    <section>
        <SectionHeader>
            Lista
            {#snippet actions()}
                <Button variant="ghost" size="icon-sm" title="+">+</Button>
            {/snippet}
        </SectionHeader>
        <div class="list">
            <ListRow active>
                Presentación activa
                {#snippet trailing()}3{/snippet}
            </ListRow>
            <ListRow>Canciones</ListRow>
            <ListRow>Media</ListRow>
        </div>
    </section>

    <section>
        <SectionHeader>Campos</SectionHeader>
        <div class="fields">
            <TextField label="Nombre" value="Pantalla 1" />
            <SelectField
                label="Tipo"
                value="single"
                options={[
                    { value: "single", label: "Single" },
                    { value: "multiple", label: "Multiple" }
                ]}
            />
            <ToggleField label="Siempre arriba" checked />
        </div>
    </section>

    <section>
        <SectionHeader>Menú</SectionHeader>
        <div class="menu-anchor">
            <Button variant="outline" size="sm" onclick={() => (menuOpen = !menuOpen)}>Look: {checkedLook} ▾</Button>
            <Menu open={menuOpen} onclose={() => (menuOpen = false)}>
                {#each looks as look}
                    <MenuItem
                        checked={look === checkedLook}
                        onclick={() => {
                            checkedLook = look
                            menuOpen = false
                        }}>{look}</MenuItem
                    >
                {/each}
                <MenuSeparator />
                <MenuItem>Editar looks…</MenuItem>
            </Menu>
        </div>
    </section>
</div>

<style>
    .demo {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
        min-width: 640px;
        color: var(--text);
        font-size: 13px;
    }

    section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .row,
    .fields {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .fields {
        flex-direction: column;
        align-items: stretch;
    }

    .list {
        width: 240px;
    }

    .menu-anchor {
        position: relative;
        width: max-content;
    }
</style>
