import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Categories } from "../../../types/Tabs"
import { addItem } from "../../components/edit/scripts/itemHelpers"
import { activePopup, categories, customizedIcons, mediaFolders, overlayCategories, popupData, selected, templateCategories } from "../../shared/core/stores"
import { customIcons, customIconsColors } from "../../shared/core/values/customIcons"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import styles from "./ChangeIcon.module.css"

// Port de components/main/popups/ChangeIcon.svelte. Lee: selected (id y data), categories/overlayCategories/templateCategories (icono activo, al montar) y customizedIcons.
// Escribe, según selected.id: el icono de las categorías elegidas (categories, mediaFolders, overlayCategories, templateCategories) o un item "icon" en el slide (addItem);
// después activePopup = null. Editar abre manage_icons con popupData = { back: "icon" }.
const customIconColors: Record<string, string | undefined> = customIconsColors

function changeIcon(a: Categories, icon: string) {
    get(selected).data.forEach((b) => {
        if (b !== "all" && b !== "unlabeled") a[b].icon = icon
    })
    return a
}

export function ChangeIcon() {
    // lo que se ve al abrir se calcula una vez, como los `const` del Svelte
    const [initial] = useState(() => {
        const current = get(selected)
        const active = current.id === "slide_icon" ? "" : current.data?.[0] || ""
        const activeIcon = current.id === "category_shows" ? get(categories)[active]?.icon : current.id === "category_overlays" ? get(overlayCategories)[active]?.icon : current.id === "category_templates" ? get(templateCategories)[active]?.icon : ""
        return { boxed: current.id !== "slide_icon", activeIcon }
    })
    const { boxed, activeIcon } = initial
    const selectedValue = useStore(selected)
    const customized = useStore(customizedIcons)

    const filteredIcons = Object.keys(customIcons).filter((a) => !customized.disabled.includes(a))

    function click(icon: string, path = "") {
        switch (get(selected).id) {
            case "category_shows":
                categories.update((a) => changeIcon(a, icon))
                break
            case "category_media":
                mediaFolders.update((a) => changeIcon(a, icon))
                break
            case "category_overlays":
                overlayCategories.update((a) => changeIcon(a, icon))
                break
            case "category_templates":
                templateCategories.update((a) => changeIcon(a, icon))
                break
            case "slide_icon":
                addItem("icon", icon, path ? { path } : { color: customIconColors[icon] })
                break
            default:
                console.log("change icon " + get(selected).id)
        }

        activePopup.set(null)
    }

    function manageIcons() {
        popupData.set({ back: "icon" })
        activePopup.set("manage_icons")
    }

    return (
        <>
            <Button className="popup-options" icon="edit" iconSize={1.1} title="menu.edit" onClick={manageIcons} white />

            <div className={styles.grid} style={boxed ? { gap: "8px" } : undefined}>
                {filteredIcons.map((icon) =>
                    !boxed || icon !== "empty" ? (
                        <Button key={icon} style={{ padding: `${boxed ? 0 : 6}px`, ...(boxed ? {} : { border: "1px solid var(--focus)" }) }} showOutline={activeIcon === icon} title={icon[0].toUpperCase() + icon.slice(1).replaceAll("_", " ")} onClick={() => click(icon)}>
                            <Icon id={icon} size={2} custom white color={customIconColors[icon]} boxed={boxed} />
                        </Button>
                    ) : null
                )}
            </div>

            {selectedValue.id === "slide_icon" && customized.svg.length ? (
                <>
                    <HRule />

                    <div className={`${styles.custom} ${styles.grid}`}>
                        {customized.svg.map((icon: { id: string; path: string }) => (
                            <Button key={icon.id} style={{ padding: "12px" }} onClick={() => click(icon.id, icon.path)}>
                                <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: icon.path }} />
                            </Button>
                        ))}
                    </div>
                </>
            ) : null}
        </>
    )
}
