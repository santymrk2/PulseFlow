import { useEffect, useRef, useState } from "react"
import type { Styles } from "../../../types/Settings"
import type { OutBackground, Transition } from "../../../types/Show"
import { clone } from "../../components/helpers/array"
import { BackgroundMedia } from "./BackgroundMedia"
import styles from "./Background.module.css"

export interface BackgroundProps {
    data: OutBackground
    outputId: string
    transition: Transition
    currentStyle?: Styles | null
    slideFilter?: string
    ratio?: number
    animationStyle?: string
    mirror?: boolean
}

// Port de components/output/layers/Background.svelte (F24.20c).
// La lógica de doble buffer/transición es delicada; delega el render de cada capa al port React BackgroundMedia manteniendo el estado aquí.
export function Background({ data, outputId, transition, currentStyle = null, slideFilter = "", ratio = 1, animationStyle = "", mirror = false }: BackgroundProps) {
    const duration = transition.duration ?? 800
    const noTransition = transition.type === "none" || !duration
    const style = `height: 100%;zoom: ${1 / ratio};transition: filter ${duration}ms, backdrop-filter ${duration}ms;${slideFilter}`

    const [firstActive, setFirstActive] = useState(true)
    const [background1, setBackground1] = useState<OutBackground | null>(null)
    const [background2, setBackground2] = useState<OutBackground | null>(null)
    const [firstFadingOut, setFirstFadingOut] = useState(false)
    const [loading, setLoading] = useState(false)
    const [currentlyLoadingFirst, setCurrentlyLoadingFirst] = useState(false)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tooRapid = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tryAgain = useRef(false)
    const [transition1, setTransition1] = useState(transition)
    const [transition2, setTransition2] = useState(transition)
    const [animation1, setAnimation1] = useState("")
    const [animation2, setAnimation2] = useState("")
    const [background1Data, setBackground1Data] = useState<OutBackground>({})
    const [background2Data, setBackground2Data] = useState<OutBackground>({})
    const refs = useRef({ data, firstActive, background1, background2, loading, transition, duration, noTransition, animationStyle, outputId, currentStyle, mirror })
    refs.current = { data, firstActive, background1, background2, loading, transition, duration, noTransition, animationStyle, outputId, currentStyle, mirror }

    useEffect(() => {
        if (background1) setBackground1Data(clone(background1))
    }, [background1])
    useEffect(() => {
        if (background2) setBackground2Data(clone(background2))
    }, [background2])

    useEffect(() => {
        setTimeout(
            () => {
                if (refs.current.background1 && !(refs.current.loading && !refs.current.firstActive)) setAnimation1(animationStyle)
                else setAnimation2(animationStyle)
            },
            duration / 4 + 60
        )
    }, [animationStyle, duration])

    useEffect(() => {
        if (tooRapid.current) {
            tryAgain.current = true
            return
        }
        tooRapid.current = setTimeout(() => {
            tooRapid.current = null
            if (tryAgain.current) {
                tryAgain.current = false
            }
        }, duration / 2)

        if (timeout.current) {
            clearTimeout(timeout.current)
            setFirstActive(!refs.current.background2?.path)
        }
        if (refs.current.loading) setLoading(false)

        if (!data.path && !data.id) {
            setBackground1(null)
            setBackground2(null)
            return
        }

        const newData = clone(data)
        const activeId = refs.current.firstActive ? refs.current.background1?.path || refs.current.background1?.id : refs.current.background2?.path || refs.current.background2?.id
        if (activeId === (data.path || data.id)) {
            if (refs.current.firstActive) {
                setBackground1(newData)
                setTransition1(clone(transition))
            } else {
                setBackground2(newData)
                setTransition2(clone(transition))
            }
            return
        }

        const isPlayer = newData?.type === "player" || refs.current.background1?.type === "player" || refs.current.background2?.type === "player"
        if (isPlayer) {
            setBackground1(newData)
            setBackground2(null)
            setTransition1(clone(transition))
            setFirstActive(true)
            setLoading(false)
            return
        }

        const hasActiveBg = !!(refs.current.background1 || refs.current.background2)
        const mountDelay = hasActiveBg ? duration / 4 + 20 : 0
        timeout.current = setTimeout(() => {
            setLoading(true)
            const loadingFirst = !refs.current.background1
            setCurrentlyLoadingFirst(loadingFirst)
            setFirstFadingOut(!loadingFirst)
            if (loadingFirst) {
                setBackground1(newData)
                setTransition1(clone(transition))
            } else {
                setBackground2(newData)
                setTransition2(clone(transition))
            }
            timeout.current = setTimeout(
                () => {
                    if (refs.current.loading) loaded(loadingFirst)
                },
                Math.max(2000, duration)
            )
        }, mountDelay)
        // Sigue el original: reacciona al contenido de `data`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(data)])

    function loaded(isFirst: boolean) {
        if (!refs.current.loading || currentlyLoadingFirst !== isFirst) return
        setLoading(false)
        setFirstActive(isFirst)
        timeout.current = setTimeout(() => {
            if (isFirst) setBackground2(null)
            else setBackground1(null)
            timeout.current = null
        })
    }

    return (
        <div className={styles.media} style={css(style)}>
            {background1 ? (
                <div className={`${styles.media} ${!firstActive && (loading || noTransition) ? styles.hidden : ""}`.trim()}>
                    <BackgroundMedia data={background1Data} fadingOut={firstFadingOut} outputId={outputId} transition={transition1} currentStyle={currentStyle} animationStyle={animation1} mirror={mirror} onLoaded={() => loaded(true)} />
                </div>
            ) : null}
            {background2 ? (
                <div className={`${styles.media} ${firstActive && (loading || noTransition) ? styles.hidden : ""}`.trim()}>
                    <BackgroundMedia data={background2Data} fadingOut={!firstFadingOut} outputId={outputId} transition={transition2} currentStyle={currentStyle} animationStyle={animation2} mirror={mirror} onLoaded={() => loaded(false)} />
                </div>
            ) : null}
        </div>
    )
}

function css(text: string): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    text.split(";").forEach((entry) => {
        const index = entry.indexOf(":")
        if (index < 0) return
        const key = entry
            .slice(0, index)
            .trim()
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        const value = entry.slice(index + 1).trim()
        if (!key || !value) return
        out[key] = value
    })
    return out
}

export default Background
