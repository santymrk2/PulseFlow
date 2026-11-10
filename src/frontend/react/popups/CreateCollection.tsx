import { useEffect, useRef, useState } from "react"
import { get } from "svelte/store"
import { uid } from "uid"
import { getShortBibleName } from "../../components/drawer/bible/scripture"
import { keysToID, sortByName } from "../../components/helpers/array"
import { activePopup, scriptures } from "../../stores"
import { setPopupSubmit } from "../../utils/popup"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { HRule } from "../ui/h-rule/HRule"
import styles from "./CreateCollection.module.css"

// Port de components/main/popups/CreateCollection.svelte. Lee: scriptures. Escribe (botón o Enter, con 2 o más versiones): scriptures[uid()] = { name, collection: { versions } } y activePopup = null.
export function CreateCollection() {
    const scripturesValue = useStore(scriptures)
    const [selectedScriptures, setSelectedScriptures] = useState<string[]>([])

    const scripturesList = keysToID(scripturesValue).filter((a) => !a.collection)
    const localScripturesList = sortByName(scripturesList.filter((a) => !a.api))
    const apiScripturesList = sortByName(scripturesList.filter((a) => a.api))

    function toggle(state: boolean, id: string) {
        setSelectedScriptures((list) => {
            if (state) return list.includes(id) ? list : [...list, id]
            return list.includes(id) ? list.filter((a) => a !== id) : list
        })
    }

    // Enter: el registro es uno solo y crea con la selección actual
    const live = useRef(create)
    useEffect(() => {
        live.current = create
    })
    useEffect(() => setPopupSubmit(() => live.current()), [])

    function create() {
        const all = get(scriptures)

        // remove collections and non-string items
        let versions = selectedScriptures.filter((id) => typeof id === "string") // sometimes the bibles object is added
        versions = versions.filter((id) => !Object.entries(all).find(([tabId, a]) => (tabId === id || a.id === id) && a.collection !== undefined))
        if (versions.length < 2) return

        let name = ""
        versions.forEach((id, i) => {
            if (i > 0) name += " + "
            if (id.length < 5) {
                name += id.toUpperCase()
            } else {
                const bibleName: string = (all[id] || Object.values(all).find((a) => a.id === id))?.name || ""
                name += getShortBibleName(bibleName)
            }
        })

        scriptures.update((a) => {
            a[uid()] = { name, collection: { versions } }
            return a
        })

        activePopup.set(null)
    }

    const item = (scripture: (typeof scripturesList)[number]) => (
        <div key={scripture.id} className={styles.item}>
            <CheckboxField style={{ width: "100%" }} label={scripture.customName || scripture.name} onChange={(checked) => toggle(checked, scripture.id)} />
        </div>
    )

    return (
        <>
            <div className={styles.list}>
                {localScripturesList.map(item)}

                {localScripturesList.length && apiScripturesList.length ? <HRule title="API" /> : null}

                {apiScripturesList.map(item)}
            </div>

            <Button variant="default" disabled={selectedScriptures.length < 2} onClick={create}>
                <T id="timer.create" />
                {selectedScriptures.length < 2 ? <span style={{ opacity: 0.5, fontSize: "0.8em" }}>{selectedScriptures.length}/2</span> : null}
            </Button>
        </>
    )
}
