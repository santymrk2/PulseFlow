import type { History as HistoryItem, HistoryNew } from "../../../types/History"
import { redo, undo } from "../../components/helpers/history"
import { getDateAndTimeString, timeAgo } from "../../components/helpers/time"
import { redoHistory, undoHistory } from "../../shared/core/stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Center } from "../system/Center"
import styles from "./History.module.css"

// Port de components/main/popups/History.svelte. Lee undoHistory y redoHistory. Escribe: "borrar historia" los deja en []; clic en una entrada llama a
// undo()/redo() de helpers/history (una vez por entrada, una cada 300 ms). Sin key en el original: se usa la posición.
type Entry = HistoryItem | HistoryNew | { id: "initial"; time: number }

const INITIAL: Entry = { id: "initial", time: 0 }

const historyIdToString: Record<string, string> = {
    initial: "Initial state",
    // NEW
    // STAGE
    STAGE_SHOW: "Updated stage show",
    SHOWS: "Updated shows",
    SLIDES: "Updated slides",
    TEMPLATE: "Changed template",
    SHOW_LAYOUT: "Updated show layout",
    SHOW_ITEMS: "Updated show items",
    // UPDATE
    UPDATE_stage: "Updated stage show",
    UPDATE_project: "Updated project",
    UPDATE_project_folder: "Updated project folder",
    UPDATE_project_key: "Changed project",
    UPDATE_project_folder_key: "Changed project folder",
    UPDATE_project_ref: "Updated items in project",
    UPDATE_section: "Updated section in project",
    UPDATE_category_shows: "Updated shows category",
    UPDATE_category_overlays: "Updated overlays category",
    UPDATE_category_templates: "Updated templates category",
    UPDATE_category_media: "Updated media folder",
    UPDATE_category_audio: "Updated audio folder",
    UPDATE_overlay: "Updated overlay",
    UPDATE_overlay_items: "Updated overlay items",
    UPDATE_overlay_name: "Updated overlay name",
    UPDATE_overlay_color: "Updated overlay color",
    UPDATE_overlay_category: "Updated overlay category",
    UPDATE_template: "Updated template",
    UPDATE_template_items: "Updated template items",
    UPDATE_template_name: "Updated template name",
    UPDATE_template_color: "Updated template color",
    UPDATE_template_category: "Updated template category",
    UPDATE_template_settings: "Updated template settings",
    UPDATE_player_video: "Updated player video",
    UPDATE_event: "Updated event",
    UPDATE_stage_item_style: "Updated stage item style",
    UPDATE_stage_item_position: "Updated stage item position",
    UPDATE_stage_item_content: "Updated stage item content",
    UPDATE_show: "Updated show",
    UPDATE_show_layout: "Updated show layout",
    UPDATE_show_key: "Changed show",
    UPDATE_global_group: "Updated global group",
    UPDATE_tag: "Updated tag",
    UPDATE_settings_style: "Updated settings: style",
    UPDATE_settings_output: "Updated settings: output",
    // UPDATE_ ... (historyHelpers)

    // edit
    textStyle: "Updated text style",
    textAlign: "Updated text align",
    deleteItem: "Deleted item",
    setItems: "Changed item",
    setStyle: "Changed item style",
    slideStyle: "Changed slide style",

    slide: "Added slide",
    showMedia: "Added media to show",
    showAudio: "Added audio to show"
}

const getName: Record<string, (value: { id: string; key: string }) => string> = {
    store_create: (value) => `Created new ${value.id}`,
    store_update: (value) => `Updated key ${value.key} in ${value.id}`,
    store_delete: (value) => `Deleted key ${value.key} in ${value.id}`
}

function getItemId(item: Entry): string {
    if ("version" in item && item.version === 1) return getName[item.type]?.(item.value) || item.type
    if (!("id" in item)) return ""
    if (item.id === "UPDATE") return item.id + "_" + ("location" in item ? item.location?.id : undefined)

    return item.id
}

function callUndo(index: number) {
    for (let i = 0; i <= index; i++) {
        setTimeout(() => {
            undo()
        }, i * 300)
    }
}

function clearHistory() {
    undoHistory.set([])
    redoHistory.set([])
}

export function History() {
    const rHistory: Entry[] = [...useStore(redoHistory)]
    const uHistory: Entry[] = [INITIAL, ...useStore(undoHistory)].reverse()

    function callRedo(index: number) {
        for (let i = rHistory.length - 1; i >= index; i--) {
            setTimeout(() => {
                redo()
            }, i * 300)
        }
    }

    return (
        <>
            <Button className="popup-options" icon="delete" title="actions.clear_history" disabled={!rHistory.length && uHistory.length < 2} onClick={clearHistory} white />

            <main className={styles.history}>
                {rHistory.length || uHistory.length ? (
                    <div className={styles.list}>
                        {rHistory.map((item, i) => {
                            const itemId = getItemId(item)
                            return (
                                <Button key={i} style={{ opacity: 0.5, padding: "10px 20px" }} onClick={() => callRedo(i)}>
                                    <p>
                                        <span style={historyIdToString[itemId] ? undefined : { opacity: 0.3, fontStyle: "italic" }}>{historyIdToString[itemId] || itemId}</span>
                                        <span className={styles.time} data-title={getDateAndTimeString(item.time || 0)}>
                                            {timeAgo(item.time || 0)}
                                        </span>
                                    </p>
                                </Button>
                            )
                        })}
                        {uHistory.map((item, i) => {
                            const itemId = getItemId(item)
                            return (
                                <Button key={i} style={{ padding: "10px 20px" }} onClick={() => callUndo(i - 1)} showOutline={i === 0}>
                                    <p>
                                        <span style={"version" in item && item.version ? undefined : historyIdToString[itemId] ? undefined : { opacity: 0.3, fontStyle: "italic" }}>{historyIdToString[itemId] || itemId}</span>
                                        <span className={styles.time} data-title={getDateAndTimeString(item.time || 0)}>
                                            {timeAgo(item.time || 0)}
                                        </span>
                                    </p>
                                </Button>
                            )
                        })}
                    </div>
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </main>
        </>
    )
}
