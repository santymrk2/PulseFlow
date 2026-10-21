<script lang="ts">
    import { special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import HRule from "../../../lib/components/ui/h-rule/h-rule.svelte"
    import InputRow from "../../../lib/components/ui/input-row/input-row.svelte"
    import Button from "../../../lib/components/ui/button/button.svelte"
    import CheckboxField from "../../../lib/components/ui/checkbox-field/checkbox-field.svelte"
    import SelectField from "../../../lib/components/ui/select-field/select-field.svelte"
    import NumberField from "../../../lib/components/ui/number-field/number-field.svelte"
    import TextField from "../../../lib/components/ui/text-field/text-field.svelte"

    import FileField from "../../../lib/components/ui/file-field/file-field.svelte"

    const alwaysEnabledIds = ["time", "show", "$"]
    const toggleSections = ["time", "project", "show", "slide_text", "video", "audio", "meta", "timer", "rss", "txt", "$"]
    function getTitle(id: string) {
        if (id === "time") return "timer.time"
        if (id === "project") return "guide_title.project"
        if (id === "show") return "guide_title.show"
        if (id === "slide_text") return "edit.text"
        if (id === "video") return "edit.video"
        if (id === "audio") return "tools.audio"
        if (id === "meta") return "tools.metadata"
        if (id === "timer") return "items.timer"
        if (id === "rss") return "settings.rss"
        if (id === "txt") return "settings.txt"
        if (id === "$") return "items.variable"
        return ""
    }

    let hidden: string[] = $special.disabledDynamicValues || []

    function toggleHidden(key: string) {
        if (hidden.includes(key)) hidden.splice(hidden.indexOf(key), 1)
        else hidden.push(key)

        hidden = hidden
        special.update((a) => {
            a.disabledDynamicValues = hidden
            return a
        })
    }

    // RSS

    type RSS = {
        name: string
        url: string
        count: number
        divider?: string
        updateInterval?: string
    }

    const DEFAULT_RSS: RSS = { name: "", url: "", count: 5 }

    $: rssList = sortList($special.dynamicRSS || []) as RSS[]
    function sortList(list: any[]) {
        // this breaks "openedMenus"
        // return list.sort((a, b) => a.name.localeCompare(b.name))
        return list
    }

    function addRSS() {
        special.update((a) => {
            if (!a.dynamicRSS) a.dynamicRSS = []
            a.dynamicRSS.push(clone(DEFAULT_RSS))
            return a
        })

        const nextIndex = $special.dynamicRSS?.length - 1
        if (!openedMenus.includes(nextIndex)) {
            openedMenus.push(nextIndex)
            openedMenus = openedMenus
        }
    }

    function deleteItem(index: number) {
        if (openedMenus.includes(index)) toggleMenu(index)
        openedMenus = openedMenus.map((i) => (i > index ? i - 1 : i))

        special.update((a) => {
            if (!a.dynamicRSS) return a
            a.dynamicRSS.splice(index, 1)
            return a
        })
    }

    function setValue(e: any, index: number, key: string) {
        const value = e.detail

        special.update((a) => {
            if (!a.dynamicRSS?.[index]) return a

            a.dynamicRSS[index][key] = value
            return a
        })
    }

    // TXT

    type TXT = {
        name: string
        url: string
        divider?: string
        updateInterval?: string
    }

    const DEFAULT_TXT: TXT = { name: "", url: "", updateInterval: "3" }

    $: txtList = sortList($special.dynamicTXT || []) as TXT[]

    function addTXT() {
        special.update((a) => {
            if (!a.dynamicTXT) a.dynamicTXT = []
            a.dynamicTXT.push(clone(DEFAULT_TXT))
            return a
        })

        const nextIndex = $special.dynamicTXT?.length - 1
        if (!openedTxtMenus.includes(nextIndex)) {
            openedTxtMenus.push(nextIndex)
            openedTxtMenus = openedTxtMenus
        }
    }

    function deleteTxtItem(index: number) {
        if (openedTxtMenus.includes(index)) toggleTxtMenu(index)
        openedTxtMenus = openedTxtMenus.map((i) => (i > index ? i - 1 : i))

        special.update((a) => {
            if (!a.dynamicTXT) return a
            a.dynamicTXT.splice(index, 1)
            return a
        })
    }

    function setTxtValue(e: any, index: number, key: string) {
        const value = e?.detail !== undefined ? e.detail : e

        special.update((a) => {
            if (!a.dynamicTXT?.[index]) return a

            a.dynamicTXT[index][key] = value
            return a
        })
    }

    let openedTxtMenus: number[] = []
    function toggleTxtMenu(index: number) {
        if (openedTxtMenus.includes(index)) openedTxtMenus.splice(openedTxtMenus.indexOf(index), 1)
        else openedTxtMenus.push(index)
        openedTxtMenus = openedTxtMenus
    }

    // WIP duplicate of EffectTools.svelte
    let openedMenus: number[] = []
    function toggleMenu(index: number) {
        if (openedMenus.includes(index)) openedMenus.splice(openedMenus.indexOf(index), 1)
        else openedMenus.push(index)
        openedMenus = openedMenus
    }

    const updateIntervalList = [
        { value: "5", label: translateText("5 settings.minutes") },
        { value: "10", label: translateText("10 settings.minutes") },
        { value: "15", label: translateText("15 settings.minutes") },
        { value: "30", label: translateText("30 settings.minutes") },
        { value: "60", label: translateText("60 settings.minutes") },
        { value: "120", label: translateText("120 settings.minutes") },
        { value: "240", label: translateText("240 settings.minutes") }
    ]

    const txtUpdateIntervalList = [
        { value: "1", label: translateText("1 timer.seconds") },
        { value: "3", label: translateText("3 timer.seconds") },
        { value: "5", label: translateText("5 timer.seconds") },
        { value: "10", label: translateText("10 timer.seconds") },
        { value: "30", label: translateText("30 timer.seconds") },
        { value: "60", label: translateText("1 settings.minutes") },
        { value: "300", label: translateText("5 settings.minutes") }
    ]
</script>

<div>
    {#each toggleSections as section}
        {@const alwaysEnabled = alwaysEnabledIds.includes(section)}
        {@const alwaysDisabled = (section === "rss" && !$special.dynamicRSS?.length) || (section === "txt" && !$special.dynamicTXT?.length)}

        <CheckboxField label={getTitle(section)} disabled={alwaysEnabled || alwaysDisabled} checked={alwaysDisabled ? false : alwaysEnabled || !hidden.includes(section)} on:change={() => toggleHidden(section)} />
    {/each}
</div>

<HRule title="settings.rss" />

{#each rssList as rss, i}
    <InputRow arrow>
        <TextField label="inputs.name" value={rss.name} disabled={!!(rss.name && rss.url)} on:change={(e) => setValue(e, i, "name")} />

        <Button icon="delete" title="actions.delete" on:click={() => deleteItem(i)} white />

        <div slot="menu">
            <InputRow>
                <TextField style="width: 75%;" label="inputs.url" value={rss.url} on:change={(e) => setValue(e, i, "url")} />
                <TextField style="width: 25%;" label="meta.text_divider" value={rss.divider || " | "} on:change={(e) => setValue(e, i, "divider")} />
            </InputRow>

            <InputRow>
                <SelectField style="width: 75%;" label="edit.interval" options={updateIntervalList} value={rss.updateInterval || "60"} on:change={(e) => setValue(e, i, "updateInterval")} />
                <NumberField style="width: 25%;" label="edit.count" value={rss.count || 5} min={1} max={1000} on:change={(e) => setValue(e, i, "count")} />
            </InputRow>
        </div>
    </InputRow>
{/each}

<Button variant="outline" icon="add" on:click={addRSS}>
    <T id="settings.add" />
</Button>

<HRule title="settings.txt" />

{#each txtList as txt, i}
    <InputRow arrow>
        <TextField label="inputs.name" value={txt.name} disabled={!!(txt.name && txt.url)} on:change={(e) => setTxtValue(e, i, "name")} />

        <Button icon="delete" title="actions.delete" on:click={() => deleteTxtItem(i)} white />

        <div slot="menu">
            <InputRow>
                <TextField style="flex: 1;" label="inputs.url" value={txt.url} on:change={(e) => setTxtValue(e, i, "url")} />
                <FileField style="flex: 0;" label="" title="scripture.local" value="" filter={{ name: "Text files", extensions: ["txt"] }} icon="folder" on:change={(e) => setTxtValue(e, i, "url")} noLabel />
            </InputRow>

            <InputRow>
                <SelectField style="width: 75%;" label="edit.interval" options={txtUpdateIntervalList} value={txt.updateInterval || "3"} on:change={(e) => setTxtValue(e, i, "updateInterval")} />
                <TextField style="width: 25%;" label="meta.text_divider" value={txt.divider || "<br>"} on:change={(e) => setTxtValue(e, i, "divider")} />
            </InputRow>
        </div>
    </InputRow>
{/each}

<Button variant="outline" icon="add" on:click={addTXT}>
    <T id="settings.add" />
</Button>
