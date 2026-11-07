import { useEffect, useState, type CSSProperties, type UIEvent } from "react"
import { resetAudioRouting } from "../../audio/routing/audioRoutingInit"
import AudioRouting from "../../components/settings/tabs/AudioRouting.svelte"
import Tip from "../../components/main/Tip.svelte"
import { activePopup, dictionary, settingsTab } from "../../stores"
import { translateText } from "../../utils/language"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Connection } from "./Connection"
import { Files } from "./Files"
import { FilesButtons } from "./FilesButtons"
import { General } from "./General"
import { Other } from "./Other"
import { OtherButtons } from "./OtherButtons"
import { Profiles } from "./Profiles"
import { ProfilesButtons } from "./ProfilesButtons"
import { ProfilesTabs } from "./ProfilesTabs"
import styles from "./Settings.module.css"

// Port de components/settings/Settings.svelte (F24.12). AudioRouting sigue siendo Svelte hasta F24.13b; Connection y Profiles* son React (F24.13a).
const hints: Record<string, string> = {
    audio: "settings.audio_hint",
    profiles: "profile.profiles_hint",
    ai: "ai.hint<br><br>ai.privacy_details"
}

export function Settings() {
    const tabId = useStore(settingsTab)
    const dict = useStore(dictionary)

    const [scrolled, setScrolled] = useState(false)
    useEffect(() => {
        if (tabId === null) setScrolled(false)
    }, [tabId])

    function scroll(e: UIEvent<HTMLDivElement>) {
        setScrolled(e.currentTarget.scrollTop > 0)
    }

    return (
        <main className={styles.main}>
            <div className={styles.title} style={scrolled ? { boxShadow: "2px 2px 4px 5px rgb(0 0 0 / 0.1)" } : undefined}>
                <h2 className={styles.heading}>{translateText(`settings.${tabId}`, dict)}</h2>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {hints[tabId] ? <SvelteIsland component={Tip} props={{ type: "info", value: translateText(hints[tabId]), style: "opacity: 0.7;", hiddenText: true, white: true }} /> : null}

                    {tabId === "audio" ? <Button title="actions.reset" icon="reset" onClick={() => resetAudioRouting()} /> : tabId === "profiles" ? <ProfilesButtons /> : null}
                </div>
            </div>

            <div className={styles.scroll} style={tabId === "audio" ? ({ "--padding": "20px" } as CSSProperties) : undefined} onScroll={scroll}>
                {tabId === "general" ? (
                    <>
                        <General />
                        <div style={{ marginTop: "16px" }}>
                            <Button variant="default" size="sm" onNativeClick={() => activePopup.set("screen_config")}>
                                {translateText("screen_config.configure")}
                            </Button>
                        </div>
                    </>
                ) : tabId === "audio" ? (
                    <SvelteIsland component={AudioRouting} />
                ) : tabId === "connection" ? (
                    <Connection />
                ) : tabId === "files" ? (
                    <Files />
                ) : tabId === "profiles" ? (
                    <Profiles />
                ) : tabId === "other" ? (
                    <Other />
                ) : null}
            </div>

            <div className={styles.tabs}>{tabId === "files" ? <FilesButtons /> : tabId === "profiles" ? <ProfilesTabs /> : tabId === "other" ? <OtherButtons /> : null}</div>
        </main>
    )
}
