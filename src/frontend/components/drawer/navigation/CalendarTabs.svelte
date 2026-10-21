<script lang="ts">
    import { activePopup, drawerTabsData, labelsDisabled } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("calendar")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.calendar?.activeSubTab || ""

    let sections: any[] = []
    $: sections = [
        [
            // show title to show add icon
            ...($labelsDisabled ? [{ id: "TITLE", label: "tabs.calendar" }] : []),
            { id: "event", label: "menu._title_calendar", icon: "calendar" },
            { id: "action", label: "calendar.schedule_action", icon: "actions" }
        ]
    ]

    function importCalendar() {
        activePopup.set("import_calendar")
    }
</script>

<NavigationSections {sections} active={activeSubTab}>
    <div slot="section_0" style="padding: 8px;padding-top: 12px;">
        <Button style="width: 100%;" title="actions.import_calendar" variant="outline" disabled={readOnly} on:click={importCalendar} size="xs">
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="actions.import_calendar" />{/if}
        </Button>
    </div>
</NavigationSections>
