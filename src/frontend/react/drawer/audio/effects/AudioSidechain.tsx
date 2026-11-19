import { gainToDb, MIN_DB } from "../../../../shared/audio/dBUtils"
import { channelSidechainMultipliers } from "../../../../shared/core/stores"
import { translateText } from "../../../../shared/utils/language"
import { useStore } from "../../../../shared/ui/hooks/useStore"
import styles from "./AudioSidechain.module.css"

// Port de components/drawer/audio/AudioSidechain.svelte.
export interface AudioSidechainProps {
    channelId: string
}

const MAX_REDUCTION_DB = -48

export function AudioSidechain({ channelId }: AudioSidechainProps) {
    const multipliers = useStore(channelSidechainMultipliers)
    const multiplier = multipliers[channelId] ?? 1.0
    const reductionDb = multiplier >= 0.999 ? 0 : Math.min(-MIN_DB, Math.max(0, -gainToDb(multiplier)))
    const reductionPct = (reductionDb / -MIN_DB) * 100

    return (
        <div className={styles.track} data-title={`${translateText("audio.sidechain")}: -${reductionDb.toFixed(1)} dB`}>
            <div className={styles.bar} style={{ width: `${reductionPct}%` }} />
            <div className={styles.max} style={{ right: `${(MAX_REDUCTION_DB / MIN_DB) * 100}%` }} />
        </div>
    )
}
