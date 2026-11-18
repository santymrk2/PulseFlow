import { useEffect, useState } from "react"
import type { ContentFile, ContentLibraryCategory } from "../../../../types/ContentProvider"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import { activeCanvaPresentation, mediaOptions, providerConnections } from "../../../stores"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { Center } from "../../system/Center"
import { Link } from "../../ui/link/Link"
import { TextField } from "../../ui/text-field/TextField"
import { useStore } from "../../hooks/useStore"
import { CLogo } from "./CLogo"
import { ContentLibraryBrowser } from "./ContentLibraryBrowser"
import styles from "./Canva.module.css"

// Port de components/drawer/media/Canva.svelte.
export function Canva() {
    const connections = useStore(providerConnections)
    const mediaOptionsValue = useStore(mediaOptions)

    const [canvaClientId, setCanvaClientId] = useState("")
    const [canvaClientSecret, setCanvaClientSecret] = useState("")
    const [currentCategory, setCurrentCategory] = useState<ContentLibraryCategory | null>(null)

    useEffect(() => {
        if (!connections.canva) {
            sendMain(Main.PROVIDER_STARTUP_LOAD, { providerId: "canva", scope: "folder:read design:content:read design:meta:read" })
        }
    }, [])

    useEffect(() => {
        return () => {
            activeCanvaPresentation.set(null)
        }
    }, [])

    function handleConnect() {
        sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "canva", data: { canvaClientId, canvaClientSecret } })
    }

    function getPresentationData(category: ContentLibraryCategory | null) {
        const key = category?.key || ""
        if (!key.startsWith("presentation:")) return null
        const designId = key.replace("presentation:", "")
        if (!designId) return null
        return {
            designId,
            presentationName: category?.name || "Untitled presentation",
            slideCount: (category as ContentLibraryCategory & { slideCount?: number })?.slideCount,
            thumbnail: category?.thumbnail,
            providerId: "canva" as const
        }
    }

    function getContentCategory(item: ContentFileWithExtras) {
        // item typed loosely
        const anyItem = item as { isFolder?: boolean; mediaId?: string; name?: string; thumbnail?: string; isPresentation?: boolean; slideCount?: number }
        if (anyItem.isFolder && anyItem.mediaId) {
            return {
                name: anyItem.name || "Folder",
                thumbnail: anyItem.thumbnail,
                key: anyItem.mediaId
            } as ContentLibraryCategory
        }
        if (!anyItem.isPresentation || !anyItem.mediaId) return null
        return {
            name: anyItem.name || "Untitled presentation",
            thumbnail: anyItem.thumbnail,
            slideCount: anyItem.slideCount,
            key: `presentation:${anyItem.mediaId}`
        } as ContentLibraryCategory & { slideCount?: number }
    }

    useEffect(() => {
        activeCanvaPresentation.set(getPresentationData(currentCategory))
    }, [currentCategory])

    type ContentFileWithExtras = ContentFile & { [key: string]: unknown }

    if (connections.canva) {
        return (
            <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                    <ContentLibraryBrowser providerId="canva" columns={mediaOptionsValue.columns} onCurrentCategoryChange={setCurrentCategory} getContentCategory={getContentCategory} />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.gridgap}>
            <Center style={{ flexDirection: "column" }}>
                <Link url="https://freeshow.app/docs/media#connecting-to-canva">
                    <T id="main.docs" />
                    <Icon id="launch" white />
                </Link>

                <TextField label="Client ID" value={canvaClientId} onChange={(v) => setCanvaClientId(v ?? "")} style={{ marginTop: "20px", width: "100%", maxWidth: "250px" }} pasteBtn />
                <TextField label="Client secret" value={canvaClientSecret} disabled={!canvaClientId} type="password" onChange={(v) => setCanvaClientSecret(v ?? "")} style={{ width: "100%", maxWidth: "250px" }} pasteBtn />

                <Button variant="outline" disabled={!canvaClientId || !canvaClientSecret} onClick={handleConnect} style={{ marginTop: "10px", width: "100%", maxWidth: "250px" }}>
                    <CLogo />
                    <T id="settings.connect_to" replace={["Canva"]} />
                </Button>
            </Center>
        </div>
    )
}
