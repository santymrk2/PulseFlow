import { useEffect, useState } from "react"
import { activeShow, focusMode, forceClock } from "../../../stores"
import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { Clock } from "../../system/Clock"
import { Date } from "../../system/Date"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { AudioInfo } from "./AudioInfo"
import { CalendarInfo } from "./CalendarInfo"
import { FunctionsInfo } from "./FunctionsInfo"
import { MediaInfo } from "./MediaInfo"
import { ScriptureInfo } from "./ScriptureInfo"
import { ShowInfo } from "./ShowInfo"
import { TemplateInfo } from "./TemplateInfo"
import styles from "./Info.module.css"

// Port de components/drawer/info/Info.svelte. Clock y Date son ports React (F24.18a).
export interface InfoProps {
    id: string
}

const HAS_OPTIONS = ["shows", "media", "templates", "scripture", "calendar"]

export function Info({ id }: InfoProps) {
    const show = useStore(activeShow)
    const focus = useStore(focusMode)
    const clock = useStore(forceClock)
    const [optionsOpen, setOptionsOpen] = useState(false)

    // `$: if (id) optionsOpen = false`
    useEffect(() => setOptionsOpen(false), [id])

    return (
        <div className={cn(styles.root, "main", id !== "shows" || show !== null ? "context #drawer_info" : "")}>
            {!clock && id === "shows" ? (
                <ShowInfo optionsOpen={optionsOpen} />
            ) : !clock && id === "media" ? (
                <MediaInfo optionsOpen={optionsOpen} />
            ) : !clock && id === "audio" ? (
                <AudioInfo />
            ) : !clock && id === "templates" ? (
                <TemplateInfo optionsOpen={optionsOpen} />
            ) : !clock && id === "scripture" ? (
                <ScriptureInfo optionsOpen={optionsOpen} />
            ) : !clock && id === "calendar" ? (
                <CalendarInfo optionsOpen={optionsOpen} />
            ) : !clock && id === "functions" ? (
                <FunctionsInfo />
            ) : (
                <Center>
                    <Clock />
                    <Date />
                </Center>
            )}

            {!clock && HAS_OPTIONS.includes(id) && !focus ? (
                <FloatingBar round>
                    <Button isActive={optionsOpen} title="edit.options" onClick={() => setOptionsOpen(!optionsOpen)}>
                        <Icon size={1.1} id="options" white={!optionsOpen} />
                    </Button>
                </FloatingBar>
            ) : null}
        </div>
    )
}
