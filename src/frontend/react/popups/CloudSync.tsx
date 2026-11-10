import { useRef, useState } from "react"
import { get } from "svelte/store"
import Tip from "../../components/main/Tip.svelte"
import { popupData } from "../../stores"
import { chooseTeam } from "../../utils/cloudSync"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { ChoiceGrid, type ChoiceOption } from "../ui/choice-grid/ChoiceGrid"

// Port de components/main/popups/CloudSync.svelte. Lee (al montar): popupData.type y popupData.teams.
// Escribe: chooseTeam({ ...team, count }) al elegir (una sola vez). Tip sigue siendo Svelte (isla).
interface Team extends ChoiceOption {
    churchId: string
}

export function CloudSync() {
    const [{ type, teams }] = useState(() => {
        const data = get(popupData)
        return { type: data.type as string | undefined, teams: (data.teams || []) as Team[] }
    })
    const selected = useRef(false)

    function teamChosen(selectedId: string) {
        if (selected.current || !Array.isArray(teams)) return

        const team = teams.find((a) => a.id === selectedId)

        selected.current = true
        chooseTeam({ ...team, count: teams.length } as Parameters<typeof chooseTeam>[0])
    }

    if (type !== "choose_team") return null

    return (
        <>
            <SvelteIsland component={Tip} props={{ type: "info", value: "Select a team where you want to sync the data.", bottom: 20 }} />

            <ChoiceGrid options={teams} onClick={teamChosen} highlightFirst={false} />
        </>
    )
}
