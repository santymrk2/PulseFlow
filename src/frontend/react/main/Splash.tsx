import { useEffect, useState } from "react"
import { activePopup, activeProject, projects, projectView, quickSearchActive, showRecentlyUsedProjects, shows, special, version } from "../../stores"
import { translateText } from "../../utils/language"
import { history } from "../../components/helpers/history"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { Link } from "../ui/link/Link"
import { getVOTD } from "../../components/main/votd"
import styles from "./Splash.module.css"

function extractLinksAndCleanText(text: string): { text: string; links: string[] } {
    const links: string[] = []

    const textWithoutATags = text.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>.*?<\/a>/gi, (_match, url: string) => {
        links.push(url)
        return ""
    })

    const finalText = textWithoutATags.replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
        links.push(url)
        return ""
    })

    return { text: finalText.replaceAll("\n", "<br>").replace(/\s+/g, " ").trim(), links }
}

export function Splash() {
    const projectsValue = useStore(projects)
    const activeProjectId = useStore(activeProject)
    const showsValue = useStore(shows)
    const specialValue = useStore(special)
    const versionValue = useStore(version)
    const [votd, setVotd] = useState("")

    function createProject() {
        if (projectsValue[activeProjectId || ""]?.shows?.length === 0) {
            activeProject.set(null)
            projectView.set(true)
        }

        history({ id: "UPDATE", location: { page: "show", id: "project" } })
        showRecentlyUsedProjects.set(false)
    }

    useEffect(() => {
        if (specialValue.splashText) return
        let cancelled = false
        void getVOTD().then((text) => {
            if (!cancelled) setVotd(text)
        })
        return () => {
            cancelled = true
        }
    }, [specialValue.splashText])

    const splash = specialValue.splashText ? extractLinksAndCleanText(specialValue.splashText) : null

    return (
        <div className={`${styles.center} context #splash`}>
            <div className={styles.brand}>
                <img className={styles.brandLogo} src="./logo-pulseflow.png" alt="" draggable={false} />
                <span className={styles.brandName}>PulseFlow</span>
            </div>
            <p style={{ opacity: 0.7 }}>v{versionValue}</p>

            {specialValue.splashText ? (
                <p style={{ paddingTop: "30px" }}>
                    <span dangerouslySetInnerHTML={{ __html: splash?.text || "" }} />
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        {(splash?.links || []).map((link) => (
                            <Link key={link} url={link}>
                                {link.replace(/^(https?:\/\/)/, "")}
                                <Icon id="launch" white />
                            </Link>
                        ))}
                    </span>
                </p>
            ) : Object.keys(showsValue).length < 20 ? (
                <p style={{ paddingTop: "30px" }}>
                    <Link url="https://freeshow.app/docs">
                        <T id="main.docs" />
                        <Icon id="launch" white />
                    </Link>
                </p>
            ) : votd ? (
                <p className={styles.votd} style={{ paddingTop: "30px" }} data-title="Verse of the Day [votd.org]">
                    <Link url="https://votd.org/">{votd}</Link>
                </p>
            ) : null}

            <span style={{ paddingTop: "30px" }} className={styles.buttons}>
                <Button variant="secondary" className={styles.wide} title={translateText("main.quick_search")} onClick={() => quickSearchActive.set(true)}>
                    <Icon id="search" size={1} />
                    <T id="main.quick_search" />
                </Button>
                <Button variant="secondary" className={styles.wide} title={translateText("tooltip.project")} onClick={() => createProject()}>
                    <Icon id="project" size={1} />
                    <T id="new.project" />
                </Button>
                <Button
                    variant="secondary"
                    className={styles.wide}
                    title={translateText("tooltip.show")}
                    onClick={(detail) => {
                        if (detail.ctrl) {
                            history({ id: "UPDATE", newData: { remember: { project: activeProjectId } }, location: { page: "show", id: "show" } })
                        } else activePopup.set("show")
                    }}
                >
                    <Icon id="add" size={1} />
                    <T id="new.show" />
                </Button>
            </span>
        </div>
    )
}
