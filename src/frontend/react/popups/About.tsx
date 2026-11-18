import type { CSSProperties } from "react"
import { activePopup, version } from "../../stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Link } from "../ui/link/Link"
import styles from "./About.module.css"

// Port de components/main/popups/About.svelte. Escribe: activePopup ("update_manager"). Lee: version.
const assets: { name: string; url: string; title?: string }[] = [
    { name: "CMG Sans (Custom font)", url: "https://www.churchmotiongraphics.com/cmg-sans/" },
    { name: "Google Fonts (Icons)", url: "https://fonts.google.com/icons/" },
    { name: "Icons8 (Icons)", url: "https://icons8.com/" },
    { name: "Pixabay (Web Images)", url: "https://pixabay.com/" },
    { name: "Unsplash (Web Images)", url: "https://unsplash.com/" },
    { name: "Electron (Cross-platform desktop apps)", url: "https://www.electronjs.org/" },
    { name: "React (DOM framework)", url: "https://react.dev/" },
    { name: "Rollup (Module bundler)", url: "https://rollupjs.org/" },
    { name: "Socket.io (LAN connections)", url: "https://socket.io/" },
    { name: "Express (Web framework)", url: "https://expressjs.com/" },
    { name: "NDI® SDK (IP-streaming)", url: "https://ndi.video/", title: "NDI® is a registered trademark of Vizrt NDI AB." },
    { name: "Blackmagic Design® (Local output)", url: "https://www.blackmagicdesign.com/", title: "Blackmagic Design is a registered trademark of Blackmagic Design Pty. Ltd." },
    { name: "CAPTION.Ninja (Live captions)", url: "https://caption.ninja/" },
    { name: "Google Translate (Localization)", url: "https://translate.google.com/" }
]

const checkUpdatesStyle: CSSProperties = { marginLeft: "5px", display: "inline-flex", minHeight: 0, padding: "0 5px", verticalAlign: "baseline" }

export function About() {
    const versionValue = useStore(version)

    return (
        <>
            <div style={{ textAlign: "center" }}>
                <div className={styles.logo}>
                    <img style={{ height: "35px" }} src="./import-logos/pulse.svg" alt="PulseFlow-logo" draggable={false} />
                    <h1 style={{ color: "var(--text)", fontSize: "1.7em" }}>PulseFlow</h1>
                </div>

                <p style={{ fontSize: "0.8em", marginTop: "2px" }}>
                    <span style={{ opacity: 0.8 }}>v{versionValue}</span>
                    <Button variant="outline" style={checkUpdatesStyle} onClick={() => activePopup.set("update_manager")} white>
                        <T id="about.check_updates" />
                    </Button>
                </p>
            </div>

            <hr className={styles.rule} />

            <div className={styles.main}>
                <div>
                    <div>
                        • <T id="about.report" /> <Link url="https://github.com/santymrk2/PulseFlow/issues">GitHub Issues</Link>
                    </div>
                </div>

                <hr className={styles.rule} />

                <div>
                    <h5 className={styles.title}>
                        <T id="about.assets" />
                    </h5>

                    <div className={styles.links}>
                        {assets.map((asset) => (
                            <span key={asset.url} data-title={asset.title}>
                                • <Link url={asset.url}>{asset.name}</Link>
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ textAlign: "center", fontSize: "0.7em", opacity: 0.5, marginTop: "12px" }}>
                    <T id="about.made" /> Kristoffer Vassbø (2021)
                </div>
            </div>
        </>
    )
}
