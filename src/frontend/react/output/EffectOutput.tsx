import { effects } from "../../shared/core/stores"
import { useStore } from "../hooks/useStore"
import { Effect } from "./Effect"
import { OutputTransition } from "./OutputTransition"
import type { Transition } from "../../../types/Show"

export interface EffectOutputProps {
    ids: string[]
    transition: Transition
    mirror?: boolean
}

// Port de components/output/effects/EffectOutput.svelte (F24.20c).
export function EffectOutput({ ids, transition, mirror = false }: EffectOutputProps) {
    const currentEffects = useStore(effects)

    return (
        <>
            {ids.map((id) => {
                const effect = currentEffects[id]
                if (!effect) return null
                return (
                    <OutputTransition key={id} transition={mirror ? undefined : transition} inTransition={mirror ? null : transition.in || transition} outTransition={mirror ? null : transition.out || transition}>
                        <Effect effect={{ id, ...effect }} />
                    </OutputTransition>
                )
            })}
        </>
    )
}

export default EffectOutput
