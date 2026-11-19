import { useState, type CSSProperties, type MouseEvent } from "react"
import type { Look, LookScreen } from "../../../types/Settings"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { applyLook, createLook, createLookFromPreset, isStageOutput, LOOK_PRESETS, type LookPreset } from "../../shared/utils/helpers/looks"
import { activeLook, looks, outputs } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { confirmCustom } from "../../shared/utils/popup"
import { save } from "../../app/wiring/save"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import type { LookCellPatch } from "../looks/LookAdvanced"
import { LookGrid } from "../looks/LookGrid"
import { Modal } from "../../app/main/Modal"
import { Button } from "../../shared/ui/kit/button/Button"
import { ListRow } from "../../shared/ui/kit/list-row/ListRow"
import { SectionHeader } from "../../shared/ui/kit/section-header/SectionHeader"
import { Slider } from "../../shared/ui/kit/slider/Slider"
import styles from "./LooksWindow.module.css"

// Port de components/looks/LooksWindow.svelte: presets a la izquierda, grilla pantallas × capas a la derecha.
// La copia editable (`draft`) se guarda en $looks al tocar "Guardar"; el marco es el Modal de React.
const t = translateText

export function LooksWindow() {
    const looksValue = useStore(looks)
    const activeLookValue = useStore(activeLook)
    const outputsValue = useStore(outputs)

    const audienceScreens = sortByName(keysToID(outputsValue).filter((a) => !isStageOutput(a)))
    const presetIds = Object.keys(looksValue)

    // `$: if (!selectedLook || !$looks[selectedLook]) selectedLook = ...`: se resuelve en render.
    const [chosen, setChosen] = useState<string | null>(null)
    const [templatesOpen, setTemplatesOpen] = useState(false)
    const selectedLook = chosen && looksValue[chosen] ? chosen : activeLookValue && looksValue[activeLookValue] ? activeLookValue : presetIds[0] || ""

    const stored = selectedLook ? looksValue[selectedLook] : undefined
    const storedKey = stored ? JSON.stringify(stored) : ""
    const draftKey = `${selectedLook}|${storedKey}`
    const [previousKey, setPreviousKey] = useState(draftKey)
    const [draft, setDraft] = useState<Look | null>(() => (stored ? clone(stored) : null))
    if (previousKey !== draftKey) {
        setPreviousKey(draftKey)
        setDraft(stored ? clone(stored) : null)
    }

    const isDirty = !!draft && JSON.stringify(draft) !== JSON.stringify(stored)

    function updateDraft(patch: Partial<Look>) {
        if (!draft) return
        setDraft({ ...draft, ...patch })
    }

    function updateCell(outputId: string, patch: LookCellPatch) {
        if (!draft) return
        // LookAdvanced usa null para "sin valor"; el Look del store guarda esos campos como ausentes/definidos.
        const cleanPatch = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value ?? undefined])) as Partial<LookScreen>
        const cell = { ...(draft.screens?.[outputId] || { layers: { media: true, slide: true, overlays: true } }), ...cleanPatch }
        updateDraft({ screens: { ...(draft.screens || {}), [outputId]: cell } })
    }

    function saveDraft() {
        if (!draft || !selectedLook) return
        history({ id: "UPDATE", newData: { data: clone(draft) }, oldData: { id: selectedLook }, location: { page: "settings", id: "settings_look" } })
        save()
    }

    function createPreset() {
        const name = `${t("looks.looks")} ${presetIds.length + 1}`
        const id = createLook(name)
        save()
        setChosen(id)
    }

    function createFromTemplate(preset: LookPreset) {
        const id = createLookFromPreset(preset, t(`looks.preset_${preset}`))
        save()
        setChosen(id)
        setTemplatesOpen(false)
    }

    async function removePreset(id: string) {
        if (presetIds.length <= 1 || !id) return
        const ok = await confirmCustom(`${t("actions.delete")} "${looksValue[id]?.name}"?`)
        if (!ok) return

        history({ id: "UPDATE", newData: { id }, location: { page: "settings", id: "settings_look" } })
        if (selectedLook === id) setChosen(null)
        save()
    }

    function renamePreset(id: string) {
        if (!id) return
        const current = looksValue[id]?.name || ""
        const value = typeof window !== "undefined" ? window.prompt(t("looks.name"), current) : null
        if (value === null || !value.trim()) return

        const look = { ...looksValue[id], name: value.trim() }
        history({ id: "UPDATE", newData: { data: look }, oldData: { id }, location: { page: "settings", id: "settings_look" } })
        save()
    }

    function duplicatePreset(id: string) {
        const source = looksValue[id]
        if (!source) return

        const newId = createLook(`${source.name} 2`)
        looks.update((all) => {
            all[newId] = { ...all[newId], screens: clone(source.screens), transitionMs: source.transitionMs }
            return all
        })
        save()
        setChosen(newId)
    }

    function makeLive() {
        if (!selectedLook) return
        applyLook(selectedLook)
    }

    function onTransitionChange(event: Event) {
        const value = Number((event.target as HTMLInputElement)?.value ?? 0)
        updateDraft({ transitionMs: value })
    }

    function openRename(event: MouseEvent<HTMLButtonElement>, id: string) {
        event.preventDefault()
        renamePreset(id)
    }

    const footer = (
        <>
            {draft ? (
                <div className={styles.transition}>
                    <span className={styles.label}>{t("looks.transition")}</span>
                    <Slider value={draft.transitionMs ?? 1000} min={0} max={5000} step={100} style={{ flex: 1 } as CSSProperties} onChange={onTransitionChange} />
                    <span className={styles.value}>{((draft.transitionMs ?? 1000) / 1000).toFixed(1)} s</span>
                </div>
            ) : null}
            <Button variant="ghost" size="sm" disabled={!selectedLook} onClick={() => renamePreset(selectedLook)}>
                {t("actions.rename")}
            </Button>
            <Button variant="ghost" size="sm" disabled={!selectedLook} onClick={() => duplicatePreset(selectedLook)}>
                {t("actions.duplicate")}
            </Button>
            <Button variant="ghost" size="sm" disabled={!selectedLook || presetIds.length <= 1} onClick={() => removePreset(selectedLook)}>
                {t("actions.delete")}
            </Button>
            <Button variant="default" size="sm" disabled={!draft} onClick={makeLive}>
                {t("looks.make_live")}
            </Button>
        </>
    )

    return (
        <Modal title="looks.window_title" width={760} height={520} footer={footer}>
            <div className={styles.window}>
                <div className={styles.sidebar}>
                    <div className={styles.live}>
                        <Icon id="play" size={0.9} white />
                        <span>
                            {t("looks.live")}: <strong>{looksValue[activeLookValue]?.name || "—"}</strong>
                        </span>
                    </div>

                    <SectionHeader>{t("looks.presets")}</SectionHeader>

                    <div className={styles.presets}>
                        {presetIds.map((id) => {
                            const look = looksValue[id]
                            return (
                                <ListRow key={id} active={id === selectedLook} onClick={() => setChosen(id)} onContextMenu={(event) => openRename(event, id)} trailing={id === activeLookValue ? <span className={styles.dot} /> : null}>
                                    {look.name}
                                </ListRow>
                            )
                        })}
                    </div>

                    <div className={styles.sidebarFooter}>
                        <Button variant="outline" size="sm" className={styles.fullWidth} onClick={createPreset}>
                            + {t("looks.new")}
                        </Button>
                        <Button variant="outline" size="sm" className={styles.fullWidth} onClick={() => setTemplatesOpen(!templatesOpen)}>
                            + {t("looks.from_template")}
                        </Button>
                        {templatesOpen
                            ? (Object.keys(LOOK_PRESETS) as LookPreset[]).map((preset) => (
                                  <Button key={preset} variant="ghost" size="sm" className={styles.fullWidth} onClick={() => createFromTemplate(preset)}>
                                      {t(`looks.preset_${preset}`)}
                                  </Button>
                              ))
                            : null}
                    </div>
                </div>

                <div className={styles.detail}>
                    {!audienceScreens.length ? (
                        <p className={styles.hint}>{t("looks.no_screens")}</p>
                    ) : draft ? (
                        <>
                            <div className={styles.detailHeader}>
                                <input className={styles.nameInput} type="text" value={draft.name} onChange={(event) => updateDraft({ name: event.currentTarget.value })} />
                                <Button variant={isDirty ? "default" : "ghost"} size="sm" disabled={!isDirty} onClick={saveDraft}>
                                    {t("actions.save")}
                                </Button>
                            </div>

                            <div className={styles.scroll}>
                                <LookGrid screens={audienceScreens} draft={draft} onCell={(detail) => updateCell(detail.outputId, detail.patch)} />
                            </div>
                        </>
                    ) : (
                        <p className={styles.hint}>{t("looks.no_screens")}</p>
                    )}
                </div>
            </div>
        </Modal>
    )
}
