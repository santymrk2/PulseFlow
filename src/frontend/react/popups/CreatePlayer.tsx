import { useEffect, useRef, useState } from "react"
import { get } from "../../lib/store"
import { uid } from "uid"
import { getUrlTimestamp, getVimeoData, getYouTubeData, trimPlayerId } from "../../components/drawer/player/playerHelper"
import { clone } from "../../components/helpers/array"
import { addVideoMarker } from "../../components/helpers/media"
import { joinTime, secondsToTime } from "../../components/helpers/time"
import type { Category } from "../../../types/Tabs"
import { playerVideos, popupData } from "../../stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { TextField } from "../ui/text-field/TextField"

// Port de components/main/popups/CreatePlayer.svelte. Lee: popupData.active/id (al montar) y playerVideos[id] (copia).
// Escribe: popupData = {} al montar (si hay `active`); playerVideos[id] en cada cambio de id o nombre; un marcador de video si el link trae tiempo (+ toast).
// Un id nuevo busca el nombre en YouTube/Vimeo si aún no hay uno. `data` vive también en un ref porque la búsqueda termina después de un await y debe ver el valor más reciente.

export function CreatePlayer() {
    const [{ active, editId }] = useState(() => {
        const popup = get(popupData)
        return { active: popup.active as "youtube" | "vimeo", editId: (popup.id || "") as string }
    })
    const [currentId] = useState(() => editId || uid())
    const [data, setData] = useState<Category>(() => clone(get(playerVideos)[editId] || { name: "", id: "" }))
    const latest = useRef(data)

    useEffect(() => {
        if (active) popupData.set({})
    }, [])

    function setValue(key: "id" | "name", value: string) {
        if (key === "id") {
            // extract any timestamp in the pasted link (e.g. ?t=1234)
            const markerTime = getUrlTimestamp(value)
            if (markerTime) {
                const markerIndex = addVideoMarker(currentId, markerTime, "URL")
                if (markerIndex > -1) newToast(translateText("actions.time_marker_added", null, [joinTime(secondsToTime(markerTime))]))
            }

            value = trimPlayerId(value, active)
        }

        const newData = { ...latest.current, [key]: value, type: active }
        latest.current = newData
        setData(newData)

        playerVideos.update((a) => {
            a[currentId] = newData
            return a
        })

        if (key === "id") loadName()
    }

    async function loadName() {
        if (latest.current.name) return

        const id = latest.current.id || ""
        let newName = ""
        if (active === "youtube") newName = (await getYouTubeData(id)).name
        else if (active === "vimeo") newName = (await getVimeoData(id)).name

        if (newName) setValue("name", newName)
    }

    return (
        <>
            <TextField label="inputs.video_id" value={data.id || ""} placeholder="e.g. X-AJdKty74M" disabled={!!(data.id && editId)} onChange={(value) => setValue("id", value ?? "")} autofocus={!data.id} pasteBtn={!data.id} />
            {!editId ? <TextField label="inputs.name" value={data.name} disabled={!data.id} onChange={(value) => setValue("name", value ?? "")} /> : null}
        </>
    )
}
