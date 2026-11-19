import { useState } from "react"
import type { Show } from "../../../types/Show"
import { Main } from "../../../types/IPC/Main"
import { syncCanvaShow } from "../../converters/canvaPresentation"
import { sendMain } from "../../shared/core/ipc/main"
import { activeDrawerTab, activeShow, drawer, labelsDisabled, openedInteractionId, openScripture, scriptures, shows } from "../../shared/core/stores"
import { createSlides, getDateString, getSelectedEvents, sortDays } from "../drawer/logic/calendar/calendar"
import { history } from "../../shared/utils/helpers/history"
import { setDrawerTabData } from "../../shared/utils/helpers/historyHelpers"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./Reference.module.css"

export interface ReferenceProps {
    showId: string
    show: Show
}

// (F24.18b).
export function Reference({ showId, show }: ReferenceProps) {
    const currentActiveShow = useStore(activeShow)
    const currentDrawer = useStore(drawer)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentScriptures = useStore(scriptures)
    const currentShows = useStore(shows)
    const [syncingCanva, setSyncingCanva] = useState(false)

    const data = show?.reference?.data || {}

    async function updateCalendar() {
        const currentEvents = getSelectedEvents(data.days)
        const targetShowId = currentActiveShow?.id || ""
        const slidesData = await createSlides(currentEvents, targetShowId)
        history({ id: "UPDATE", newData: { data: slidesData.show }, oldData: { id: targetShowId }, location: { page: "show", id: "show_key" } })
    }

    function getDaysString() {
        const { sortedDays, from, to } = sortDays(data.days)
        let string = getDateString(from)
        if (sortedDays[0] - sortedDays[1] < 0) string += " - " + getDateString(to)
        return string
    }

    function openTab() {
        const collection = data.collection
        if (!collection || !show) return

        const scriptureId = currentScriptures[collection] ? collection : Object.values(currentScriptures).find((a) => a.id === collection)
        if (!scriptureId) return

        openScripture.set(show.reference!.data)

        setDrawerTabData("scripture", collection)
        activeDrawerTab.set("scripture")

        if (currentDrawer.height <= 40) drawer.set({ height: currentDrawer.stored || 300, stored: null })
    }

    function openInteraction() {
        openedInteractionId.set(data.id)

        setDrawerTabData("functions", "interactions")
        activeDrawerTab.set("functions")

        if (currentDrawer.height <= 40) drawer.set({ height: currentDrawer.stored || 300, stored: null })
    }

    function openURL(url: string) {
        sendMain(Main.URL, url)
    }

    function removeMarkdownURL(text: string) {
        return text.replace(/\[([^\]]+)\][^)]+\)/g, "$1")
    }

    async function refreshCanva() {
        if (syncingCanva) return
        setSyncingCanva(true)
        await syncCanvaShow(showId)
        setSyncingCanva(false)
    }

    const buttonStyle = { whiteSpace: "nowrap", minWidth: "100px" }

    return (
        <div className={styles.root}>
            {show?.reference?.type === "calendar" ? (
                <>
                    <p>
                        <T id="menu.calendar" />: {getDaysString()}
                        {data.show && currentShows[data.show] ? ` + ${currentShows[data.show].name}` : null}
                    </p>
                    <div />
                    <Button style={buttonStyle} onClick={() => updateCalendar()}>
                        <Icon id="calendar" />
                        {!currentLabelsDisabled ? <T id="show.update" /> : null}
                    </Button>
                </>
            ) : show?.reference?.type === "scripture" ? (
                <>
                    <p data-title={data.version || ""}>
                        <T id="tabs.scripture" />: {data.version || ""}
                    </p>
                    <div />
                    <Button style={buttonStyle} onClick={() => openTab()}>
                        <Icon id="scripture" />
                        {!currentLabelsDisabled ? <T id="main.open" /> : null}
                    </Button>
                </>
            ) : show?.reference?.type === "lessons" ? (
                <>
                    <p>
                        {data.studyName ? (
                            <>
                                {data.studyName}
                                {data.about ? ":" : null}
                            </>
                        ) : null}
                        {data.about ? (
                            <span style={{ fontSize: "0.8em", opacity: 0.8 }} data-title={removeMarkdownURL(data.about)}>
                                {removeMarkdownURL(data.about)}
                            </span>
                        ) : null}
                    </p>
                    <div />
                    <Button title="Open Lessons.church Website" style={{ whiteSpace: "nowrap", minWidth: "150px" }} onClick={() => openURL("https://lessons.church")}>
                        <Icon id="book" />
                        Lessons.church
                    </Button>
                </>
            ) : show?.reference?.type === "canva" ? (
                <>
                    <p>Canva: {data.presentationName || show.name || ""}</p>
                    <div />
                    <Button title="show.update" icon="refresh" disabled={syncingCanva} onClick={() => refreshCanva()}>
                        <T id="show.update" />
                    </Button>
                </>
            ) : show?.reference?.type === "interaction" ? (
                <>
                    <p>
                        <T id="tabs.interactions" />: {data.name || ""}
                    </p>
                    <div />
                    <Button title="main.open" onClick={() => openInteraction()}>
                        <Icon id="game" />
                        {!currentLabelsDisabled ? <T id="main.open" /> : null}
                    </Button>
                </>
            ) : null}
        </div>
    )
}
