import { OUTPUT } from "../../../../types/Channels"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../IPC/main"
import { drawerTabsData, photoApiCredits, playerVideos, providerConnections } from "../../../stores"
import { send } from "../../../utils/request"
import { getAllNormalOutputs } from "../../../components/helpers/output"
import { useStore } from "../../hooks/useStore"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { Link } from "../../ui/link/Link"
import { CanvaInfo } from "./CanvaInfo"
import { InfoMetadata, type InfoMetadataEntry } from "./InfoMetadata"
import styles from "./PlayerInfo.module.css"

// Port de components/drawer/info/PlayerInfo.svelte.
export interface PlayerInfoProps {
    optionsOpen: boolean
}

export function PlayerInfo({ optionsOpen }: PlayerInfoProps) {
    const tabsData = useStore(drawerTabsData)
    const credits = useStore(photoApiCredits)
    const videos = useStore(playerVideos)
    const connections = useStore(providerConnections)
    const active = tabsData.media?.openedSubSubTab?.online || "youtube"

    const info: InfoMetadataEntry[] = [
        { label: "info.likes", value: credits.likes },
        { label: "info.artist", value: credits.artist },
        { label: "info.artistUrl", value: credits.artistUrl, type: "url" },
        { label: "info.photoUrl", value: credits.photoUrl, type: "url" }
    ]

    const isPlayingYoutube = getAllNormalOutputs().find((output) => {
        const bg = output.out?.background
        return bg?.type === "player" && videos[bg?.id || ""]?.type === "youtube"
    })

    function canvaDisconnect() {
        requestMain(Main.PROVIDER_DISCONNECT, { providerId: "canva" }, (result) => {
            if (result?.success) {
                providerConnections.update((c) => {
                    c.canva = false
                    return c
                })
            }
        })
    }

    if (active === "youtube") {
        return (
            <>
                {isPlayingYoutube ? (
                    <>
                        <div className={styles.scroll}>
                            <T id="error.video_unavailable" />
                        </div>
                        <Button icon="close" onClick={() => send(OUTPUT, ["CLOSE_AD"])}>
                            <T id="inputs.close_ad" />
                        </Button>
                    </>
                ) : null}
            </>
        )
    }

    if (active === "canva") {
        return optionsOpen ? (
            <div className={styles.scroll}>
                {connections.canva ? (
                    <Button variant="outline" icon="logout" onClick={canvaDisconnect}>
                        <T id="settings.disconnect_from" replace={["Canva"]} />
                    </Button>
                ) : null}
            </div>
        ) : (
            <CanvaInfo />
        )
    }

    if (active === credits.type && credits.photo !== undefined) {
        return (
            <>
                <div style={{ flex: 1, marginBottom: "25px" }}>
                    <InfoMetadata title={credits.photo} info={info} />
                </div>
                <div className={styles.credits}>
                    Photo by <Link url={credits.artistUrl}>{credits.artist}</Link> on{" "}
                    <span style={{ textTransform: "capitalize" }}>
                        <Link url={credits.homepage || credits.photoUrl}>{credits.type}</Link>
                    </span>
                </div>
            </>
        )
    }

    return null
}
