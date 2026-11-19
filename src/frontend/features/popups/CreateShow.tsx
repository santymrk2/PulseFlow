import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import { ShowObj } from "../../shared/core/classes/Show"
import { clone, sortObject } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { checkName } from "../../shared/utils/helpers/show"
import { WebSearch } from "./WebSearch"
import { convertText, getQuickExample, trimNameFromString } from "../../converters/txt"
import { cn } from "../../shared/core/lib/utils"
import { activePopup, activeProject, activeShow, categories, drawerTabsData, formatNewShow, quickTextCache, shows, special, splitLines } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { getNormalizedKey } from "../../app/wiring/shortcuts"
import { customIconsColors } from "../../shared/core/values/customIcons"

import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { ChoiceGrid, type ChoiceOption } from "../../shared/ui/kit/choice-grid/ChoiceGrid"
import { List } from "../../shared/ui/kit/list/List"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextareaField } from "../../shared/ui/kit/textarea-field/TextareaField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"

// Port de components/main/popups/createShow/CreateShow.svelte (popup "show").
// Lee: quickTextCache (al montar), categories, drawerTabsData.shows.activeSubTab, activeShow y shows (categoría inicial, aviso de nombre repetido), activeProject, special, formatNewShow y splitLines.
// Escribe: quickTextCache en cada cambio de nombre o letra (y al crear lo vacía); al crear con letra convertText({ name, category, text, origin }) y sin letra history UPDATE de un ShowObj nuevo
// (con remember { project, index }); history UPDATE de la categoría nueva; special.autoGroups, formatNewShow y splitLines; y activePopup = null al crear.
// Atajos de ventana (sólo mientras está montado): Ctrl/Cmd+F busca en la web, Enter elige la letra, Ctrl/Cmd+Enter crea. WebSearch sigue siendo Svelte (isla).
// La lista de categorías se toma al montar (más la que se agrega aquí), como el Svelte.
interface Values {
    text: string
    name: string
    origin: string
}
interface Category {
    id: string
    name: string
    icon: string
    iconColor: string | undefined
}
interface Lyrics {
    title?: string
    artist?: string
    lyrics?: string
    source?: string
}

function initialValues(): Values {
    const cache = get(quickTextCache)
    const stored = cache.text.length > 20 || cache.fromSearch
    return { text: stored ? cache.text : "", name: stored ? cache.name : "", origin: "" }
}

function initialCategories(): Category[] {
    const all = get(categories)
    return sortObject(
        Object.keys(all).map((key) => ({ id: key, ...all[key] })),
        "name"
    ).map((cat) => ({ id: cat.id, name: cat.name, icon: cat.icon || "unlabeled", iconColor: cat.icon ? customIconsColors[cat.icon] : "#FFFFFF" }))
}

function initialCategoryId(cats: Category[]): string | undefined {
    const all = get(categories)
    const allShows = get(shows)
    const activeShowId = get(activeShow)?.id || ""
    const subTab = get(drawerTabsData).shows?.activeSubTab

    let selectedCategory: Category | undefined = cats[0]
    // get the selected category
    if (subTab && all[subTab]) selectedCategory = cats.find((a) => a.id === subTab)
    // get the category from the active show
    else if (allShows[activeShowId]?.category && all[allShows[activeShowId].category!]) selectedCategory = cats.find((a) => a.id === allShows[activeShowId]?.category)
    // set to "Songs" if it exists & nothing else if selected
    else if (all.song) selectedCategory = cats.find((a) => a.id === "song")
    // otherwise set to first category
    else if (cats.length > 1) selectedCategory = cats[1]

    return selectedCategory?.id
}

function getName(values: Values) {
    if (values.name) return values.name
    // WIP get from "title" metadata
    if (values.text.trim().length) return trimNameFromString(values.text)
    return ""
}

export function CreateShow() {
    const splitLinesValue = useStore(splitLines)
    const specialValue = useStore(special)
    const formatNewShowValue = useStore(formatNewShow)

    const [initialCats] = useState(initialCategories)
    const [cats, setCats] = useState(initialCats)
    const [selectedId, setSelectedId] = useState(() => initialCategoryId(initialCats))
    const [values, setValues] = useState(initialValues)
    const latest = useRef(values)
    const [selectedOption, setSelectedOption] = useState("")
    const [showMore, setShowMore] = useState(false)

    // lo que viene de la búsqueda web se conserva en el cache (y deja de marcarse como "fromSearch")
    useEffect(() => {
        if (get(quickTextCache).fromSearch) quickTextCache.set({ name: latest.current.name, text: latest.current.text })
    }, [])

    function commit(next: Values) {
        latest.current = next
        setValues(next)
    }

    function changeValue(value: string | null, key: "text" | "name") {
        const next = { ...latest.current, [key]: value || "" }
        commit(next)

        // store text if popup is closed
        quickTextCache.set({ name: next.name, text: next.text })
    }

    // OPTIONS

    const createOptions: ChoiceOption[] = [
        { id: "text", name: translateText("create_show.quick_lyrics"), title: translateText("create_show.quick_lyrics_tip [Enter]"), icon: "text" },
        { id: "web", name: translateText("create_show.web"), title: translateText("create_show.search_web [Ctrl+F]"), icon: "search" },
        { id: "empty", name: translateText("create_show.empty"), title: translateText("new.empty_show [Ctrl+Enter]"), icon: "add" }
    ]
    const resolvedCreateOptions = clone(createOptions).map((a) => {
        if (a.id === "text") a.colored = values.text.length > 0
        if (a.id === "web") a.disabled = !values.name?.trim()

        if (a.id === "empty") {
            if (values.text.length) {
                // don't create empty if there's text
                a.name = translateText("new.show")
                a.title = translateText("new.show [Ctrl+Enter]")
            } else {
                a.name = translateText("create_show.empty")
                a.title = translateText("new.empty_show [Ctrl+Enter]")
            }
        }

        return a
    })

    function selectOption(id: string) {
        if (id === "empty") {
            textToShow()
        } else {
            setSelectedOption(id)

            // look for existing shows with the same title
            const name = latest.current.name
            if (name) {
                const exists = Object.values(get(shows)).find((a) => a?.name?.toLowerCase() === name.toLowerCase())
                if (exists) newToast("create_show.exists")
            }
        }
    }

    // WEB SEARCH

    function updateLyrics(data: Lyrics) {
        if (!data.lyrics) {
            setSelectedOption("")
            return
        }

        const current = latest.current
        const next = { ...current }

        // if name is lowercase, replace it
        if (data.title && current.name.toLowerCase() === current.name) next.name = data.title

        next.text = data.lyrics

        const metadata: string[] = []
        if (data.title) metadata.push(`Title=${data.title}`)
        if (data.artist) metadata.push(`Artist=${data.artist}`)
        if (metadata.length) next.text = `${metadata.join("\n")}\n\n${next.text}`

        if (data.source) next.origin = data.source.toLowerCase()
        commit(next)
        setSelectedOption("text")
    }

    // CREATE

    function textToShow() {
        const current = latest.current
        let text = current.text
        if (typeof text !== "string") text = ""

        const sections = text.split("\n\n").filter((a) => a.length)

        const category = selectedId?.length ? selectedId : null

        if (sections.length) {
            convertText({ name: current.name, category, text, origin: current.origin })
        } else {
            const show = new ShowObj(false, category)
            show.name = checkName(current.name)
            const active = get(activeShow)
            const selectedIndex = active?.index === undefined ? undefined : active.index + 1
            history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject), index: selectedIndex } }, location: { page: "show", id: "show" } })
        }

        commit({ name: "", text: "", origin: "" })
        quickTextCache.set({ name: "", text: "" })
        activePopup.set(null)
    }

    // SHORTCUTS

    function keydown(e: KeyboardEvent) {
        if (e.shiftKey || e.altKey) return

        const ctrl = e.ctrlKey || e.metaKey

        const ctrlKey = ctrl ? getNormalizedKey(e) : ""
        if (ctrlKey === "f") {
            e.preventDefault()
            selectOption("web")

            return
        }

        if (e.key === "Enter") {
            const target = e.target instanceof Element ? e.target : null
            if (!ctrl && target?.closest(".edit") && !document.activeElement?.closest("#name")) return

            e.preventDefault()
            if (target?.closest("button")) return

            if (!ctrl) {
                selectOption("text")
                return
            }

            if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            textToShow()
        }
    }

    // los listeners y handlers de islas se registran una sola vez: leen siempre la versión más reciente
    const live = useRef({ keydown, updateLyrics })
    useEffect(() => {
        live.current = { keydown, updateLyrics }
    })
    useEffect(() => {
        const handler = (e: KeyboardEvent) => live.current.keydown(e)
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    function addNewCategory(name: string) {
        const id = uid()
        history({ id: "UPDATE", newData: { data: { name, icon: "song" } }, oldData: { id }, location: { page: "drawer", id: "category_shows" } })

        setCats((list) => [...list, { id, name, icon: "song", iconColor: customIconsColors["song"] }])
        setSelectedId(id)
    }

    return (
        <>
            {!selectedOption ? (
                <>
                    <List bottom={20}>
                        <TextField id="name" label="show.name" autofocus value={values.name} autofill={values.name ? "" : getName(values)} onInput={(value) => changeValue(value, "name")} />
                        <SelectField label="show.category" value={selectedId ?? ""} options={cats.map((a) => ({ label: translateText(a.name || "main.unnamed"), value: a.id, icon: a.icon, iconColor: a.iconColor }))} onChange={(value) => setSelectedId(cats.find((a) => a.id === value)?.id)} addNew="new.category" onNew={addNewCategory} />
                    </List>

                    <ChoiceGrid options={resolvedCreateOptions} onClick={selectOption} />
                </>
            ) : (
                <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setSelectedOption("")} />
            )}

            {selectedOption === "text" ? (
                <>
                    <Button className={cn("popup-options", showMore && "active")} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white>
                        {Number(splitLinesValue) ? <span className="state">{splitLinesValue}</span> : null}
                    </Button>

                    <TextareaField label="create_show.quick_lyrics" placeholder={getQuickExample()} value={values.text} autofocus={!values.text} rows={showMore ? 6 : Math.max(6, Math.min(12, values.text.split("\n").length))} onInput={(value) => changeValue(value, "text")} />

                    {showMore ? (
                        <List top={5}>
                            <ToggleField label="create_show.auto_groups" checked={specialValue.autoGroups !== false} defaultValue={true} onChange={(checked) => special.set({ ...get(special), autoGroups: checked })} />
                            <ToggleField label="create_show.format_new_show" checked={formatNewShowValue} defaultValue={false} onChange={(checked) => formatNewShow.set(checked)} />
                            <NumberField label="create_show.split_lines" value={splitLinesValue} max={100} onChange={(value) => value !== null && splitLines.set(value)} hideWhenZero />
                        </List>
                    ) : null}

                    <Button onClick={textToShow} variant="default" title="timer.create [Ctrl+Enter]" disabled={values.text.trim().length === 0} info={getName(values) || translateText("main.unnamed")} style={{ width: "100%", marginTop: "20px" }} icon="add" data-testid="create.show.popup.new.show">
                        <T id="timer.create" />
                    </Button>
                </>
            ) : selectedOption === "web" ? (
                <WebSearch query={values.name} onUpdate={(data) => live.current.updateLyrics(data || {})} />
            ) : null}
        </>
    )
}
