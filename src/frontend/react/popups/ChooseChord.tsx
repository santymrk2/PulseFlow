import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { chordTensions, chordTypes, keys, keysInverted, romanKeys } from "../../components/edit/values/chords"
import { popupData, special, storedChordsData } from "../../shared/core/stores"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./ChooseChord.module.css"

// Port de components/main/popups/ChooseChord.svelte. Lee: storedChordsData (al montar) y special.germanNotation.
// Escribe: storedChordsData en cada cambio (no al montar sin datos guardados), special.germanNotation, y popupData = { id: "choose_chord", value } al elegir.
interface ChordData {
    key: string
    romanKey: string
    type: string
    tension: string
    bass: string
    custom: string | null
    romanKeysActive: boolean
}
type ChordField = "key" | "romanKey" | "type" | "tension" | "bass"

const DEFAULT_CHORD: ChordData = { key: "C", romanKey: "I", type: "", tension: "", bass: "C", custom: "", romanKeysActive: false }

function loadChord(): { data: ChordData; fromStore: boolean } {
    const stored = get(storedChordsData)
    if (stored?.key) return { data: stored, fromStore: true }
    if (stored?.romanKeysActive) return { data: { ...DEFAULT_CHORD, romanKeysActive: true }, fromStore: true }
    return { data: DEFAULT_CHORD, fromStore: false }
}

function combineChord(chordData: ChordData): string {
    if (chordData.custom) return chordData.custom

    const bassKey = chordData.bass !== chordData.key ? "/" + chordData.bass : ""
    if (chordData.romanKeysActive) return chordData.romanKey + chordData.type + chordData.tension
    return chordData.key + chordData.type + chordData.tension + bassKey
}

export function ChooseChord() {
    const [initial] = useState(loadChord)
    const [chordData, setChordData] = useState<ChordData>(initial.data)
    const [showInvertedChords, setShowInvertedChords] = useState(false)
    const [showMore, setShowMore] = useState(false)
    const specialValue = useFreshStore(special)

    // El Svelte sólo guardaba tras cargar datos o al editar: sin datos guardados, el primer efecto no escribe
    const skipWrite = useRef(!initial.fromStore)
    useEffect(() => {
        if (skipWrite.current) {
            skipWrite.current = false
            return
        }
        storedChordsData.set(chordData)
    }, [chordData])

    function updateData(key: ChordField, value: string) {
        setChordData((previous) => {
            const next = { ...previous }
            // set bass note to same as key if not changed or clicking on the active key
            if (key === "key" && (previous.bass === previous[key] || previous[key] === value)) next.bass = value
            // reset to no value if clicking on the active value
            const newValue = (key === "type" || key === "tension") && previous[key] === value ? "" : value

            next[key] = newValue
            return next
        })
    }

    const combinedChord = combineChord(chordData)

    function selectChord() {
        popupData.set({ id: "choose_chord", value: combinedChord })
    }

    // German Notation

    const germanNotation = !!specialValue?.germanNotation
    function updateSpecial(key: string, value: boolean) {
        special.update((s) => {
            s[key] = value
            return s
        })
    }

    const keysList = (showInvertedChords ? keysInverted : keys).map((a) => (germanNotation ? (a === "B" ? "H" : a === "B♭" ? "B" : a) : a))

    const toggleInverted = () => setShowInvertedChords(!showInvertedChords)
    const invertedIcon = <Icon id={`arrow_${showInvertedChords ? "up" : "down"}`} size={1.1} white={!showInvertedChords} />

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            <ToggleField label="actions.roman_keys" checked={chordData.romanKeysActive} onChange={(value) => setChordData({ ...chordData, romanKeysActive: value })} />
            {showMore ? <ToggleField label="German notation (H/B)" checked={germanNotation} onChange={(value) => updateSpecial("germanNotation", value)} /> : null}

            <TextField label="actions.custom_key" value={chordData.custom ?? ""} defaultValue="" onInput={(value) => setChordData({ ...chordData, custom: value })} />

            <div className={styles.chords} style={{ margin: "10px 0" }}>
                <div className={styles.list}>
                    {chordData.romanKeysActive ? (
                        <>
                            <p>
                                <T id="actions.chord_key" />
                            </p>
                            {romanKeys.map((key) => (
                                <Button key={key} showOutline={chordData.romanKey === key} disabled={!!chordData.custom} onClick={() => updateData("romanKey", key)}>
                                    {key}
                                </Button>
                            ))}
                        </>
                    ) : (
                        <>
                            <p className={styles.invert} onMouseDown={toggleInverted}>
                                {invertedIcon}
                                <T id="actions.chord_key" />
                            </p>
                            {keysList.map((key) => (
                                <Button key={key} showOutline={chordData.key === key} disabled={!!chordData.custom} onClick={() => updateData("key", key)}>
                                    {key}
                                </Button>
                            ))}
                        </>
                    )}
                </div>

                <div className={styles.list}>
                    <p>
                        <T id="actions.chord_type" />
                    </p>
                    {chordTypes.map((type) => (
                        <Button key={type} showOutline={chordData.type === type} disabled={!!chordData.custom} onClick={() => updateData("type", type)}>
                            {!type ? <span style={{ opacity: 0 }}>.</span> : type}
                        </Button>
                    ))}
                </div>

                <div className={styles.list}>
                    <p>
                        <T id="actions.chord_tension" />
                    </p>
                    {chordTensions.map((tension) => (
                        <Button key={tension} showOutline={chordData.tension === tension} disabled={!!chordData.custom} onClick={() => updateData("tension", tension)}>
                            {!tension ? <span style={{ opacity: 0 }}>.</span> : tension}
                        </Button>
                    ))}
                </div>

                {!chordData.romanKeysActive ? (
                    <div className={styles.list}>
                        <p className={styles.invert} onMouseDown={toggleInverted}>
                            {invertedIcon}
                            <T id="actions.chord_bass" />
                        </p>
                        {keysList.map((bass) => (
                            <Button key={bass} showOutline={chordData.bass === bass} disabled={!!chordData.custom} onClick={() => updateData("bass", bass)}>
                                {bass}
                            </Button>
                        ))}
                    </div>
                ) : null}
            </div>

            <Button variant="outline" onClick={selectChord}>
                <T id="actions.select_chord" />: <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>{combinedChord}</span>
            </Button>
        </>
    )
}
