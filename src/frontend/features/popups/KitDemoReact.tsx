import { useState } from "react"
import { Button, type ButtonSize, type ButtonVariant } from "../../shared/ui/kit/button/Button"
import { Capsule } from "../../shared/ui/kit/capsule/Capsule"
import { ListRow } from "../../shared/ui/kit/list-row/ListRow"
import { Menu, MenuItem, MenuSeparator } from "../../shared/ui/kit/menu"
import { SectionHeader } from "../../shared/ui/kit/section-header/SectionHeader"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"
import styles from "./KitDemoReact.module.css"

// Misma página que components/main/popups/KitDemo.svelte, con el kit React, para compararlas a ojo (F24.10).
// Sólo para revisar piezas en dev: activePopup.set("kit_demo_react") desde la consola.
const variants: ButtonVariant[] = ["default", "secondary", "ghost", "outline", "destructive", "live"]
const sizes: ButtonSize[] = ["xs", "sm", "md", "icon", "icon-sm"]
const looks = ["Default", "Predicador", "Himnos"]

export function KitDemoReact() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [liveOn, setLiveOn] = useState(false)
    const [checkedLook, setCheckedLook] = useState("Default")

    return (
        <div className={styles.demo}>
            <section className={styles.section}>
                <SectionHeader>Botones</SectionHeader>
                <div className={styles.row}>
                    {variants.map((variant) => (
                        <Button key={variant} variant={variant} size="sm">
                            {variant}
                        </Button>
                    ))}
                </div>
                <div className={styles.row}>
                    {variants.map((variant) => (
                        <Button key={variant} variant={variant}>
                            {variant}
                        </Button>
                    ))}
                </div>
                <div className={styles.row}>
                    {sizes.map((size) => (
                        <Button key={size} size={size} variant="secondary" title={size}>
                            +
                        </Button>
                    ))}
                    <Button variant="live" aria-pressed={liveOn} onNativeClick={() => setLiveOn(!liveOn)}>
                        Audiencia
                    </Button>
                </div>
            </section>

            <section className={styles.section}>
                <SectionHeader>Cápsula</SectionHeader>
                <Capsule>
                    <Button variant="ghost" size="sm">
                        Buscar
                    </Button>
                    <Button variant="ghost" size="sm">
                        Texto
                    </Button>
                    <Button variant="ghost" size="sm">
                        Tema
                    </Button>
                </Capsule>
            </section>

            <section className={styles.section}>
                <SectionHeader
                    actions={
                        <Button variant="ghost" size="icon-sm" title="+">
                            +
                        </Button>
                    }
                >
                    Lista
                </SectionHeader>
                <div className={styles.list}>
                    <ListRow active trailing="3">
                        Presentación activa
                    </ListRow>
                    <ListRow>Canciones</ListRow>
                    <ListRow>Media</ListRow>
                </div>
            </section>

            <section className={styles.section}>
                <SectionHeader>Campos</SectionHeader>
                <div className={styles.fields}>
                    <TextField label="Nombre" value="Pantalla 1" />
                    <SelectField
                        label="Tipo"
                        value="single"
                        options={[
                            { value: "single", label: "Single" },
                            { value: "multiple", label: "Multiple" }
                        ]}
                    />
                    <ToggleField label="Siempre arriba" checked />
                </div>
            </section>

            <section className={styles.section}>
                <SectionHeader>Menú</SectionHeader>
                <div className={styles.menuAnchor}>
                    <Button variant="outline" size="sm" onNativeClick={() => setMenuOpen(!menuOpen)}>
                        Look: {checkedLook} ▾
                    </Button>
                    <Menu open={menuOpen} onClose={() => setMenuOpen(false)}>
                        {looks.map((look) => (
                            <MenuItem
                                key={look}
                                checked={look === checkedLook}
                                onClick={() => {
                                    setCheckedLook(look)
                                    setMenuOpen(false)
                                }}
                            >
                                {look}
                            </MenuItem>
                        ))}
                        <MenuSeparator />
                        <MenuItem>Editar looks…</MenuItem>
                    </Menu>
                </div>
            </section>
        </div>
    )
}
