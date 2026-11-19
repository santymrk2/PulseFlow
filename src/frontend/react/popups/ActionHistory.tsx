import { getDateAndTimeString, timeAgo } from "../../components/helpers/time"
import { actionHistory } from "../../shared/core/stores"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { Center } from "../system/Center"
import styles from "./ActionHistory.module.css"

// Port de components/main/popups/ActionHistory.svelte. Lee y escribe: actionHistory (borrar lo deja en []).
export function ActionHistory() {
    const history = useStore(actionHistory)

    return (
        <>
            <Button className="popup-options" icon="delete" title="actions.clear_history" disabled={!history.length} onClick={() => actionHistory.set([])} white />

            <main className={styles.history}>
                {history.length ? (
                    <div className={styles.list}>
                        {history.map((item, index) => (
                            // sin id propio: el Svelte tampoco tenía key, se usa la posición
                            <p key={index} style={{ padding: "5px 20px" }}>
                                <span>
                                    {item.action[0].toUpperCase() + item.action.slice(1).replaceAll("_", " ")}
                                    {item.count > 1 ? <span style={{ opacity: 0.5 }}>({item.count})</span> : null}
                                    {item.source ? <span className={styles.sourceBadge}>{item.source}</span> : null}
                                </span>
                                <span className={styles.time} data-title={getDateAndTimeString(item.time || 0)}>
                                    {timeAgo(item.time || 0)}
                                </span>
                            </p>
                        ))}
                    </div>
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </main>
        </>
    )
}
