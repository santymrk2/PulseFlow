import { useEffect, useRef, useState } from "react"
import { quickSearchActive, special, theme, themes } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { getNormalizedKey } from "../../utils/shortcuts"
import { hexToRgb } from "../../components/helpers/color"
import { highlightText } from "../../components/quicksearch/searchHighlight"
import { quicksearch, quickSearchCategoryNames, selectQuicksearchValue, type SearchCategory } from "../../components/quicksearch/quicksearch"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { Input } from "../ui/input/Input"
import { Center } from "../system/Center"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import styles from "./QuickSearch.module.css"

interface QuickSearchResult {
    type?: string
    icon?: string
    id: string
    name: string
    color?: string
    aliasMatch?: string | null
    description?: string
    data?: unknown
    category: SearchCategory
}

const SEARCH_DEBOUNCE_MS = 90

export function QuickSearch() {
    const active = useStore(quickSearchActive)
    const currentSpecial = useStore(special)
    const currentTheme = useStore(theme)
    const currentThemes = useStore(themes)

    const [values, setValues] = useState<QuickSearchResult[]>([])
    const [searchValue, setSearchValue] = useState("")
    const [activeCategory, setActiveCategory] = useState<SearchCategory | null>(null)
    const [actualSearchText, setActualSearchText] = useState("")
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [centered, setCentered] = useState(true)
    const [showValues, setShowValues] = useState(false)

    const searchId = useRef(0)
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    async function runSearch(value: string, category: SearchCategory | null) {
        const currentId = ++searchId.current
        const results = await quicksearch(value, category)
        if (currentId !== searchId.current) return
        setValues(results as QuickSearchResult[])
        setSelectedIndex(0)
    }

    function scheduleSearch(value: string, category: SearchCategory | null, immediate = false) {
        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current)
            searchDebounce.current = null
        }
        if (immediate) {
            void runSearch(value, category)
            return
        }
        searchDebounce.current = setTimeout(() => {
            searchDebounce.current = null
            void runSearch(value, category)
        }, SEARCH_DEBOUNCE_MS)
    }

    function search(e: { target?: { value?: string } } | React.ChangeEvent<HTMLInputElement>) {
        const inputValue = (e.target as HTMLInputElement | undefined)?.value ?? ""
        let value = inputValue

        const categoryMatch = value.match(/^(settings?|stage|overlays?|projects?|actions?|faq|shows?|media|audio|bible)[:| ]\s*/i)
        if (categoryMatch) {
            let matchedCategory = categoryMatch[1].toLowerCase()
            if (!matchedCategory.endsWith("s") && !["stage", "faq", "media", "audio", "bible"].includes(matchedCategory)) matchedCategory += "s"
            const nextCategory = matchedCategory as SearchCategory
            value = value.replace(categoryMatch[0], "").trim()
            setActiveCategory(nextCategory)
            setActualSearchText(value)
            setSearchValue(inputValue)
            if (!value) {
                if (searchDebounce.current) {
                    clearTimeout(searchDebounce.current)
                    searchDebounce.current = null
                }
                searchId.current++
                setValues([])
                return
            }
            scheduleSearch(value, nextCategory)
            return
        }

        if (activeCategory) {
            setActualSearchText(inputValue)
            value = inputValue
        } else {
            setActiveCategory(null)
            setActualSearchText(inputValue)
            setSearchValue(inputValue)
        }

        if (!value) {
            if (searchDebounce.current) {
                clearTimeout(searchDebounce.current)
                searchDebounce.current = null
            }
            searchId.current++
            setValues([])
            return
        }

        scheduleSearch(value, activeCategory)
    }

    function openCategory(category: SearchCategory) {
        if (activeCategory) return
        setActiveCategory(category)
        const text = actualSearchText
        scheduleSearch(text, category, true)
    }

    function removeCategoryTag() {
        setActiveCategory(null)
        setSearchValue(actualSearchText)
        scheduleSearch(actualSearchText, null, true)
    }

    useEffect(() => {
        function keydown(e: globalThis.KeyboardEvent) {
            const key = getNormalizedKey(e)
            if (((e.ctrlKey || e.metaKey) && key === "g") || e.key === "F8") {
                quickSearchActive.set(!active)
                return
            }

            if (!active) return

            if (e.key === "Enter" && values.length) {
                selectQuicksearchValue(values[selectedIndex] as unknown as never, e.ctrlKey || e.metaKey)
                setSelectedIndex(0)
            } else if (e.key === "ArrowDown" && values.length) {
                e.preventDefault()
                setSelectedIndex((i) => Math.min(values.length - 1, i + 1))
            } else if (e.key === "ArrowUp" && values.length) {
                e.preventDefault()
                setSelectedIndex((i) => Math.max(0, i - 1))
            } else if (e.key === "Backspace" && activeCategory) {
                const target = e.target as HTMLInputElement | null
                if (!actualSearchText.trim() || (target && target.selectionStart === 0 && target.selectionEnd === 0)) {
                    removeCategoryTag()
                    e.preventDefault()
                }
            }
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [active, values, selectedIndex, activeCategory, actualSearchText])

    let rgb = { r: 35, g: 35, b: 45 }
    const color = currentThemes[currentTheme]?.colors?.["primary"]
    if (color) {
        const newRgb = hexToRgb(color)
        rgb = { r: Math.max(0, newRgb.r - 1), g: Math.max(0, newRgb.g - 5), b: Math.max(0, newRgb.b - 5) }
    }

    const isOptimized = !!currentSpecial.optimizedMode

    useEffect(() => {
        if (values.length && selectedIndex >= 0) {
            const selectedEl = document.getElementById(`qs-item-${selectedIndex}`)
            if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" })
        }
    }, [values, selectedIndex])

    useEffect(() => {
        if (values.length || actualSearchText || activeCategory) {
            setCentered(false)
            const t = setTimeout(() => setShowValues(true), 60)
            return () => clearTimeout(t)
        }
        setShowValues(false)
        const t = setTimeout(() => setCentered(true), 50)
        return () => clearTimeout(t)
    }, [values, actualSearchText, activeCategory])

    useEffect(() => {
        return () => {
            if (searchDebounce.current) clearTimeout(searchDebounce.current)
        }
    }, [])

    if (!active) return null

    const inputStyle = activeCategory ? `padding-left: ${90 + activeCategory.length * 8}px;` : "padding-left: 47px;"

    return (
        <div className={`${styles.quicksearch} ${centered ? styles.centered : ""}`.trim()}>
            <div className={`${styles.box} ${isOptimized ? styles.isOptimized : ""}`.trim()} style={{ ["--background" as string]: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.8)` } as React.CSSProperties}>
                <div className={styles.search}>
                    <div className={styles.icon}>
                        <Icon id="search" size={1.6} white />
                    </div>

                    {activeCategory ? (
                        <div className={styles.categoryTag}>
                            <span className={styles.tagText}>{activeCategory}</span>
                            <button className={styles.tagRemove} data-title={translateText("actions.remove")} onClick={() => removeCategoryTag()}>
                                <Icon id="close" size={0.8} white />
                            </button>
                        </div>
                    ) : null}

                    <Input value={activeCategory ? actualSearchText : searchValue} placeholder={activeCategory ? `Search in ${activeCategory}...` : translateText("main.quick_search...")} autofocus autoselect onInput={(e) => search(e as unknown as never)} style={cssTextToStyle(inputStyle)} />
                </div>

                {showValues && actualSearchText.length ? (
                    values.length ? (
                        <div className={styles.values}>
                            {values.map((value, i) => (
                                <div key={`${value.id}-${i}`}>
                                    {i === 0 || values[i - 1].category !== value.category ? (
                                        <div className={styles.categoryHeader} role="none" onClick={() => openCategory(value.category)}>
                                            {translateText(quickSearchCategoryNames[value.category])}
                                        </div>
                                    ) : null}

                                    <div id={`qs-item-${i}`}>
                                        <Button style={cssTextToStyle(`color: ${value.color || "unset"};`)} icon={value.icon || (value as { type?: string }).type} title={value.name} isActive={i === selectedIndex} onClick={(detail) => selectQuicksearchValue(value as unknown as never, !!(detail as { ctrl?: boolean }).ctrl)} white>
                                            <div className={styles.itemText}>
                                                <p>
                                                    {value.name}
                                                    {value.aliasMatch && !value.aliasMatch.startsWith("-") ? <span className={styles.alias}>{value.aliasMatch}</span> : null}
                                                    {value.id.startsWith("http") ? <Icon id="launch" size={0.8} white /> : null}
                                                </p>
                                                {value.description ? <p className={styles.description} dangerouslySetInnerHTML={{ __html: highlightText(value.description, actualSearchText || searchValue) }} /> : null}
                                            </div>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.values}>
                            <Center faded>
                                <T id="empty.search" />
                            </Center>
                        </div>
                    )
                ) : null}
            </div>
        </div>
    )
}
