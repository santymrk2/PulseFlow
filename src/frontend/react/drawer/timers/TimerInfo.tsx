import { activeTimers } from "../../../shared/core/stores"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import styles from "./TimerInfo.module.css"

// Port de components/drawer/timers/TimerInfo.svelte: botón para pausar o reanudar todos los temporizadores activos.
export function TimerInfo() {
    const timers = useStore(activeTimers)

    // $: if ($activeTimers?.length > 1) checkPaused()
    const allPaused = timers.length > 1 ? timers.filter((timer) => !timer.paused).length === 0 : false

    function actionOnAllTimers(key: string, value: boolean) {
        activeTimers.update((a) =>
            a.map((timer) => {
                timer[key] = value
                return timer
            })
        )
    }

    return (
        <main className={styles.main}>
            {timers.length > 1 ? (
                <Button onClick={() => actionOnAllTimers("paused", !allPaused)}>
                    <Icon id={allPaused ? "play" : "pause"} white={allPaused} size={1.2} right />
                    <T id={allPaused ? "media.play" : "actions.pause_timers"} />
                </Button>
            ) : null}
        </main>
    )
}
