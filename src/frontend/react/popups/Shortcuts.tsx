import { os } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { useStore } from "../hooks/useStore"
import { HRule } from "../ui/h-rule/HRule"
import styles from "./Shortcuts.module.css"

// Port de components/main/popups/Shortcuts.svelte. Lee: os.platform (para cmd/ctrl y option/alt) y dictionary (vía translateText).
// No escribe ningún store. Las filas "SEPARATOR" se renderizan como HRule con título traducido si la clave tiene punto.
export function Shortcuts() {
    const osValue = useStore(os)
    const ctrl = osValue.platform === "darwin" ? "cmd" : "ctrl"
    const alt = osValue.platform === "darwin" ? "option" : "alt"

    const shortcuts: Record<string, string> = {
        "actions.selectAll": `${ctrl} + a`,
        "edit._title_bold": `${ctrl} + b`,
        "actions.copy": `${ctrl} + c`,
        "actions.duplicate": `${ctrl} + d`,
        "actions.toggle_drawer": `${ctrl} + d`,
        "actions.export": `${ctrl} + e`,
        "main.search": `${ctrl} + f`,
        "actions.find_replace": `${ctrl} + f`, // only in editor
        "main.quick_search": `${ctrl} + g`, // also F8
        "popup.history": `${ctrl} + ?`,
        "edit._title_italic": `${ctrl} + i`,
        "actions.import": `${ctrl} + i`,
        // "": `${ctrl} + j`,
        // "": `${ctrl} + k`,
        "preview._lock": `${ctrl} + l`,
        "actions.mute": `${ctrl} + m`,
        "new.create": `${ctrl} + n`,
        "actions.toggle_output_windows": `${ctrl} + o`,
        // "new.project": `${ctrl} + p`,
        // "this_is_default_mac_close!": `${ctrl} + q`,
        "preview._update": `${ctrl} + r`,
        "actions.save": `${ctrl} + s`,
        "actions.toggle_panels": `${ctrl} + t`,
        "edit._title_underline": `${ctrl} + u`,
        "actions.paste": `${ctrl} + v`,
        // "": `${ctrl} + w`, // closing something
        "actions.cut": `${ctrl} + x`,
        "actions.redo": `${ctrl} + y`, // or Ctrl+Shift+Z
        "actions.undo": `${ctrl} + z`,
        "popup.shortcuts": `${ctrl} + ?`,

        shift: "SEPARATOR",

        "actions.focus_mode": `${ctrl} + shift + f`,
        // "new.show": `${ctrl} + shift + n`, // normally Ctrl+n
        "show.change_view": `${ctrl} + shift + v`,

        ctrl_alt: "SEPARATOR",

        "Show Import from Clipboard": `${ctrl} + ${alt} + i`,

        alt: "SEPARATOR",

        "actions.cut_in_half": `${alt} + enter`,
        // "actions.delete": "del / backspace",

        clear: "SEPARATOR",

        "actions.remove_selection": "esc",
        "clear.all": "esc",
        // "clear.all": ".",
        "clear.background": "f1",
        "actions.rename": "f2",
        "clear.slide": "f2",
        "clear.overlays": "f3",
        "clear.audio": "f4",
        // "preview._next_slide": "f5",
        // "preview._next_slide": "Arrow Right",

        // "clear.nextTimer": "f5",
        // "from start": "f5",
        // MAC: cmd + shift + f
        // "main.quick_search": "f8",
        // F11 does not mean fullscreen on macOS (shortcuts.ts)
        ...(osValue.platform === "darwin" ? {} : { "actions.fullscreen": "f11" }),

        // presenterKeys: "SEPARATOR",

        num: "SEPARATOR",

        // arrow keys, space, tabs, enter, ...
        "actions.change_tab": "num",
        "actions.change_drawer_tab": `${ctrl} + num`,
        "actions.change_slide": "← / →",
        // "preview._next_slide": "→ / PgDn", // space / f5
        // "preview._previous_slide": "← / PgUp",
        "actions.change_project_item": "↑ / ↓",
        "actions.change_drawer_item": `${ctrl} + ← / →`,
        "actions.change_drawer_category": `${ctrl} + ↑ / ↓`,

        "media.play": `${ctrl} + Enter`
    }

    return (
        <main className={styles.main}>
            {Object.entries(shortcuts).map(([id, shortcut]) =>
                shortcut === "SEPARATOR" ? (
                    <HRule key={id} title={id.includes(".") ? translateText(id) : ""} />
                ) : (
                    <div key={id}>
                        <p>{translateText(id)}</p>
                        <span className={styles.shortcut}>{shortcut}</span>
                    </div>
                )
            )}
        </main>
    )
}
