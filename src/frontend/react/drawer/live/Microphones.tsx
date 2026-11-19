import { useEffect, useState } from "react"
import { AudioMicrophone } from "../../../audio/audioMicrophone"
import { T } from "../../../shared/ui/helpers/T"
import { Center } from "../../../shared/ui/system/Center"
import { SelectElem } from "../../../shared/ui/system/SelectElem"
import { Mic } from "./Mic"
import styles from "./Microphones.module.css"

interface Mics {
    [group: string]: { [id: string]: string }
}

// Port de components/drawer/live/Microphones.svelte.
export function Microphones() {
    const [mics, setMics] = useState<Mics>({})

    useEffect(() => {
        let alive = true
        AudioMicrophone.getList()?.then((devices) => {
            if (!alive) return
            const next: Mics = {}
            devices?.forEach((device) => {
                if (!next[device.groupId]) next[device.groupId] = {}
                next[device.groupId][device.deviceId] = device.label
            })
            setMics(next)
        })
        return () => {
            alive = false
        }
    }, [])

    if (!Object.values(mics).length) {
        return (
            <Center faded>
                <T id="empty.general" />
            </Center>
        )
    }

    return (
        <div className={styles.row} style={{ gap: 10 }}>
            {Object.values(mics).map((group, index) => (
                <div key={index} className={styles.row}>
                    {Object.entries(group).map(([id, name]) => (
                        <SelectElem key={id} id="microphone" data={{ id, type: "microphone", name }} draggable>
                            <Mic mic={{ id, name }} />
                        </SelectElem>
                    ))}
                </div>
            ))}
        </div>
    )
}
