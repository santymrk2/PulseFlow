import { useState } from "react"
import { get } from "../../../lib/store"
import { activeInteractions, interactions, openedInteractionId, shows } from "../../../stores"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { Link } from "../../ui/link/Link"
import { generateSlide } from "../../../components/drawer/pages/interactionSlides"
import { getInteraction } from "../../../components/drawer/pages/interactions"
import styles from "./InteractionsInfo.module.css"

// Port de components/drawer/pages/InteractionsInfo.svelte. `showExists` se lee una sola vez al montar, como el onMount original.
export function InteractionsInfo() {
    const openedId = useStore(openedInteractionId)
    const interactionsValue = useStore(interactions)
    const active = useStore(activeInteractions)
    const [showExists] = useState(() => !!get(shows)[`interaction-${openedId}`])

    const openedInteraction = interactionsValue[openedId] || null
    const isActive = active.includes(openedId)

    const interaction = isActive ? getInteraction(openedId) || null : null

    const url = interaction?.dbid ? `https://freeshow.net/interaction#id=${interaction.dbid}` : null
    const controllerUrl = interaction?.dbid && interaction?.dbsecret ? `https://freeshow.net/interaction_controller#id=${interaction.dbsecret}` : null

    return (
        <div className={styles.padding}>
            {openedId ? (
                <>
                    {openedInteraction?.inputs?.length ? (
                        <>
                            {url ? (
                                <div style={{ padding: "4px 2px", textAlign: "center", marginBottom: "10px", maxWidth: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                                    <Link url={url}>
                                        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{url.replace("https://", "")}</span>
                                        <Icon id="launch" white />
                                    </Link>
                                </div>
                            ) : null}

                            {/* Generate slides */}
                            {!isActive || !showExists ? (
                                <>
                                    <Button variant="outline" icon="slide" style={{ width: "100%", justifyContent: "left" }} onClick={() => generateSlide("join")} white>
                                        <T id="interaction.generate_slide" />: Join
                                    </Button>
                                    <Button variant="outline" icon="slide" style={{ width: "100%", justifyContent: "left" }} onClick={() => generateSlide("players")} white>
                                        <T id="interaction.generate_slide" />: Players
                                    </Button>
                                    <Button variant="outline" icon="slide" style={{ width: "100%", justifyContent: "left" }} onClick={() => generateSlide("question")} white>
                                        <T id="interaction.generate_slide" />: Question
                                    </Button>
                                    <Button variant="outline" icon="slide" style={{ width: "100%", justifyContent: "left" }} onClick={() => generateSlide("chart")} white>
                                        <T id="interaction.generate_slide" />: Chart
                                    </Button>
                                    <Button variant="outline" icon="slide" style={{ width: "100%", justifyContent: "left" }} onClick={() => generateSlide("leaderboard")} white>
                                        <T id="interaction.generate_slide" />: Leaderboard
                                    </Button>
                                </>
                            ) : null}
                        </>
                    ) : null}

                    {controllerUrl ? (
                        <>
                            <div style={{ flex: 1 }} />
                            <div style={{ padding: "4px 2px", textAlign: "center", marginTop: "10px", maxWidth: "100%", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "0.7em", opacity: 0.8 }}>
                                <Link url={controllerUrl}>
                                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{controllerUrl.replace("https://", "").replace(/id=[^&]+/g, "id=...")}</span>
                                    <Icon id="launch" size={0.8} white />
                                </Link>
                            </div>
                        </>
                    ) : null}
                </>
            ) : null}
        </div>
    )
}
