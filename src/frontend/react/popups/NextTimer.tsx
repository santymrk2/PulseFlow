import { useEffect, useState } from "react"
import { get } from "svelte/store"
import type { LayoutRef } from "../../../types/Show"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { joinTime, secondsToTime } from "../../components/helpers/time"
import { activePopup, activeProject, activeShow, popupData, projects, showsCache } from "../../stores"
import { setPopupSubmit } from "../../utils/popup"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { NumberField } from "../ui/number-field/NumberField"

// Port de components/main/popups/NextTimer.svelte. Lee (al montar): popupData.type/value/indexes/count/totalTime, getLayoutRef(), activeShow y activeProject.
// Escribe: popupData = {} al montar; projects (timer) para carpetas/PDF; history SHOW_LAYOUT (nextTimer, end) y showsCache (quita "end" cuando sólo queda uno); activePopup = null.
// Enter ejecuta la misma lógica de submit (se vuelve a registrar en cada render para ver los valores actuales).
// getTotalTime() se llama al montar, igual que el onMount del Svelte (que lee popupData.totalTime justo después de vaciarlo: acá se normaliza a 0).
function detailValue(e: unknown): unknown {
    if (e && typeof e === "object" && "detail" in e) return (e as { detail: unknown }).detail
    return e
}

export function NextTimer() {
    const [popup] = useState(() => get(popupData))
    const type = popup.type || "show"
    const [value, setValue] = useState<number>(popup.value || 0)
    const [layoutRef] = useState<LayoutRef[]>(() => getLayoutRef())
    const allActiveSlides = layoutRef.filter((a) => !a.data.disabled)
    const indexes: number[] = popup.indexes || layoutRef.map((_, i) => i)
    const allSlides = !popup.indexes?.length
    const isProjectItem = type === "folder" || type === "pdf"
    const count = isProjectItem ? popup.count || 0 : allActiveSlides.length

    const [allTime, setAllTime] = useState<number>(isProjectItem ? value || 10 : allActiveSlides[0]?.data?.nextTimer || 10)
    const [totalTime, setTotalTime] = useState(0)
    const [appliedToSlides, setAppliedToSlides] = useState(0)

    function getTotalTime() {
        const total = allActiveSlides.reduce((acc, ref) => (acc += Number(ref.data.nextTimer || 0)), 0)
        setTotalTime(total)

        const allValues = allActiveSlides.map((ref) => Number(ref.data.nextTimer || 0))
        setAppliedToSlides([...new Set(allValues)].length === 1 && allValues[0] === allTime ? allTime : 0)
    }

    useEffect(() => {
        popupData.set({})
        if (isProjectItem) setTotalTime(get(popupData).totalTime ?? 0)
        else if (allSlides) getTotalTime()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function updateValue(e: unknown) {
        const raw = detailValue(e)
        const nextValue = (typeof raw === "number" ? raw : raw == null ? raw : Number(raw)) as number
        setValue(nextValue)

        if (isProjectItem) {
            projects.update((a) => {
                const index = get(activeShow)?.index ?? -1
                const projectId = get(activeProject)
                if (!projectId || !a[projectId]?.shows?.[index] || index < 0) return a

                if (!a[projectId].shows[index].data) a[projectId].shows[index].data = {}
                a[projectId].shows[index].data.timer = nextValue || 0

                return a
            })

            activePopup.set(null)
            return
        }

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: nextValue, indexes }, location: { page: "show", override: "change_slide_action_timer" } })

        if (allSlides) {
            const goToStartRefs = allActiveSlides.reduce((acc, ref) => (ref.data?.end ? [...acc, ref] : acc), [] as LayoutRef[])
            if (goToStartRefs.length === 1) {
                const showId = get(activeShow)?.id || ""
                if (showId) {
                    const layoutId = _show(showId).get("settings.activeLayout")
                    showsCache.update((a) => {
                        const ref = goToStartRefs[0]
                        const show = a[showId]
                        if (!ref || !show) return a

                        const layout = show.layouts?.[layoutId]
                        if (!layout) return a

                        if (ref.type === "parent") {
                            const slide = layout.slides?.[ref.index]
                            if (slide) delete slide.end
                        } else {
                            const parentIndex = ref.parent?.index ?? -1
                            const parentSlide = layout.slides?.[parentIndex]
                            const child = parentSlide?.children?.[ref.id]
                            if (child) delete child.end
                        }
                        return a
                    })
                }
            }

            history({ id: "SHOW_LAYOUT", newData: { key: "end", data: !!nextValue, indexes: [indexes[indexes.length - 1]] }, location: { page: "show", override: "change_slide_action_loop" } })
            activePopup.set(null)
        }
    }

    function submit() {
        if (allSlides) {
            const isReset = isProjectItem ? !allTime || allTime === value : totalTime && (appliedToSlides === allTime || allTime === 0)
            if (isReset) updateValue(undefined)
            else if (allTime !== 0) updateValue(allTime)
        } else {
            updateValue(value)
            activePopup.set(null)
        }
    }

    useEffect(() => setPopupSubmit(submit))

    const newTime = allTime * count
    const getTime = (time: number) => (time > 59 ? joinTime(secondsToTime(time)) : time + "s")

    if (allSlides) {
        return (
            <>
                <NumberField style={{ marginBottom: "10px" }} label="timer.seconds" value={allTime} max={3600} onChange={(time) => setAllTime(time ?? 0)} />

                {isProjectItem ? (
                    !allTime || allTime === value
                ) : totalTime && (appliedToSlides === allTime || allTime === 0) ? (
                    <Button variant="outline" icon="reset" onClick={() => updateValue(undefined)}>
                        <T id="actions.reset" />
                    </Button>
                ) : (
                    <Button variant="default" icon="clock" disabled={allTime === 0} info={getTime(newTime)} onClick={() => updateValue(allTime)}>
                        <T id="actions.to_all" />
                    </Button>
                )}

                {totalTime ? (
                    <p style={{ textAlign: "center", opacity: 0.7, fontSize: "0.9em", marginTop: "20px" }}>
                        <T id="transition.duration" />: {getTime(totalTime)}
                    </p>
                ) : null}
            </>
        )
    }

    return <NumberField label="timer.seconds" value={value} max={3600} onChange={updateValue} />
}
