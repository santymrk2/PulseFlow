import { useEffect, useState } from "react"
import { EXPORT } from "../../../../types/Channels"
import type { Line, Show, TrimmedShow } from "../../../../types/Show"
import { activePopup, activeShow, activeTagFilter, categories, globalTags, popupData, shows, showsCache, special, templates, usageLog } from "../../../stores"
import { hasNewerUpdate } from "../../../utils/common"
import { send } from "../../../utils/request"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { updateCachedShows } from "../../../components/helpers/show"
import { _show } from "../../../components/helpers/shows"
import Clock from "../../../components/system/Clock.svelte"
import Date from "../../../components/system/Date.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { Center } from "../../system/Center"
import { InputRow } from "../../ui/input-row/InputRow"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import { InfoMetadata, type InfoMetadataEntry } from "./InfoMetadata"
import styles from "./ShowInfo.module.css"

// Port de components/drawer/info/ShowInfo.svelte. Clock y Date se migran en F24.18a.
export interface ShowInfoProps {
    optionsOpen: boolean
}

export function ShowInfo({ optionsOpen }: ShowInfoProps) {
    const currentShow = useStore(activeShow)
    const allShows = useStore(shows)
    const cache = useStore(showsCache)
    const allCategories = useStore(categories)
    const allTags = useStore(globalTags)
    const allTemplates = useStore(templates)
    const specialValue = useStore(special)
    const log = useStore(usageLog)
    const tagFilter = useStore(activeTagFilter)

    const [show, setShow] = useState<TrimmedShow | null>(null)
    const [fullShow, setFullShow] = useState<Show | null>(null)
    const [words, setWords] = useState(0)
    const [exporting, setExporting] = useState(false)
    const [exported, setExported] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function updateShows() {
            if (await hasNewerUpdate("SHOW_INFO", 200)) return
            if (cancelled) return
            setShow(currentShow?.id ? allShows[currentShow.id] : null)
            setFullShow(currentShow?.id ? cache[currentShow.id] : null)
        }
        void updateShows()
        return () => {
            cancelled = true
        }
    }, [allShows, cache, currentShow?.id])

    useEffect(() => {
        if (!fullShow) return
        const allLines = _show(currentShow?.id || "")
            .slides()
            .items()
            .lines()
            .get() as Line[][]
        let count = 0
        if (Array.isArray(allLines)) {
            allLines.forEach((lines) => {
                if (!Array.isArray(lines)) return
                lines.forEach((line) => {
                    if (!Array.isArray(line?.text)) return
                    line.text.forEach((text) => (count += text.value?.split(" ").length || 0))
                })
            })
        }
        setWords(count)
    }, [fullShow, currentShow?.id])

    function updateSpecial(value: unknown, key: string) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value
            return a
        })
        if (key === "alwaysPlaceEmptySlideFirst") updateCachedShows(cache)
    }

    function exportUsageLog() {
        setExporting(true)
        setTimeout(() => {
            setExported(true)
            setExporting(false)
        }, 1000)
        send(EXPORT, ["USAGE"], { content: log })
    }

    function resetUsageLog() {
        usageLog.set({ all: [] })
        setExported(false)
    }

    const created = show?.timestamps?.created || null
    const modified = show?.timestamps?.modified || null
    const used = show?.timestamps?.used || null
    const category = show?.category ? (allCategories[show.category]?.name ?? "error.not_found") || "main.unnamed" : "main.none"
    const tags = sortByName(keysToID(allTags).filter((a) => show?.quickAccess?.tags?.includes(a.id))).map(({ name }) => name)
    const template = fullShow?.settings?.template ? (allTemplates[fullShow.settings.template]?.name ?? "error.not_found") || "main.unnamed" : "main.none"

    const info: InfoMetadataEntry[] = [
        { label: "info.created", value: created, type: "date" },
        { label: "info.modified", value: modified, type: "date" },
        { label: "info.used", value: used, type: "date" },
        { label: "info.category", value: category },
        ...(Object.keys(allTags).length ? [{ label: "meta.tags", value: tags.join(", ") }] : []),
        { label: "info.slides", value: Object.keys(fullShow?.slides || {}).length },
        { label: "info.words", value: words },
        { label: "info.template", value: template }
    ]

    return (
        <>
            {tagFilter?.length && !optionsOpen ? (
                <Button style={{ width: "100%" }} onClick={() => activeTagFilter.set([])}>
                    <Icon id="close" right />
                    <T id="meta.clear_tag_filter" />
                </Button>
            ) : null}
            <div className={styles.scroll}>
                {optionsOpen ? (
                    <main style={{ overflowX: "hidden", padding: "10px" }}>
                        <ToggleField label="settings.always_place_empty_slide_first" checked={specialValue.alwaysPlaceEmptySlideFirst || false} defaultValue={false} onChange={(value) => updateSpecial(value, "alwaysPlaceEmptySlideFirst")} />
                        <ToggleField label="settings.transparent_slides" style={{ marginBottom: "5px" }} checked={specialValue.transparentSlides} defaultValue={false} onChange={(value) => updateSpecial(value, "transparentSlides")} />
                        <ToggleField label="settings.log_song_usage" checked={specialValue.logSongUsage || false} defaultValue={false} onChange={(value) => updateSpecial(value, "logSongUsage")} />
                        {specialValue.logSongUsage && log.all?.length ? (
                            <InputRow>
                                <Button disabled={exporting} style={{ width: "100%" }} icon={exported ? "reset" : "export"} onClick={() => (exported ? resetUsageLog() : exportUsageLog())}>
                                    <T id={`actions.${exported ? "reset" : "export"}_usage_log`} />
                                </Button>
                            </InputRow>
                        ) : null}
                        <Button
                            variant="outline"
                            title="popup.cleaning_utility"
                            style={{ marginTop: "5px", width: "100%" }}
                            onClick={() => {
                                popupData.set({ type: "shows" })
                                activePopup.set("cleaning_utility")
                            }}
                        >
                            <Icon id="autofill" />
                            <T id="popup.cleaning_utility" />
                        </Button>
                    </main>
                ) : currentShow !== null && (currentShow.type || "show") === "show" ? (
                    <InfoMetadata title={show?.name} info={info} />
                ) : (
                    <Center>
                        <SvelteIsland component={Clock} />
                        <SvelteIsland component={Date} />
                    </Center>
                )}
            </div>
        </>
    )
}
