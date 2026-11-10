import { useState } from "react"
import { get } from "svelte/store"
import { keysToID, sortByName } from "../../components/helpers/array"
import Tip from "../../components/main/Tip.svelte"
import { categories, contentProviderData, shows } from "../../stores"
import { translateText } from "../../utils/language"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { useFreshStore } from "../settings/audio/useFreshStore"
import styles from "./ChurchAppsSyncCategories.module.css"

// Port de components/main/popups/ChurchAppsSyncCategories.svelte. Lee: categories y shows (una vez, al montar) y contentProviderData.churchApps.syncCategories.
// Escribe: contentProviderData.churchApps.syncCategories (en el lugar, como el original). Tip sigue siendo Svelte (isla).
// Las filas no tenían key en el Svelte: se usa la posición.
interface CategoryOption {
    id: string
    name: string
    icon?: string | null
    count: number
}

function loadCategoryOptions(): CategoryOption[] {
    const allShows = Object.values(get(shows))
    const mapped = keysToID(get(categories))
        .filter((category) => !category.isArchive && category.name)
        .map((category) => {
            const name = category.default ? translateText(category.name) || category.name : category.name
            const count = allShows.filter((show) => show.category === category.id).length
            return { id: category.id, name, icon: category.icon, count }
        })

    return sortByName(mapped)
}

export function ChurchAppsSyncCategories() {
    const [categoryOptions] = useState(loadCategoryOptions)
    // el popup edita contentProviderData en el lugar: useFreshStore entrega una copia por cambio
    const providerData = useFreshStore(contentProviderData)

    const currentlySelected: string[] = providerData.churchApps?.syncCategories || []

    function toggleCategory(id: string) {
        contentProviderData.update((a) => {
            if (currentlySelected.indexOf(id) === -1) {
                a.churchApps = { ...a.churchApps, syncCategories: [...currentlySelected, id] }
            } else {
                a.churchApps = { ...a.churchApps, syncCategories: currentlySelected.filter((c) => c !== id) }
            }

            return a
        })
    }

    return (
        <>
            <SvelteIsland component={Tip} props={{ type: "info", value: "settings.sync_categories_tip", bottom: 20 }} />

            <div className={styles.categories}>
                {categoryOptions.map(({ id, name, count }, i) => (
                    <CheckboxField key={i} label={`${name} <span style='opacity: 0.7;font-size: 0.7em;'>(${count})</span>`} checked={currentlySelected.includes(id)} onChange={() => toggleCategory(id)} />
                ))}
            </div>
        </>
    )
}
