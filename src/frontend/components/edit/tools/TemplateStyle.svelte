<script lang="ts">
    import type { Item, TemplateSettings } from "../../../../types/Show"
    import { activeEdit, activePopup, overlays, popupData, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { mediaExtensions } from "../../../values/extensions"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import ColorField from "../../../lib/components/ui/color-field/color-field.svelte"
    import SelectField from "../../../lib/components/ui/select-field/select-field.svelte"
    import FileField from "../../../lib/components/ui/file-field/file-field.svelte"
    import NumberField from "../../../lib/components/ui/number-field/number-field.svelte"
    import PopupField from "../../../lib/components/ui/popup-field/popup-field.svelte"
    import ToggleField from "../../../lib/components/ui/toggle-field/toggle-field.svelte"
    import ItemsList from "./ItemsList.svelte"

    $: templateId = $activeEdit?.id || ""
    $: template = $templates[templateId] || {}

    let settings: TemplateSettings = {}

    $: if (template) setValues()
    function setValues() {
        settings = {
            backgroundColor: template?.settings?.backgroundColor || "",
            ...(template.settings || {})
        }
    }

    function update() {
        if (!template) return

        let newData = { key: "settings", data: clone(settings) }

        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    function setValue(e: any, key: string) {
        let value = e?.detail ?? e
        settings[key] = value

        update()
    }

    $: overlayList = sortByName(keysToID($overlays))
        .filter((a) => a.name)
        .map((a) => ({ value: a.id, label: a.name }))

    const modes = [
        { value: "default", label: translateText("example.default") },
        { value: "scripture", label: translateText("tabs.scripture") },
        { value: "item", label: translateText("tools.item") }
        // { value: "text", label: translateText("edit.text") } // hidden
    ]
    $: mode = template.settings?.mode || "default"

    export let allSlideItems: Item[]
</script>

<div class="tools">
    <div>
        <SelectField label="actions.mode" options={modes} value={mode} defaultValue="default" on:change={(e) => setValue(e.detail, "mode")} />
    </div>

    <div>
        <ColorField
            label="edit.background_color"
            value={settings.backgroundColor}
            on:input={(e) => {
                settings.backgroundColor = e.detail
                update()
            }}
            allowEmpty
            allowGradients
            noLabel
        />

        <InputRow>
            <FileField label="edit.background_media" value={settings.backgroundPath} filter={{ name: "Media files", extensions: mediaExtensions }} on:change={(e) => setValue(e, "backgroundPath")} allowEmpty />
            <!-- {#if settings.backgroundPath}<Button title="titlebar.edit" icon="edit" on:click={editBackgroundImage} />{/if} -->
        </InputRow>
    </div>

    {#if mode !== "scripture"}
        <div>
            <div class="title">
                <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                    <Icon id="text" white />
                    <p>{translateText("edit.text")}</p>
                </span>
            </div>

            <NumberField label="edit.max_lines_per_slide" value={settings?.maxLinesPerSlide || 0} max={100} on:change={(e) => setValue(e, "maxLinesPerSlide")} />
            <NumberField label="edit.break_long_lines_tip" value={settings?.breakLongLines || 0} max={100} on:change={(e) => setValue(e, "breakLongLines")} />
        </div>
    {/if}

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="special" white />
                <p>{translateText("edit.special")}</p>
            </span>
        </div>

        <SelectField label="edit.overlay_content" options={overlayList} value={settings.overlayId || ""} on:change={(e) => setValue(e.detail, "overlayId")} allowEmpty />

        <InputRow>
            <PopupField
                label="edit.different_first_template"
                value={settings.firstSlideTemplate}
                name={$templates[settings.firstSlideTemplate || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={(e) => {
                    settings.firstSlideTemplate = e.detail
                    if (!e.detail) settings.createFirstSlide = false
                    update()
                }}
                allowEmpty
            />
            <!-- {#if settings.firstSlideTemplate && $templates[settings.firstSlideTemplate]}
                    <Button title="titlebar.edit" icon="edit" on:click={() => editTemplate(settings.firstSlideTemplate || "")} />
                {/if} -->
        </InputRow>

        {#if settings.firstSlideTemplate}
            <ToggleField label="settings.always_place_empty_slide_first" checked={settings.createFirstSlide} defaultValue={false} on:change={(e) => setValue(e.detail, "createFirstSlide")} />
        {/if}

        <!-- <InputRow>
            <PopupField
                label="edit.different_last_template"
                value={settings.lastSlideTemplate}
                name={$templates[settings.lastSlideTemplate || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={e => {
                    settings.lastSlideTemplate = e.detail
                    update()
                }}
                allowEmpty
            />
        </InputRow> -->

        <Button
            variant="outline"
            icon="text"
            style="width: 100%;"
            on:click={() => {
                popupData.set({ templateId })
                activePopup.set("template_style_overrides")
            }}
        >
            {translateText("popup.template_style_overrides")}
        </Button>
    </div>

    <ItemsList bind:allSlideItems />
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: var(--text-xs);
        opacity: 0.8;
    }
</style>
