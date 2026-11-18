import { useEffect, useState, type CSSProperties } from "react"
import type { ContentFile, ContentLibraryCategory, ContentProviderId } from "../../../../types/ContentProvider"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../IPC/main"
import { mediaOptions, openedMediaFolders } from "../../../stores"
import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import { Button } from "../../ui/button/Button"
import { Center } from "../../system/Center"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { useStore } from "../../hooks/useStore"
import { MediaCard } from "./MediaCard"
import styles from "./ContentLibraryBrowser.module.css"

type ContentFileWithExtras = ContentFile & { [key: string]: unknown }

export interface ContentLibraryBrowserProps {
    providerId: ContentProviderId
    columns?: number
    currentCategory?: ContentLibraryCategory | null
    onCurrentCategoryChange?: (category: ContentLibraryCategory | null) => void
    getContentCategory?: (item: ContentFileWithExtras) => ContentLibraryCategory | null
    className?: string
    style?: CSSProperties
}

export function ContentLibraryBrowser({ providerId, columns: columnsProp, onCurrentCategoryChange, getContentCategory = () => null, className, style }: ContentLibraryBrowserProps) {
    const mediaOptionsValue = useStore(mediaOptions)
    const openedFolders = useStore(openedMediaFolders)

    const columns = columnsProp ?? mediaOptionsValue.columns

    const [library, setLibrary] = useState<ContentLibraryCategory[]>([])
    const [currentPath, setCurrentPath] = useState<ContentLibraryCategory[]>([])
    const [currentCategory, setCurrentCategoryState] = useState<ContentLibraryCategory | null>(null)
    const [content, setContent] = useState<ContentFileWithExtras[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [viewingContent, setViewingContent] = useState(false)

    const setCurrentCategory = (c: ContentLibraryCategory | null) => {
        setCurrentCategoryState(c)
        onCurrentCategoryChange?.(c)
    }

    // notify parent on change
    useEffect(() => {
        onCurrentCategoryChange?.(currentCategory)
    }, [currentCategory, onCurrentCategoryChange])

    // restore saved on mount
    useEffect(() => {
        const saved = openedFolders[providerId]
        if (saved?.currentCategory) {
            setCurrentPath(saved.currentPath || [])
            setCurrentCategoryState(saved.currentCategory)
            setViewingContent(saved.viewingContent ?? !!saved.currentCategory.key)
            setContent(saved.content || [])
            if (!(saved.content || []).length && saved.currentCategory?.key) loadContent(saved.currentCategory.key)
        }
        void loadLibrary()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // provider change
    const [prevProviderId, setPrevProviderId] = useState(providerId)
    useEffect(() => {
        if (providerId === prevProviderId) return
        setPrevProviderId(providerId)
        const saved = openedFolders[providerId]
        if (saved?.currentCategory) {
            setCurrentPath(saved.currentPath || [])
            setCurrentCategoryState(saved.currentCategory)
            setViewingContent(saved.viewingContent ?? !!saved.currentCategory.key)
            setContent(saved.content || [])
            if (!(saved.content || []).length && saved.currentCategory?.key) loadContent(saved.currentCategory.key)
        } else {
            setCurrentPath([])
            setCurrentCategoryState(null)
            setContent([])
            setViewingContent(false)
        }
        setLibrary([])
        void loadLibrary()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providerId])

    function save() {
        openedMediaFolders.update((a) => {
            const next = { ...a }
            if (currentCategory) next[providerId] = { currentPath, currentCategory, viewingContent, content }
            else delete next[providerId]
            return next
        })
    }

    async function loadLibrary() {
        if (library.length) return
        setLoading(!viewingContent && !currentCategory?.children?.length)
        setError(null)
        try {
            requestMain(Main.GET_CONTENT_LIBRARY, { providerId }, (data) => {
                if (!data) return
                setLibrary(data as ContentLibraryCategory[])
                setLoading(false)
            })
        } catch (e) {
            setError(`Failed to load library: ${e}`)
            setLoading(false)
        }
    }

    function navigateToCategory(category: ContentLibraryCategory) {
        setCurrentPath((prev) => [...prev, currentCategory!].filter(Boolean))
        setCurrentCategory(category)
        setContent([])
        setViewingContent(!!category.key)
        save()
        if (category.key) loadContent(category.key)
    }

    function navigateBack() {
        if (currentPath.length === 0) {
            setCurrentCategory(null)
            setContent([])
            setViewingContent(false)
        } else {
            const newCurrent = currentPath[currentPath.length - 1]
            setCurrentCategory(newCurrent)
            setCurrentPath((prev) => prev.slice(0, -1))
            setContent([])
            setViewingContent(!!newCurrent?.key)
            if (newCurrent?.key) loadContent(newCurrent.key)
        }
        save()
    }

    async function loadContent(key: string) {
        setLoading(true)
        setError(null)
        try {
            requestMain(
                Main.GET_PROVIDER_CONTENT,
                { providerId, key },
                (data) => {
                    if (!data) {
                        setError("Failed to load content.")
                        setLoading(false)
                        return
                    }
                    setContent(data as ContentFileWithExtras[])
                    setLoading(false)
                    save()
                },
                60000
            )
        } catch (e) {
            setError(`Failed to load content: ${e}`)
            setLoading(false)
        }
    }

    const categories = viewingContent ? [] : currentCategory?.children || library
    const showBackButton = currentPath.length > 0 || currentCategory !== null
    const listMode = mediaOptionsValue.mode === "list"
    const cardWidth = listMode ? "100%" : `calc(${100 / columns}% - 4px)`

    const filteredCategories = categories
    const filteredContent = content

    return (
        <div className={cn(styles.contentLibrary, className)} style={style}>
            {showBackButton ? (
                <FloatingBar side="left">
                    <Button title="actions.back" onClick={navigateBack}>
                        <Icon id="back" white />
                    </Button>
                    <div className={styles.divider}></div>
                    <p style={{ opacity: 0.8, display: "flex", alignItems: "center", padding: "0 15px" }}>
                        <span style={{ opacity: 0.3, fontSize: "0.9em", maxWidth: "500px", overflow: "hidden", direction: "rtl" }}>
                            {currentPath.length ? "/" : ""}
                            {currentPath.map((a) => a.name)?.join("/")}
                        </span>
                        {currentCategory?.name || ""}
                    </p>
                </FloatingBar>
            ) : null}

            {loading ? (
                <Center>
                    <p style={{ opacity: 0.5 }}>Loading...</p>
                </Center>
            ) : error ? (
                <Center>
                    <p style={{ color: "var(--error)", opacity: 0.8 }}>{error}</p>
                </Center>
            ) : content.length > 0 ? (
                <div className={`${styles.grid} ${listMode ? styles.list : ""}`} style={{ padding: "5px" }}>
                    {filteredContent.map((item, idx) => {
                        const category = getContentCategory(item)
                        if (category) {
                            return (
                                <button key={idx} className={styles.categoryCard} style={{ width: cardWidth }} onClick={() => navigateToCategory(category)}>
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt={item.name} />
                                    ) : (
                                        <div className={styles.placeholder}>
                                            <Icon id="folder" size={3} white />
                                        </div>
                                    )}
                                    <span className={styles.categoryName}>
                                        {item.name}
                                        {item.slideCount ? <span style={{ marginLeft: "10px", opacity: 0.5, fontSize: "0.9em" }}>{String(item.slideCount)}</span> : null}
                                    </span>
                                </button>
                            )
                        }
                        return (
                            <div key={idx} className={styles.card} style={{ width: listMode ? "100%" : `${100 / columns}%` }}>
                                <MediaCard credits={{}} name={item.name || ""} path={item.url} thumbnailPath={item.thumbnail || ""} type={item.type} shiftRange={[]} active="online" contentProvider={providerId} contentFileData={item} />
                            </div>
                        )
                    })}
                </div>
            ) : categories.length > 0 ? (
                <div className={`${styles.categories} ${listMode ? styles.list : ""}`}>
                    {filteredCategories.map((category, idx) => (
                        <button key={idx} className={styles.categoryCard} style={{ width: cardWidth }} onClick={() => navigateToCategory(category)}>
                            {category.thumbnail ? (
                                <img src={category.thumbnail} alt={category.name} />
                            ) : (
                                <div className={styles.placeholder}>
                                    <Icon id="folder" size={3} white />
                                </div>
                            )}
                            <span className={styles.categoryName}>{category.name}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <Center style={{ opacity: 0.2 }}>
                    <Icon id="noImage" size={5} white />
                </Center>
            )}
        </div>
    )
}
