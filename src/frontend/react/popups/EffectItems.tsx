import { useEffect, useState } from "react"
import type { EffectItem, EffectType } from "../../../types/Effects"
import { effectItems } from "../../components/output/effects/effectItems"
import { activeEdit, activePopup, effects } from "../../stores"
import { translateText } from "../../utils/language"
import { Card } from "../drawer/Card"
import { useStore } from "../hooks/useStore"
import { Effect } from "../output/Effect"
import styles from "./EffectItems.module.css"

// Port de components/main/popups/EffectItems.svelte: grilla de efectos disponibles. Al elegir uno
// se agrega al efecto que se está editando y se cierra el popup. Los previews se montan de a uno
// (slowLoader) para no crear todos los canvas de golpe.
export function EffectItems() {
    const currentEdit = useStore(activeEdit)
    const [slowLoader, setSlowLoader] = useState(0)

    const keys = Object.keys(effectItems)
    useEffect(() => {
        let loaded = 0
        const loader = setInterval(() => {
            loaded++
            if (loaded > keys.length + 1) clearInterval(loader)
            setSlowLoader(loaded)
        }, 16)
        return () => clearInterval(loader)
    }, [keys.length])

    function selectEffect(item: EffectItem) {
        const effectId = currentEdit?.id || ""
        effects.update((all) => {
            if (!all[effectId]) return all
            all[effectId].items.push(item)
            return all
        })
        activePopup.set(null)
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {keys.map((type, i) => {
                    const item = { type: type as EffectType, ...effectItems[type as keyof typeof effectItems].default } as EffectItem
                    return (
                        <Card key={type} label={translateText(`effect.${item.type}`)} width={100 / 4} checkered onClick={() => selectEffect(item)}>
                            {slowLoader > i ? <Effect effect={{ name: "", style: "", background: "", color: null, items: [item] }} preview /> : null}
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
