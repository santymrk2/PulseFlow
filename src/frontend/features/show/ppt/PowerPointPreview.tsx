import { useEffect, useRef, useState } from "react"
import type { ShowRef } from "../../../../types/Projects"
import { Main } from "../../../../types/IPC/Main"
import { requestMain, sendMain } from "../../../shared/core/ipc/main"
import { activeShow, os, outLocked, outputs, presentationApps, presentationData, special } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { getFileName, removeExtension } from "../../../shared/utils/helpers/media"
import { getActiveOutputs, getOutputContent, setOutput } from "../../../shared/utils/helpers/output"
import { clearBackground, clearSlide } from "../../../components/output/clear"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { T } from "../../../shared/ui/helpers/T"
import { Button } from "../../../shared/ui/kit/button/Button"
import { Dropdown } from "../../../shared/ui/kit/dropdown/Dropdown"
import { Center } from "../../../shared/ui/system/Center"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { ScreenCapture } from "./ScreenCapture"
import styles from "./PowerPointPreview.module.css"

export interface PowerPointPreviewProps {
    show: ShowRef
}

interface Slide {
    id?: string
    [key: string]: unknown
}

interface PresentationStat {
    position: number
    slides: number
}

// (F24.20a). `<svelte:window on:keydown>` → listener de window.
export function PowerPointPreview({ show }: PowerPointPreviewProps) {
    const currentApps = useStore(presentationApps)
    const currentPresentationData = useStore(presentationData)
    const currentOutputs = useStore(outputs)
    const currentSpecial = useStore(special)
    const currentActiveShow = useStore(activeShow)
    const currentOs = useStore(os)
    const locked = useStore(outLocked)
    const [opening, setOpening] = useState(false)
    const [retry, setRetry] = useState(false)
    const [outSlide, setOutSlide] = useState<Slide | null>(() => getOutputContent("", currentOutputs) as Slide)
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    function reset() {
        setOpening(false)
        setRetry(false)
    }

    useEffect(() => {
        requestMain(Main.SLIDESHOW_GET_APPS, undefined, (apps) => presentationApps.set((apps as string[]) || []))
        return () => {
            if (retryTimeout.current) clearTimeout(retryTimeout.current)
            if (currentActiveShow?.type !== "ppt") sendMain(Main.PRESENTATION_CONTROL, { action: "stop" })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setOutSlide(getOutputContent("", currentOutputs) as Slide)
    }, [currentOutputs])

    function newPresentation() {
        if (locked) return
        reset()
        setOpening(true)
        sendMain(Main.START_SLIDESHOW, { path: show.id, program: currentSpecial.presentationApp || "PowerPoint" })
        clearSlide()
        retryTimeout.current = setTimeout(() => {
            if (opening) setRetry(true)
        }, 8000)
    }

    function start() {
        const name = show.name || removeExtension(getFileName(show.id))
        const stat = currentPresentationData.stat as PresentationStat
        setOutput("slide", { type: "ppt", id: show.id, name, page: stat.position - 1, pages: stat.slides })
        const outputId = getActiveOutputs(currentOutputs, false, true, true)[0]
        setOutSlide((currentOutputs[outputId]?.out?.slide || null) as Slide | null)
        clearBackground()
        reset()
    }

    useEffect(() => {
        if (opening && currentPresentationData?.id === show.id) start()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opening, currentPresentationData])

    function keydown(event: globalThis.KeyboardEvent) {
        if (locked || !currentApps?.length) return
        if (event.key !== " ") return
        event.preventDefault()
        if (outSlide?.id === show.id) sendMain(Main.PRESENTATION_CONTROL, { action: "next" })
        else if (!opening) newPresentation()
    }

    useEffect(() => {
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locked, currentApps, outSlide, opening, show.id])

    function restartPresentation() {
        presentationData.set({})
        newPresentation()
    }

    if (currentApps === null) {
        return (
            <Center faded>
                <T id="remote.loading" />
            </Center>
        )
    }
    if (!currentApps.length) {
        return (
            <Center>
                <T id="presentation_control.unsupported" />
                {currentOs.platform || "this OS"}.
                <br />
                <T id="presentation_control.unsupported_tip" />
            </Center>
        )
    }
    if (outSlide?.id === show.id) {
        return (
            <>
                <div className={styles.fill}>
                    <ScreenCapture path={show.id} />
                </div>
                {currentPresentationData?.id === show.id && currentPresentationData?.stat?.slides ? (
                    <div className={styles.info}>
                        <Button align="start" onClick={restartPresentation} title={translateText("presentation_control.restart")}>
                            <Icon id="refresh" />
                        </Button>
                        <p style={{ whiteSpace: "normal", overflow: "auto", padding: "3px 8px" }}>
                            <b>{currentPresentationData.info?.titles?.[currentPresentationData.stat.position - 1] || ""}</b>
                            <span style={{ paddingInlineStart: 10 }}>{currentPresentationData.info?.notes?.[currentPresentationData.stat.position - 1] || ""}</span>
                        </p>
                    </div>
                ) : null}
            </>
        )
    }
    if (opening) {
        return (
            <Center>
                <p>
                    <T id="presentation_control.opening" />
                </p>
                {retry ? (
                    <>
                        <br />
                        <T id="presentation_control.retry" />
                        <Button align="start" onClick={newPresentation} style={{ marginTop: 8 }}>
                            <T id="presentation_control.try_again" />
                        </Button>
                    </>
                ) : null}
            </Center>
        )
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Dropdown
                options={currentApps.map((id) => ({ name: id }))}
                value={currentSpecial.presentationApp || "PowerPoint"}
                onClick={(option) =>
                    special.update((state) => {
                        state.presentationApp = option.name
                        return state
                    })
                }
            />
            <div className={styles.fill}>
                <Button onClick={newPresentation} style={{ fontSize: "4em", width: "100%" }}>
                    <Icon id="play" size={6} right />
                    <T id="presentation_control.start" />
                </Button>
            </div>
        </div>
    )
}
