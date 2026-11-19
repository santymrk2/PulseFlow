import { createElement, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { Verse } from "json-bible/lib/Bible"
import type { VerseReference } from "json-bible/lib/reference"
import { defaultBibleBookNames } from "../../../converters/bebliaBible"
import { activeEdit, activeScripture, activeTriggerFunction, customScriptureBooks, notFound, openScripture, outLocked, outputs, resized, scriptureHistory, scriptureMode, scriptures, scriptureSettings, selected } from "../../../shared/core/stores"
import { wait } from "../../../utils/common"
import { translateText } from "../../../utils/language"
import { getNormalizedKey } from "../../../utils/shortcuts"
import { clone } from "../../../components/helpers/array"
import { brightenDarkColor, fadeColor } from "../../../components/helpers/color"
import { setDrawerTabData } from "../../../components/helpers/historyHelpers"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { InputRow } from "../../ui/input-row/InputRow"
import { Button } from "../../ui/button/Button"
import { CheckboxField } from "../../ui/checkbox-field/CheckboxField"
import { NumberField } from "../../ui/number-field/NumberField"
import { Input } from "../../ui/input/Input"
import { Center } from "../../system/Center"
import { formatBibleText, getShortBibleName, getVerseIdParts, getVersePartLetter, joinRange, loadJsonBible, moveSelection, outputIsScripture, playScripture, sanitizeVerseText, scriptureRangeSelect, sortScriptureSelection, splitText, swapPreviewBible } from "../../../components/drawer/bible/scripture"
import styles from "./Scripture.module.css"

// Port de components/drawer/bible/Scripture.svelte.
export interface ScriptureProps {
    active: string | null
}

interface Reference {
    book: number | string | null
    chapters: (number | string)[]
    verses: (number | string)[][]
}

type BibleReturn = NonNullable<Awaited<ReturnType<typeof loadJsonBible>>>
type TBook = Awaited<ReturnType<BibleReturn["getBook"]>>
type TChapter = Awaited<ReturnType<TBook["getChapter"]>>
type TVerse = ReturnType<TChapter["getVerses"]>
type PendingBook = ReturnType<BibleReturn["getBook"]>
type PendingChapter = ReturnType<TBook["getChapter"]>
interface BibleData {
    bibleData?: BibleReturn
    bookData?: TBook
    chapterData?: TChapter
    verseData?: TVerse
}

interface HistoryItem {
    id?: string
    tabId?: string
    version?: string
    reference: string
    text: string
    book: number | string
    chapter: number | string
    verse: (number | string)[]
}

interface PointerModifiers {
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
}

const GOLDEN_ANGLE = 137.508
const BASE_HUE = 330
function getVersionColor(index: number): string {
    const hue = (BASE_HUE + index * GOLDEN_ANGLE) % 360
    return `hsl(${hue}, 75%, 65%)`
}
function getVersionBgColor(index: number): string {
    const hue = (BASE_HUE + index * GOLDEN_ANGLE) % 360
    return `hsla(${hue}, 70%, 50%, 0.12)`
}

export function Scripture({ active }: ScriptureProps) {
    const activeScriptureId = active || ""
    const scriptureMap = useStore(scriptures)
    const storedReference = useStore(activeScripture)
    const specialSettings = useStore(scriptureSettings)
    const outputList = useStore(outputs)
    const resizedValue = useStore(resized)
    const notFoundValue = useStore(notFound)
    const customBooks = useStore(customScriptureBooks)
    const activeEditValue = useStore(activeEdit)
    const triggerFunction = useStore(activeTriggerFunction)
    const openScriptureValue = useStore(openScripture)
    const historyValue = useStore(scriptureHistory)
    const mode = useStore(scriptureMode)
    const locked = useStore(outLocked)

    const [apiError, setApiError] = useState(false)
    const [historyOpened, setHistoryOpened] = useState(false)
    const [contentSearchFieldActive, setContentSearchFieldActive] = useState(false)
    const [contentSearchValue, setContentSearchValue] = useState("")
    const [contentSearchResults, setContentSearchResults] = useState<VerseReference[] | null>(null)
    const [dataVersion, setDataVersion] = useState(0)
    const [referenceVersion, setReferenceVersion] = useState(0)

    const activeScriptures = scriptureMap[activeScriptureId]?.collection?.versions || [activeScriptureId]
    const previewBibleIndex = scriptureMap[activeScriptureId]?.collection?.previewIndex || 0
    const previewBibleId = activeScriptures[previewBibleIndex] || activeScriptures[0]
    const previewBibleData = clone(scriptureMap[previewBibleId] || null)
    if (previewBibleData?.copyright) previewBibleData.metadata = { ...(previewBibleData.metadata || {}), copyright: previewBibleData.copyright }
    if (previewBibleData?.customName) previewBibleData.name = previewBibleData.customName

    const isApi = !!previewBibleData?.api
    const isCollection = activeScriptures.length > 1

    const data = useRef<Record<string, BibleData>>({})
    const referenceRef = useRef<Reference>({
        book: storedReference.reference?.book || null,
        chapters: storedReference.reference?.chapters || [],
        verses: storedReference.reference?.verses || []
    })
    const activeReference = referenceRef.current

    const booksScrollElem = useRef<HTMLDivElement>(null)
    const chaptersScrollElem = useRef<HTMLDivElement>(null)
    const versesScrollElem = useRef<HTMLDivElement>(null)
    const navigationId = useRef(0)
    const pendingBookId = useRef<string | null>(null)
    const pendingBookPromise = useRef<PendingBook | null>(null)
    const pendingChapterId = useRef<string | null>(null)
    const pendingChapterPromise = useRef<PendingChapter | null>(null)
    const playWhenLoaded = useRef(false)
    const previousSelection = useRef<(number | string)[]>([])
    const isSelected = useRef(false)
    const selectedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const chapterLengths = useRef<{ [key: number]: number }>({})

    const touchData = () => setDataVersion((value) => value + 1)
    const touchReference = () => setReferenceVersion((value) => value + 1)
    void dataVersion
    void referenceVersion

    const splitChars = Number(specialSettings.longVersesChars || 100)
    const splitTolerance = Number(specialSettings.longVersesTolerance || 0)
    const splitEnabled = !!specialSettings.splitLongVerses

    const currentBibleData = data.current[previewBibleId] || null
    const currentBible = currentBibleData?.bibleData?.data || null
    const books = currentBible?.books || null
    const chapters = currentBibleData?.bookData?.data?.chapters || null
    const verses = currentBibleData?.chapterData?.data?.verses?.map((a) => ({ ...a, text: currentBibleData?.chapterData?.getVerse(a.number).getHTML() || "" })) || null
    const booksData = currentBibleData?.bibleData?.getBooksData() || []

    function getOffset(scriptureId: string) {
        const offsetId = `${scriptureId}-${activeReference.book}-${activeReference.chapters[0]}`
        const offsets = scriptureMap[activeScriptureId]?.collection?.offsets || {}
        return offsets[offsetId] || 0
    }

    function getCollectionVerses(verseId: string | number): { id: string; name: string; text: string; isSplit: boolean; repeated: boolean }[] {
        if (!isCollection) return []

        const { id, subverse } = getVerseIdParts(verseId)
        const isSplit = subverse > 0

        return activeScriptures
            .map((scriptureId) => {
                const scriptureData = data.current[scriptureId]
                const scriptureMeta = scriptureMap[scriptureId]
                const name = scriptureMeta?.customName || scriptureMeta?.name || scriptureId

                const offset = getOffset(scriptureId)
                const currentId = id + offset

                if (!scriptureData?.chapterData || (offset && (currentId < 1 || currentId > scriptureData.chapterData.data.verses.length))) {
                    return { id: scriptureId, name, text: "", isSplit: false, repeated: false }
                }

                try {
                    const verse = scriptureData.chapterData.getVerse(currentId)
                    const fullText = sanitizeVerseText(verse.getHTML() || verse?.data?.text || "")

                    if (isSplit && fullText) {
                        const splitParts = splitText(fullText, splitChars, splitTolerance)
                        const part = splitParts[subverse - 1] || splitParts[splitParts.length - 1] || fullText
                        return { id: scriptureId, name, text: part, isSplit: true, repeated: subverse > splitParts.length }
                    }

                    return { id: scriptureId, name, text: fullText, isSplit: false, repeated: false }
                } catch {
                    return { id: scriptureId, name, text: "", isSplit: false, repeated: false }
                }
            })
            .filter((v) => v.text)
    }

    function checkCollectionSplitSupport(): { [verseNumber: number]: number } {
        if (!isCollection || !splitEnabled || !verses?.length) return {}

        const splitCounts: { [verseNumber: number]: number } = {}

        activeScriptures.forEach((scriptureId) => {
            const chapterData = data.current[scriptureId]?.chapterData
            if (!chapterData) return

            verses.forEach((verse) => {
                try {
                    const fullText = sanitizeVerseText(chapterData.getVerse(verse.number).getHTML() || "")
                    if (!fullText) return

                    const splitParts = splitText(fullText, splitChars, splitTolerance)
                    if (splitParts.length > 1) {
                        splitCounts[verse.number] = Math.max(splitCounts[verse.number] || 0, splitParts.length)
                    }
                } catch {
                    // verse not available in this translation
                }
            })
        })

        return splitCounts
    }

    function updateSplitted(versesValue: Verse[] | null, collectionSplitCounts: { [verseNumber: number]: number } = {}) {
        if (!versesValue) return []
        if (!splitEnabled) return versesValue.map((verse) => ({ ...verse, id: (verse.number || "").toString() + (verse.endNumber ? "-" + verse.endNumber : "") }))

        const newVerses: (Verse & { id: string })[] = []
        versesValue.forEach((verse) => {
            const sanitizedVerse = sanitizeVerseText(verse.text)
            const newVerseStrings = splitText(sanitizedVerse, splitChars, splitTolerance)
            const end = verse.endNumber ? `-${verse.endNumber}` : ""
            // Only line this Bible up with the others while Show all is on. Otherwise extra rows repeat the last sentence.
            const alignWithCollection = isCollection && specialSettings.showAllVersions
            const numParts = Math.max(newVerseStrings.length, alignWithCollection ? collectionSplitCounts[verse.number] || 0 : 0)

            if (numParts > 1) {
                for (let i = 0; i < numParts; i++) {
                    const text = newVerseStrings[i] || (i === 0 ? verse.text : "")
                    newVerses.push({ ...verse, id: `${verse.number}_${i + 1}${end}`, text })
                }
            } else {
                newVerses.push({ ...verse, id: `${verse.number}${end}`, text: newVerseStrings[0] || verse.text })
            }
        })

        return newVerses
    }

    const collectionSplitCounts = isCollection && splitEnabled && verses ? checkCollectionSplitSupport() : {}
    const splittedVerses = updateSplitted(verses, collectionSplitCounts)

    const isActiveInOutput = outputIsScripture(outputList)
    const hasOffsets = Object.keys(scriptureMap[activeScriptureId]?.collection?.offsets || {}).length > 0
    // El checkbox de Svelte era un estado local inicializado desde los offsets y se reseteaba al cambiar de colección.
    const [useOffset, setUseOffset] = useState(hasOffsets)

    const range = joinRange(sortScriptureSelection(activeReference.verses[0] || []))
    const referenceDivider = specialSettings.referenceDivider || ":"
    const bookName = data.current[previewBibleId]?.bookData?.name || ""
    const reference = `${bookName} ${activeReference.chapters}${referenceDivider}${range}`

    const currentHistory = clone(historyValue).reverse() as HistoryItem[]
    const sameHistoryVersions = currentHistory.map((a) => a.version).every((v, _i, arr) => v === arr[0])

    async function loadScriptureForCollection(id: string) {
        if (!id || data.current[id]) return
        try {
            const jsonBible = await loadJsonBible(id)
            if (!jsonBible) return

            data.current[id] = { bibleData: jsonBible }
            touchData()
        } catch (err) {
            console.error("Error loading collection scripture:", id, err)
        }
    }

    async function loadScripture(id: string) {
        setApiError(false)

        if (!id) return
        if (data.current[id]) {
            openBook()
            return
        }

        try {
            const jsonBible = await loadJsonBible(id)
            if (!jsonBible) return

            data.current[id] = { bibleData: jsonBible }
        } catch (err) {
            console.error(err)
            if (isApi) setApiError(true)
            return
        }

        touchData()
        openBook()
    }

    const collectionLoadedFor = useRef<{ [scriptureId: string]: { book: number | string | null; chapter: number | string | null } }>({})

    async function loadCollectionBookChapter(targetBook: number | string, targetChapter: number | string) {
        if (!isCollection) return

        for (const scriptureId of activeScriptures) {
            if (scriptureId === previewBibleId) continue
            const scriptureData = data.current[scriptureId]
            if (!scriptureData?.bibleData) continue

            const currentLoaded = collectionLoadedFor.current[scriptureId]
            const bookNeedsReload = !scriptureData.bookData || currentLoaded?.book !== targetBook
            const chapterNeedsReload = !scriptureData.chapterData || currentLoaded?.chapter !== targetChapter || bookNeedsReload

            try {
                if (bookNeedsReload) {
                    scriptureData.bookData = await scriptureData.bibleData.getBook(targetBook)
                    delete scriptureData.chapterData
                }
                if (chapterNeedsReload && scriptureData.bookData) {
                    scriptureData.chapterData = await scriptureData.bookData.getChapter(Number(targetChapter))
                }

                collectionLoadedFor.current[scriptureId] = { book: targetBook, chapter: targetChapter }
                touchData()
            } catch (err) {
                console.error("Error loading collection book/chapter:", scriptureId, err)
            }
        }
    }

    function buildVerseLabel(id: number, subverse: number, endNumber: number, showSuffix: boolean) {
        const baseVisible = !subverse || subverse === 1 || showSuffix
        const base = baseVisible ? `${id}${endNumber ? "-" + endNumber : ""}` : ""
        const suffix = showSuffix && subverse ? getVersePartLetter(subverse) : ""
        return { base, suffix }
    }

    function toggleChapter(e: ReactMouseEvent<HTMLSpanElement>, id: string) {
        if (e.ctrlKey || e.metaKey) {
            if (activeReference.chapters?.find((cid) => cid?.toString() === id)) {
                const newChapters = activeReference.chapters.filter((cid) => cid.toString() !== id)
                const newVerses = activeReference.verses.filter((_, i) => i < newChapters.length)
                openChapter(newChapters, newVerses)
            } else {
                openChapter([...activeReference.chapters, id], [...activeReference.verses, []])
            }
        } else openChapter([id])
    }

    async function openBook(bookNumber?: number | string, chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[][], navId?: number): Promise<boolean> {
        const currentNavId = navId ?? ++navigationId.current
        const targetBookNumber = bookNumber ?? activeReference.book ?? 1
        const currentData = data.current[previewBibleId]?.bibleData
        if (!currentData) return false

        delete data.current[previewBibleId].bookData
        delete data.current[previewBibleId].chapterData
        delete data.current[previewBibleId].verseData
        touchData()

        const bookId = `${previewBibleId}_${targetBookNumber}`
        try {
            if (pendingBookId.current !== bookId) {
                pendingBookId.current = bookId
                pendingBookPromise.current = currentData.getBook(targetBookNumber)
            }
            const promise = pendingBookPromise.current
            if (!promise) return false
            data.current[previewBibleId].bookData = await promise
        } catch (err) {
            console.error(err)
            return false
        }

        if (currentNavId !== navigationId.current) return false

        if (bookNumber && !chapterNumbers) activeReference.chapters = []
        if (bookNumber && !verseNumbers) activeReference.verses = []
        activeReference.book = targetBookNumber
        touchReference()

        return await openChapter(chapterNumbers, verseNumbers, currentNavId)
    }

    async function openChapter(chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[][], navId?: number): Promise<boolean> {
        const currentNavId = navId ?? ++navigationId.current
        const targetChapterNumbers = chapterNumbers?.length ? chapterNumbers : activeReference.chapters?.length ? activeReference.chapters : [1]
        const currentData = data.current[previewBibleId]?.bookData
        if (!currentData) return false

        delete data.current[previewBibleId].chapterData
        delete data.current[previewBibleId].verseData
        touchData()

        const chapterNumber = Number(targetChapterNumbers[targetChapterNumbers.length - 1])
        const chapterId = `${previewBibleId}_${activeReference.book}_${chapterNumber}`
        try {
            if (pendingChapterId.current !== chapterId) {
                pendingChapterId.current = chapterId
                pendingChapterPromise.current = currentData.getChapter(chapterNumber)
            }
            const promise = pendingChapterPromise.current
            if (!promise) return false
            data.current[previewBibleId].chapterData = await promise
        } catch (err) {
            console.error(err)
            return false
        }

        if (currentNavId !== navigationId.current) return false

        if (chapterNumbers && !verseNumbers) activeReference.verses = []
        activeReference.chapters = targetChapterNumbers
        touchReference()

        openVerse(verseNumbers)
        return true
    }

    async function openVerse(verseNumbers?: (number | string)[][]) {
        verseNumbers = verseNumbers?.length ? verseNumbers : activeReference.verses.length ? activeReference.verses : [[1]]
        activeReference.verses = verseNumbers

        const currentData = data.current[previewBibleId]?.chapterData
        if (!currentData) return

        try {
            data.current[previewBibleId].verseData = currentData.getVerses(verseNumbers.map(Number))
        } catch {
            return
        }

        if (activeReference.verses[0]?.length && activeReference.book !== null) {
            activeScripture.set({
                id: previewBibleId,
                reference: {
                    book: activeReference.book,
                    chapters: activeReference.chapters,
                    verses: activeReference.verses
                }
            })
        }

        touchReference()
        if (playWhenLoaded.current) setTimeout(playScripture)
        playWhenLoaded.current = false
    }

    function resetContentSearch() {
        setContentSearchValue("")
        setContentSearchResults(null)
        setContentSearchFieldActive(false)
    }

    function openReference() {
        if (openScriptureValue?.book === undefined) {
            openScripture.set(null)
            return
        }

        resetContentSearch()

        if (openScriptureValue.play) playWhenLoaded.current = true

        let versesValue = openScriptureValue.verses
        if (!Array.isArray(versesValue)) versesValue = [[1]]
        if (!Array.isArray(versesValue[0])) versesValue = [versesValue]

        openBook(Number(openScriptureValue.book), [openScriptureValue.chapter], versesValue)

        openScripture.set(null)
    }

    function openHistoryEntry(item: HistoryItem) {
        let targetTabId = item.tabId || ""
        if (!scriptureMap[targetTabId]) targetTabId = item.id || ""
        if (!scriptureMap[targetTabId]) return

        const isOpen = targetTabId === activeScriptureId

        if (!isOpen) setDrawerTabData("scripture", targetTabId)

        openScripture.set({ book: item.book, chapter: item.chapter, verses: item.verse, play: true } as never)
    }

    function scrollToActive(scrollElem: HTMLElement | null) {
        if (!scrollElem || isSelected.current) return

        const selectedElemTop = (scrollElem.querySelector(".isActive") as HTMLElement | null)?.offsetTop || 0
        const visibleElemPos = selectedElemTop - scrollElem.scrollTop
        if (visibleElemPos > 0 && visibleElemPos < scrollElem.offsetHeight) return

        scrollElem.scrollTo(0, Math.max(0, selectedElemTop - 70))
    }

    function updateVersesSelection(e: PointerModifiers, verseNumber: string, isClick = false) {
        const selectedVerses = clone(activeReference.verses)

        if (isClick) {
            if (previousSelection.current?.find((a) => a.toString() === verseNumber)) {
                return [[verseNumber]]
            }
            return selectedVerses
        }

        previousSelection.current = clone(selectedVerses[selectedVerses.length - 1]) || []

        isSelected.current = true
        if (selectedTimeout.current) clearTimeout(selectedTimeout.current)
        selectedTimeout.current = setTimeout(() => (isSelected.current = false), 100)

        const keys = e.ctrlKey || e.metaKey || e.shiftKey
        const clicked = verseNumber.toString()
        const currentSelection = selectedVerses[selectedVerses.length - 1] || []
        const isSelectedVerse = currentSelection.some((a) => a?.toString() === clicked || (!clicked.includes("_") && a?.toString() === getVerseId(clicked).toString()))
        if (keys || !isSelectedVerse) {
            selectedVerses[selectedVerses.length - 1] = scriptureRangeSelect(e as unknown as MouseEvent, selectedVerses[selectedVerses.length - 1], verseNumber, splittedVerses)

            const current = selectedVerses[selectedVerses.length - 1]
            const splitVerseIds = current.filter((id) => id.toString().includes("_"))
            if (splitVerseIds.length > 0) {
                const baseIdsToRemove = new Set(splitVerseIds.map((id) => id.toString().split("_")[0]))
                selectedVerses[selectedVerses.length - 1] = current.filter((id) => {
                    const idStr = id.toString()
                    return idStr.includes("_") || !baseIdsToRemove.has(idStr)
                })
            }

            if (!selectedVerses[selectedVerses.length - 1]?.find((id) => id.toString() === verseNumber)) {
                previousSelection.current = clone(selectedVerses[selectedVerses.length - 1]) || []
            }
        }

        selected.set({ id: "scripture", data: [] })

        return selectedVerses

        function getVerseId(verseRef: number | string) {
            if (!verseRef) return 1
            return Number(verseRef.toString().split("_")[0])
        }
    }

    function focusFirstSplitPart(parts: { id: string }[], selectedChapters: (number | string)[][]) {
        const currentSelection = selectedChapters?.[selectedChapters.length - 1]
        if (!parts?.length || currentSelection?.length !== 1 || String(currentSelection[0]).includes("_")) return

        const base = getVerseIdParts(currentSelection[0]).id
        const firstPart = parts.find((part) => getVerseIdParts(part.id).id === base && getVerseIdParts(part.id).subverse === 1)
        if (!firstPart) return

        const next = selectedChapters.map((chapter, index) => (index === selectedChapters.length - 1 ? [firstPart.id] : chapter))
        openVerse(next)
        if (isActiveInOutput) setTimeout(playScripture)
    }

    function selectAllVerses() {
        if (!splittedVerses) return
        openVerse([splittedVerses.map((a) => a.id)])
        setTimeout(touchReference)
    }

    function searchValueChanged(e: React.FormEvent<HTMLInputElement>) {
        const value = (e.target as HTMLInputElement)?.value || ""
        setContentSearchValue(value)
        if (value.length < 5) {
            setContentSearchResults(null)
            return
        }
        searchInBible(value)
    }

    async function searchInBible(value = contentSearchValue) {
        if (value.length < 3) {
            setContentSearchResults(null)
            return
        }

        try {
            const result = await currentBibleData?.bibleData?.textSearch(value)
            if (!result) return
            setContentSearchResults(result as VerseReference[])
        } catch (err) {
            console.error(err)
        }
    }

    function updateOffset(scriptureId: string, value: number | null) {
        if (value === null) return
        const offsetId = `${scriptureId}-${activeReference.book}-${activeReference.chapters[0]}`

        scriptures.update((a) => {
            const collection = a[activeScriptureId]?.collection
            if (!collection) return a

            const currentOffsets = collection.offsets || {}
            a[activeScriptureId].collection!.offsets = { ...currentOffsets, [offsetId]: value }
            return a
        })
    }

    async function moveSelectionTo(moveLeft: boolean) {
        if (!activeReference.book) return

        const currentVerses = sortScriptureSelection(activeReference.verses[0] || [])
        const currentVerseId = currentVerses[0]?.toString()
        const selectionCount = currentVerses.length
        if (currentVerseId && splittedVerses.length) {
            const currentIndex = splittedVerses.findIndex((v) => v.id === currentVerseId || getVerseIdParts(v.id).id === Number(currentVerseId))
            if (currentIndex !== -1) {
                const newIndex = moveLeft ? currentIndex - selectionCount : currentIndex + selectionCount

                if (newIndex >= 0 && newIndex + selectionCount - 1 < splittedVerses.length) {
                    const newSelection: string[] = []
                    for (let i = 0; i < selectionCount; i++) {
                        newSelection.push(splittedVerses[newIndex + i].id)
                    }

                    await wait(1)
                    openVerse([newSelection])
                    if (isActiveInOutput) setTimeout(playScripture)
                    return
                }
            }
        }

        let versesCount = verses?.length || 0
        const normalizedVerses = (verses || []).map((v) => getVerseIdParts(v.number).id)
        const firstVerse = normalizedVerses[0]
        if (moveLeft && firstVerse === 1) {
            const chapterNumber = activeReference.chapters[0]
            const prevChapterIndex = (chapters || []).findIndex((c) => c.number?.toString() === chapterNumber?.toString()) - 1
            const prevChapter = chapters?.[prevChapterIndex]
            versesCount = prevChapter ? prevChapter.verses.length || chapterLengths.current[Number(chapterNumber) - 1] : 0
        }

        const lengths = { book: books?.length || 0, chapters: chapters?.length || 0, verses: versesCount }
        const selection = {
            book: Number(activeReference.book),
            chapters: [Number(activeReference.chapters[0])],
            verses: sortScriptureSelection(activeReference.verses[0] || [])
        }

        if (lengths.verses) chapterLengths.current[selection.chapters[0]] = lengths.verses

        const newSelection = moveSelection(lengths, selection, moveLeft)
        openBook(newSelection.book, newSelection.chapters, [newSelection.verses])

        if (isActiveInOutput) setTimeout(playScripture)
    }

    function mouseup(e: MouseEvent) {
        if ((e.target as Element | null)?.closest?.(".drawer")) return
        if (!contentSearchResults) resetContentSearch()
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            resetContentSearch()
            return
        }

        if (e.key === "Enter") {
            if ((e.target as Element | null)?.closest?.(".edit")) return
            if (e.ctrlKey || e.metaKey) playScripture()
            return
        }

        if (!e.ctrlKey && !e.metaKey) return

        const ctrlKey = e.shiftKey || e.altKey ? "" : getNormalizedKey(e)

        if (ctrlKey === "r") {
            if (!isActiveInOutput) return
            e.preventDefault()
            playScripture()
            return
        }

        if (ctrlKey === "h") {
            e.preventDefault()
            setHistoryOpened((value) => !value)
            return
        }

        if (ctrlKey === "b") {
            if (contentSearchFieldActive) resetContentSearch()
            else setContentSearchFieldActive(true)
            return
        }

        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        if (activeEditValue.items?.length) return

        moveSelectionTo(e.key.includes("Left"))
    }

    const latestHandlers = useRef({ keydown, mouseup })
    latestHandlers.current = { keydown, mouseup }

    // onMount
    useEffect(() => {
        selected.set({ id: "scripture", data: [] })
    }, [])

    // auto load scriptures when changed (timeout is to load drawer tab "instantly", before loading scripture)
    useEffect(() => {
        const timeout = setTimeout(() => loadScripture(previewBibleId), 10)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewBibleId])

    // Load all scriptures in collection for multi-version display
    useEffect(() => {
        if (!isCollection) return
        activeScriptures.forEach((id) => {
            if (id) loadScriptureForCollection(id)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCollection, activeScriptures.join(",")])

    // Reset tracking when the active scripture/collection changes
    useEffect(() => {
        collectionLoadedFor.current = {}
    }, [activeScriptureId])

    // El offset manual vuelve a su valor derivado al cambiar de colección
    useEffect(() => {
        setUseOffset(Object.keys(scriptureMap[activeScriptureId]?.collection?.offsets || {}).length > 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScriptureId])

    // Trigger loading book/chapter for all collection scriptures when reference changes.
    // Depende de dataVersion porque en el primer render las biblias de la colección todavía
    // no terminaron de cargar (en Svelte el bloque reactivo se reevaluaba con `data`).
    const collectionLoadKey = useRef("")
    useEffect(() => {
        if (!isCollection || !activeReference.book || !activeReference.chapters.length) return
        const targetBook = activeReference.book
        const targetChapter = activeReference.chapters[0]
        const pendingScriptures = activeScriptures.filter((id) => id !== previewBibleId)
        if (!pendingScriptures.every((id) => data.current[id]?.bibleData)) return

        const key = `${activeScriptures.join(",")}-${previewBibleId}-${targetBook}-${targetChapter}`
        if (collectionLoadKey.current === key) return
        collectionLoadKey.current = key
        loadCollectionBookChapter(targetBook, targetChapter)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCollection, dataVersion, referenceVersion, previewBibleId, activeScriptures.join(",")])

    // Changing chapter selects verse 1 as a plain number. That plays every split part on one slide. Keep just the first part.
    useEffect(() => {
        if (splitEnabled) focusFirstSplitPart(splittedVerses, activeReference.verses)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [splitEnabled, splittedVerses.map((verse) => verse.id).join(","), activeReference.verses[0]?.join(",")])

    // select book & chapter when opening bible show reference
    useEffect(() => {
        if (!openScriptureValue) return
        const timeout = setTimeout(openReference, 200)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openScriptureValue])

    useEffect(() => {
        if (!activeScriptureId || !activeReference.book) return
        const timeout = setTimeout(() => scrollToActive(booksScrollElem.current), 0)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScriptureId, activeReference.book])

    useEffect(() => {
        if (!activeScriptureId || !activeReference.chapters.length) return
        const timeout = setTimeout(() => scrollToActive(chaptersScrollElem.current), 0)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScriptureId, activeReference.chapters.join(",")])

    useEffect(() => {
        if (!activeScriptureId || !activeReference.verses[0]?.length) return
        const timeout = setTimeout(() => scrollToActive(versesScrollElem.current), 0)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScriptureId, activeReference.verses[0]?.join(",")])

    // active trigger functions
    useEffect(() => {
        if (triggerFunction === "scripture_selectAll") selectAllVerses()
        else if (triggerFunction === "scripture_next") moveSelectionTo(false)
        else if (triggerFunction === "scripture_previous") moveSelectionTo(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [triggerFunction])

    // En Svelte la búsqueda sólo se reseteaba cuando `activeReference` se reasignaba a sí mismo
    // (selectAllVerses), no al navegar: por eso acá no hay efecto sobre `referenceVersion`.

    // window listeners
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => latestHandlers.current.keydown(event)
        const onMouseUp = (event: MouseEvent) => latestHandlers.current.mouseup(event)
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("mouseup", onMouseUp)
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [])

    useEffect(() => {
        return () => {
            if (selectedTimeout.current) clearTimeout(selectedTimeout.current)
        }
    }, [])

    const notFoundIds = notFoundValue?.bible || []
    const showAllText = resizedValue.rightPanelDrawer <= 5
    const showFloatingButtons = resizedValue.rightPanelDrawer > 5 && splittedVerses.length > 10
    const modeClass = mode === "grid" ? "grid" : "list"

    return (
        <>
            <div style={{ flex: 1, overflowY: "auto" }}>
                <div className={`${styles.main} scripture`}>
                    {!previewBibleId || notFoundIds.includes(previewBibleId) || !scriptureMap[previewBibleId] || apiError ? (
                        <Center faded>
                            <T id={`error.bible${apiError ? "_api" : ""}`} />
                        </Center>
                    ) : contentSearchResults !== null ? (
                        contentSearchResults.length ? (
                            <div className="verses verseList">
                                {contentSearchResults.map((match, index) => (
                                    <span
                                        key={`${match.reference}-${index}`}
                                        className={`verse context #scripture_search_result${showAllText ? " showAllText" : ""}`}
                                        data-book={match.book}
                                        data-chapter={match.chapter}
                                        data-verse={match.verse.number}
                                        onDoubleClick={() => {
                                            openBook(match.book, [match.chapter], [[match.verse.number]])
                                            playWhenLoaded.current = true
                                        }}
                                        data-title={formatBibleText(match.verse.text)}
                                        role="none"
                                    >
                                        <span style={{ width: "250px", textAlign: "start", color: "var(--text)" }} className="v">
                                            {match.reference}
                                        </span>
                                        <span dangerouslySetInnerHTML={{ __html: formatBibleText(match.verse.text, true) }} />
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <Center faded>
                                <T id="empty.search" />
                            </Center>
                        )
                    ) : historyOpened ? (
                        currentHistory.length ? (
                            <div className="verses verseList">
                                {currentHistory.map((item, index) => (
                                    <span key={`${item.reference}-${index}`} className={`verse${showAllText ? " showAllText" : ""}`} onDoubleClick={() => openHistoryEntry(item)} data-title={formatBibleText(item.text)} role="none">
                                        <span style={{ width: "250px", textAlign: "start", color: "var(--text)", ...(!sameHistoryVersions && item.version ? { paddingLeft: 0 } : {}) }} className="v">
                                            {!sameHistoryVersions && item.version ? <span className="v history-version">{getShortBibleName(item.version)}</span> : null}
                                            {item.reference}
                                        </span>
                                        <span dangerouslySetInnerHTML={{ __html: formatBibleText(item.text, true) }} />
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <Center faded>
                                <T id="empty.general" />
                            </Center>
                        )
                    ) : (
                        <div className={modeClass}>
                            <div className={`books${!books?.length ? " center" : ""}`} ref={booksScrollElem}>
                                {books?.length ? (
                                    books.map((book, i) => {
                                        const id = book.number?.toString()
                                        const color = booksData[i]?.category?.color || ""
                                        const name = mode === "grid" ? booksData[i]?.abbreviation : customBooks[previewBibleId]?.[i] || book.name
                                        const isActive = activeReference.book?.toString() === id
                                        const localBook = isApi || isCollection || !Object.values(defaultBibleBookNames).includes(book.name)
                                        const style: React.CSSProperties = {
                                            ...(color ? { [`border${mode === "grid" ? "Bottom" : "Left"}`]: `2px solid ${color}` } : {}),
                                            ...(mode === "grid" ? { borderRadius: "2px", backgroundColor: fadeColor(color, isActive ? 0.35 : 0.15), color: brightenDarkColor(color) } : {})
                                        }
                                        return (
                                            <span key={id} id={id} className={`${localBook ? "" : "context #bible_book_local"}${isActive ? " isActive" : ""}`} style={style} onClick={() => openBook(id)} role="none">
                                                {name}
                                            </span>
                                        )
                                    })
                                ) : (
                                    <ScriptureLoader />
                                )}
                            </div>
                            <div className="content">
                                <div className={`chapters context #scripture_chapter${!chapters?.length ? " center" : ""}`} ref={chaptersScrollElem} style={{ textAlign: "center" }}>
                                    {chapters?.length ? (
                                        chapters.map((chapter) => {
                                            const id = chapter.number.toString()
                                            const isActive = activeReference.chapters?.find((cid) => cid?.toString() === id)
                                            return (
                                                <span
                                                    key={id}
                                                    id={id}
                                                    className={isActive ? "isActive" : ""}
                                                    onClick={(e) => toggleChapter(e, id)}
                                                    onContextMenu={() => {
                                                        openChapter([id])
                                                        setTimeout(selectAllVerses)
                                                    }}
                                                    role="none"
                                                >
                                                    {chapter.number}
                                                </span>
                                            )
                                        })
                                    ) : (
                                        <ScriptureLoader />
                                    )}
                                </div>
                                <div className={`verses context #scripture_verse${showFloatingButtons ? " showFloatingButtons" : ""}${!splittedVerses.length ? " center" : ""}`} ref={versesScrollElem}>
                                    {isCollection && useOffset && splittedVerses.length ? (
                                        <InputRow style={{ width: "100%", marginBottom: "5px" }}>
                                            {activeScriptures.map((scriptureId, i) => (
                                                <NumberField key={scriptureId} label={scriptureMap[scriptureId]?.name || scriptureId} value={getOffset(scriptureId)} disabled={i === 0} min={-10} max={10} onChange={(value) => updateOffset(scriptureId, value)} />
                                            ))}
                                        </InputRow>
                                    ) : null}

                                    {splittedVerses.length ? (
                                        <>
                                            {splittedVerses.map((content) => {
                                                const { id, subverse, endNumber } = getVerseIdParts(content.id)
                                                const showSplitSuffix = specialSettings.splitLongVersesSuffix
                                                const showSuffixInPicker = mode === "grid" || (isCollection && specialSettings.showAllVersions) ? true : showSplitSuffix
                                                const verseLabel = buildVerseLabel(id, subverse, endNumber, !!showSuffixInPicker)
                                                const isActive = activeReference.verses[activeReference.verses.length - 1]?.find((vid) => vid.toString() === content.id || vid.toString() === id.toString())
                                                const text = formatBibleText(content.text, true) || (isCollection ? '<span style="opacity: 0.6; font-size: 0.85em; margin: 0; padding: 0;">~</span>' : "")
                                                const collectionVerses = specialSettings.showAllVersions && isCollection && mode !== "grid" ? getCollectionVerses(content.id) : []

                                                return (
                                                    <span
                                                        key={content.id}
                                                        id={content.id.toString()}
                                                        className={`verse${showAllText ? " showAllText" : ""}${specialSettings.showAllVersions ? " showAllVersions" : ""}${isActive ? " isActive" : ""}${isCollection && mode !== "grid" ? " collection-verse" : ""}`}
                                                        data-title={`${text}<br><br>${translateText("tooltip.scripture")}`}
                                                        draggable="true"
                                                        onMouseDown={(e) => openVerse(updateVersesSelection(e, content.id))}
                                                        onClick={(e) => {
                                                            openVerse(updateVersesSelection(e, content.id, true))
                                                            if (isActiveInOutput && !e.ctrlKey && !e.metaKey) playScripture()
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            if (!(isActiveInOutput && !e.ctrlKey && !e.metaKey)) playScripture()
                                                        }}
                                                        role="none"
                                                    >
                                                        <span className="v" style={endNumber && subverse && showSuffixInPicker ? { width: "60px" } : undefined}>
                                                            {verseLabel.base}
                                                            {verseLabel.suffix ? <span style={{ padding: 0, color: "var(--text)", opacity: 0.5, fontSize: "0.8em" }}>{verseLabel.suffix}</span> : null}
                                                        </span>

                                                        {mode !== "grid" ? (
                                                            isCollection && specialSettings.showAllVersions ? (
                                                                <div className="collection-versions">
                                                                    {collectionVerses.map((cv, cvIndex) => (
                                                                        <div key={`${cv.id}-${cvIndex}`} className={`version-item${cv.repeated ? " repeated" : ""}`} style={{ "--version-color": getVersionColor(cvIndex), "--version-bg": getVersionBgColor(cvIndex) } as React.CSSProperties}>
                                                                            <span className="version-text">
                                                                                {cv.isSplit ? <span style={{ opacity: 0.6, fontSize: "0.85em", margin: 0, padding: 0 }}>~</span> : null}
                                                                                <span dangerouslySetInnerHTML={{ __html: formatBibleText(cv.text, true) }} />
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span dangerouslySetInnerHTML={{ __html: text }} />
                                                            )
                                                        ) : null}
                                                    </span>
                                                )
                                            })}

                                            {mode !== "grid" && previewBibleData?.metadata?.copyright ? createElement("copy", null, previewBibleData.metadata.copyright) : null}
                                        </>
                                    ) : (
                                        <ScriptureLoader />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {mode !== "grid" ? (
                <FloatingBar side="left">
                    <span className={styles.version} style={isCollection && specialSettings.showAllVersions === false ? { paddingLeft: 0 } : undefined}>
                        {previewBibleData?.name ? (
                            <>
                                {isCollection && specialSettings.showAllVersions ? null : isCollection ? (
                                    <Button icon="refresh" onClick={() => swapPreviewBible(activeScriptureId)} title={scriptureMap[activeScriptures[(previewBibleIndex + 1) % activeScriptures.length]]?.name || ""} style={{ paddingRight: "0.2em", fontWeight: "normal" }}>
                                        {isApi ? <Icon id="web" style={{ margin: "0 5px" }} size={0.8} white /> : null}
                                        {previewBibleData.name}:
                                    </Button>
                                ) : (
                                    <>
                                        {isApi ? <Icon id="web" style={{ marginRight: "5px" }} white /> : null}
                                        <span style={{ opacity: 0.8 }}>{previewBibleData.name}:</span>
                                    </>
                                )}

                                {reference}

                                {isCollection ? (
                                    <>
                                        <CheckboxField label="scripture.show_all" checked={specialSettings.showAllVersions} onChange={(checked) => scriptureSettings.update((s) => ({ ...s, showAllVersions: checked }))} small />

                                        <CheckboxField label="edit.offset" checked={useOffset} onChange={(checked) => setUseOffset(checked)} small />
                                    </>
                                ) : null}
                            </>
                        ) : null}
                    </span>
                </FloatingBar>
            ) : null}

            {contentSearchFieldActive ? (
                <FloatingBar>
                    <Input placeholder={translateText("scripture.search")} value={contentSearchValue} onInput={searchValueChanged} onChange={() => searchInBible()} style={{ width: "300px", borderRadius: "20px" }} autofocus />
                </FloatingBar>
            ) : mode !== "grid" || resizedValue.rightPanelDrawer > 5 ? (
                <FloatingBar>
                    {isActiveInOutput ? (
                        <>
                            <Button disabled={activeReference.book?.toString() === "1" && !!activeReference.chapters?.find((a) => a.toString() === "1") && !!activeReference.verses[0]?.find((a) => a.toString() === "1")} title={`${translateText("preview._previous_slide")} [Ctrl+Arrow Left]`} onClick={() => moveSelectionTo(true)}>
                                <Icon size={1.3} id="previous" />
                            </Button>
                            <Button disabled={activeReference.book?.toString() === books?.length.toString() && activeReference.chapters?.includes(chapters ? chapters.length : 1) && activeReference.verses[0]?.includes(verses ? verses.length : 1)} title={`${translateText("preview._next_slide")} [Ctrl+Arrow Right]`} onClick={() => moveSelectionTo(false)}>
                                <Icon size={1.3} id="next" />
                            </Button>
                        </>
                    ) : null}

                    <Button disabled={locked} title={isActiveInOutput ? "preview._update [Ctrl+R]" : "menu._title_display"} onClick={() => playScripture()}>
                        <Icon size={isActiveInOutput ? 1.1 : 1.3} id={isActiveInOutput ? "refresh" : "play"} white={!isActiveInOutput} />
                    </Button>

                    <div className="divider" />

                    <Button disabled={historyOpened} onClick={() => scriptureMode.set(mode === "list" ? "grid" : "list")} title={`show.${mode === "grid" ? "grid" : "list"}`}>
                        <Icon size={1.3} id={mode === "grid" ? "grid" : "list"} white />
                    </Button>

                    {currentHistory.length ? (
                        <>
                            <div className="divider" />
                            <Button disabled={!currentHistory.length && !historyOpened} isActive={historyOpened} onClick={() => setHistoryOpened((value) => !value)} title="popup.history [Ctrl+H]">
                                <Icon size={1.2} id="history" white />
                            </Button>
                        </>
                    ) : null}

                    <Button title="scripture.search [Ctrl+B]" disabled={typeof scriptureMap[activeScriptureId]?.id === "string" ? scriptureMap[activeScriptureId].id.includes("YOUVERSION") : false} onClick={() => setContentSearchFieldActive(true)}>
                        <Icon size={1.1} id="search" white />
                    </Button>
                </FloatingBar>
            ) : null}
        </>
    )
}

// Loader.svelte sigue siendo Svelte; en vez de una isla por verso se usa el mismo markup del loader.
function ScriptureLoader() {
    return (
        <div className="loader" style={{ display: "flex", justifyContent: "center", padding: "10px", opacity: 0.5 }}>
            <div className="spinner" />
        </div>
    )
}
