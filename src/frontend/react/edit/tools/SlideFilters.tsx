import { useMemo } from "react"
import { activeEdit, activeShow, showsCache, templates } from "../../../shared/core/stores"
import { clone } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { getLayoutRef } from "../../../shared/utils/helpers/show"
import { addFilterString } from "../../../components/edit/scripts/textStyle"
import type { EditInput } from "../../../components/edit/values/boxes"
import { slideFilterSections } from "../../../components/edit/values/filters"
import { useStore } from "../../hooks/useStore"
import { EditValues } from "./EditValues"

export function SlideFilters() {
    const currentActiveShow = useStore(activeShow)
    const currentShowsCache = useStore(showsCache)
    const currentActiveEdit = useStore(activeEdit)
    const currentTemplates = useStore(templates)

    const currentId = currentActiveShow?.id || ""
    const currentSlideNumber = currentActiveEdit.slide || 0
    const ref = currentShowsCache[currentId] ? getLayoutRef(currentId) : {}

    const currentSlideData = ref?.[currentSlideNumber]?.data || null
    const isTemplate = currentActiveEdit.type === "template"
    const filterData = (isTemplate ? currentTemplates[currentId] : currentSlideData) || {}

    const currentSlideFilterSections = useMemo(() => {
        const sections = clone(slideFilterSections)
        if (!filterData?.["backdrop-filter"]) {
            delete sections.backdrop_filters
        }
        return sections
    }, [currentSlideNumber, filterData])

    function valueChanged(input: EditInput) {
        if (!currentSlideData) return
        let value = input.values.value
        value = addFilterString(currentSlideData[input.id] || "", [input.key, value])

        const indexes = [currentSlideNumber]
        const override = [currentId, currentSlideNumber, input.id, input.key].join("_")
        history({ id: "SHOW_LAYOUT", newData: { key: input.id, data: value, indexes }, location: { page: "edit", override } })
    }

    return <EditValues sections={currentSlideFilterSections} item={filterData} onChange={valueChanged} />
}
