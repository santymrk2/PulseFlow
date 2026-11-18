import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import type { MediaStyle } from "../../../../types/Main"
import type { BibleContent } from "../../../../types/Scripture"
import type { Item } from "../../../../types/Show"
import { activeEdit, activePage, activeScripture, activeStyle, drawerTabsData, media, outputs, scriptureSettings, styles, templates } from "../../../stores"
import { openSettings } from "../../../components/settings/openSettings"
import { setDefaultScriptureTemplates } from "../../../utils/createData"
import { confirmCustom } from "../../../utils/popup"
import { mediaExtensions } from "../../../values/extensions"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getMediaStyle } from "../../../components/helpers/media"
import { getAllNormalOutputs, getFirstActiveOutput } from "../../../components/helpers/output"
import MediaSvelte from "../../../components/output/layers/Media.svelte"
import TextboxSvelte from "../../../components/slide/Textbox.svelte"
import ZoomedSvelte from "../../../components/slide/Zoomed.svelte"
import { createScriptureShow, getActiveScripturesContent, getMergedAttribution, getScriptureSlidesNew, textKeys, useOldScriptureSystem } from "../../../components/drawer/bible/scripture"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { T } from "../../helpers/T"
import { Button } from "../../ui/button/Button"
import { ColorField } from "../../ui/color-field/ColorField"
import { FileField } from "../../ui/file-field/FileField"
import { InputRow } from "../../ui/input-row/InputRow"
import { Link } from "../../ui/link/Link"
import { NumberField } from "../../ui/number-field/NumberField"
import { PopupField } from "../../ui/popup-field/PopupField"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import css from "./ScriptureInfo.module.css"

// Port de components/drawer/info/ScriptureInfo.svelte. La vista previa (Zoomed, Media y Textbox) sigue en Svelte
// y se monta con islas; el contenido del slot de Zoomed se pasa con `slots` de SvelteIsland.
export interface ScriptureInfoProps {
    optionsOpen: boolean
}

interface ScriptureSettings {
    [key: string]: unknown
    template?: string
    customText?: string
    showVersion?: boolean
    showVerse?: boolean
    splitLongVerses?: boolean
    splitLongVersesSuffix?: boolean
}

export function ScriptureInfo({ optionsOpen }: ScriptureInfoProps) {
    const scripture = useStore(activeScripture)
    const tabsData = useStore(drawerTabsData)
    const allOutputs = useStore(outputs)
    const settings = useStore(scriptureSettings) as ScriptureSettings
    const allStyles = useStore(styles)
    const allTemplates = useStore(templates)
    const allMedia = useStore(media)

    const [biblesContent, setBiblesContent] = useState<BibleContent[]>([])
    const [selectedChapters, setSelectedChapters] = useState<number[]>([])
    const [selectedVerses, setSelectedVerses] = useState<(number | string)[][]>([])
    const [slides, setSlides] = useState<Item[][]>([[]])
    const [currentOutputSlides, setCurrentOutputSlides] = useState<Item[]>([])
    const [longVersesMenuOpened, setLongVersesMenuOpened] = useState(false)
    const [useOldSystem, setUseOldSystem] = useState(false)

    const activeScriptureId = tabsData.scripture?.activeSubTab || ""
    const referenceKey = JSON.stringify(scripture.reference || null)

    useEffect(() => {
        if (!activeScriptureId && !scripture.reference) return
        let cancelled = false
        async function load() {
            const content = await getActiveScripturesContent()
            if (cancelled || !content?.length) return
            setBiblesContent(content)
            setSelectedChapters(content[0]?.chapters || [])
            setSelectedVerses(content[0]?.activeVerses || [])
        }
        void load()
        return () => {
            cancelled = true
        }
        // `referenceKey` representa $activeScripture.reference (evita recargar por identidad del objeto).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScriptureId, referenceKey])

    const styleId = getFirstActiveOutput(allOutputs)?.style || ""
    const outputStyle = allStyles[styleId]
    const onlyOneNormalOutput = getAllNormalOutputs().length === 1
    const styleScriptureTemplate = onlyOneNormalOutput ? allStyles[styleId]?.templateScripture || "" : ""
    const templateId = styleScriptureTemplate || settings.template || "scripture"
    const template = allTemplates[templateId]
    const templateBackground = template?.settings?.backgroundPath
    const isDefault = typeof templateId === "string" ? templateId.includes("scripture") && !templateId.includes("LT") : false
    const usingDefault = typeof templateId === "string" ? templateId.includes("scripture") : false
    const attributionString = getMergedAttribution(biblesContent)
    const background = allTemplates[templateId]?.settings?.backgroundColor || outputStyle?.background || "#000000"

    useEffect(() => {
        if (!isDefault || !biblesContent.length) return
        const timeout = setTimeout(() => {
            const newTemplateId = "scripture_" + biblesContent.length
            scriptureSettings.update((a) => {
                a.template = allTemplates[newTemplateId] ? newTemplateId : "scripture"
                return a
            })
        }, 100)
        return () => clearTimeout(timeout)
    }, [activeScriptureId, templateId, biblesContent.length, isDefault, allTemplates])

    useEffect(() => {
        let cancelled = false
        async function getSlides() {
            if (!selectedVerses.length && !settings) {
                setSlides([[]])
                return
            }
            const result = await getScriptureSlidesNew({ biblesContent, selectedChapters, selectedVerses }, true)
            if (!cancelled) setSlides(result.slides)
        }
        void getSlides()
        return () => {
            cancelled = true
        }
    }, [biblesContent, selectedChapters, selectedVerses, settings])

    const previousSlides = useRef("{}")
    useEffect(() => {
        if (!slides?.[0]) return
        const serialized = JSON.stringify(slides[0])
        if (serialized === previousSlides.current) return
        previousSlides.current = serialized
        setCurrentOutputSlides(slides[0])
    }, [slides])

    const customText = settings.customText || ""
    const lastDefaultText = useRef("")
    useEffect(() => {
        if (settings.customText) return
        const signature = JSON.stringify([settings, biblesContent.some((a) => a?.attributionRequired)])
        if (lastDefaultText.current === signature) return
        lastDefaultText.current = signature
        let text = ""
        Object.keys(textKeys).forEach((key) => {
            let isEnabled = settings[key]
            if (key === "showVersion" && biblesContent.find((a) => a?.attributionRequired)) isEnabled = true
            if (isEnabled) {
                if (text.length) text += "\n"
                text += textKeys[key as keyof typeof textKeys]
            }
        })
        scriptureSettings.update((a) => {
            a.customText = text
            return a
        })
    }, [settings, biblesContent])

    const customTextRef = useRef(customText)
    customTextRef.current = customText

    function update(id: string, value: unknown) {
        scriptureSettings.update((a) => {
            a[id] = value
            return a
        })

        if (Object.keys(textKeys).includes(id)) updateCustomText(id, Boolean(value))

        if (id === "splitLongVerses") setLongVersesMenuOpened(Boolean(value))
        // La rama original también asignaba `referenceMenuOpened`, que nunca se usa en el markup.
    }

    function updateCustomText(id: string, value: boolean) {
        const key = textKeys[id as keyof typeof textKeys]
        let text = customTextRef.current
        if (value) {
            if (text.includes(key)) return
            if (text.length && !text.includes("\n")) text += "\n"
            text += key
            update("customText", text)
            return
        }
        text = text.replaceAll(key, "")
        if (!text.split("\n")[0] && text.length) text = text.replaceAll("\n", "")
        update("customText", text)
    }

    function editTemplate() {
        if (styleScriptureTemplate) {
            activeStyle.set(styleId)
            openSettings("styles")
            return
        }
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")
    }

    const containsJesusWords = Object.values(biblesContent?.[0]?.verses?.[0] || {})?.find((text) => typeof text === "string" && (text.includes('<span class="wj"') || text.includes("<red") || text.includes("color:red;") || text.includes("!{")))

    const converted = useRef("")
    useEffect(() => {
        const next = useOldScriptureSystem(templateId, allTemplates) && !styleScriptureTemplate
        setUseOldSystem(next)
        if (!next || !usingDefault || styleScriptureTemplate.includes("scripture") || converted.current === templateId) return
        converted.current = templateId
        void convertToNew()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, allTemplates, styleScriptureTemplate, usingDefault])

    async function convertToNew() {
        if (!usingDefault) {
            const ok = await confirmCustom("This will apply the default template, and convert that to the new format. Your current template will not change.<br>You can use it as an example to adapt your existing templates. Continue?")
            if (!ok) return
        }
        setDefaultScriptureTemplates()
        update("template", "scripture")
        setUseOldSystem(false)
    }

    function setTemplateSettings(key: string, value: unknown) {
        if (!templateId) return
        const templateSettings = template?.settings || {}
        templateSettings[key] = value
        const newData = { key: "settings", data: clone(templateSettings) }
        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    const bgPath = templateBackground
    const mediaStyle: MediaStyle = bgPath ? getMediaStyle(allMedia[bgPath], outputStyle) : {}

    const preview: ReactNode = (
        <>
            {bgPath ? <SvelteIsland component={MediaSvelte} props={{ path: bgPath, mediaStyle, videoData: { paused: false, muted: true, loop: true }, mirror: true }} /> : null}
            <Fragment key={JSON.stringify(currentOutputSlides)}>
                {currentOutputSlides.map((item, i) => (
                    <SvelteIsland key={i} component={TextboxSvelte} props={{ item, outputStyle, ref: { id: "scripture" } }} />
                ))}
            </Fragment>
            {attributionString ? <p className={css.attributionString}>{attributionString.slice(0, 135)}</p> : null}
        </>
    )

    return (
        <div className={`${css.scroll} split scripture`} style={{ paddingBottom: "46px" }}>
            <SvelteIsland component={ZoomedSvelte} props={{ style: "width: 100%;", background }} slots={{ default: preview }} />

            <div className={`settings border ${css.settings}`}>
                {optionsOpen ? (
                    <>
                        <ToggleField label="scripture.verse_numbers" style={{ width: "100%" }} checked={Boolean(settings.verseNumbers)} onChange={(value) => update("verseNumbers", value)} />
                        <ToggleField label="scripture.verses_on_individual_lines" checked={Boolean(settings.versesOnIndividualLines)} defaultValue={false} onChange={(value) => update("versesOnIndividualLines", value)} />
                        <InputRow
                            arrow={Boolean(settings.splitLongVerses)}
                            open={longVersesMenuOpened}
                            onOpenChange={setLongVersesMenuOpened}
                            menu={
                                settings.splitLongVerses ? (
                                    <>
                                        <ToggleField label="scripture.split_long_verses_suffix" checked={Boolean(settings.splitLongVersesSuffix)} defaultValue={false} onChange={(value) => update("splitLongVersesSuffix", value)} />
                                        <NumberField label="edit.size" value={Number(settings.longVersesChars || 100)} defaultValue={100} min={3} onChange={(value) => update("longVersesChars", value)} />
                                        <NumberField label="scripture.tolerance" value={Number(settings.longVersesTolerance || 0)} defaultValue={0} min={0} max={100} onChange={(value) => update("longVersesTolerance", value)} />
                                    </>
                                ) : undefined
                            }
                        >
                            <ToggleField label="scripture.divide_long_verses" style={{ width: "100%" }} checked={Boolean(settings.splitLongVerses)} defaultValue={false} onChange={(value) => update("splitLongVerses", value)} />
                        </InputRow>
                        {settings.redJesus || containsJesusWords ? (
                            <>
                                <ToggleField label="scripture.red_jesus" style={{ width: "100%" }} checked={Boolean(settings.redJesus)} defaultValue={false} onChange={(value) => update("redJesus", value)} />
                                <ColorField label="edit.color" value={String(settings.jesusColor || "#FF4136")} defaultValue="#FF4136" onChange={(value) => update("jesusColor", value)} />
                            </>
                        ) : null}
                        <ToggleField label="scripture.smart_split" style={{ marginTop: "10px", width: "100%" }} checked={settings.smartSplit !== false} defaultValue={true} onChange={(value) => update("smartSplit", value)} />
                        {settings.smartSplit === false ? <NumberField label="scripture.max_verses" value={Number(settings.versesPerSlide || 3)} defaultValue={3} min={1} max={100} hideWhenZero onChange={(value) => update("versesPerSlide", value)} /> : null}
                    </>
                ) : (
                    <>
                        <InputRow style={templateBackground ? undefined : { marginBottom: "10px" }}>
                            <PopupField id="scripture_drawer" label="info.template" disabled={Boolean(styleScriptureTemplate)} value={templateId} name={template?.name || ""} popupId="select_template" icon="templates" onChange={(value) => update("template", value)} allowEmpty={!isDefault} />
                            {(templateId && template) || styleScriptureTemplate ? <Button title="titlebar.edit" icon="edit" onClick={editTemplate} /> : null}
                        </InputRow>
                        {templateBackground ? (
                            <InputRow style={{ marginBottom: "10px", borderLeft: "4px solid var(--primary-lighter)" }}>
                                <FileField label="edit.background_media" value={templateBackground} filter={{ name: "Media files", extensions: mediaExtensions }} onChange={(value) => setTemplateSettings("backgroundPath", value)} />
                            </InputRow>
                        ) : null}
                        {useOldSystem || (styleScriptureTemplate ? useOldScriptureSystem(styleScriptureTemplate) : false) ? (
                            <p style={{ marginBottom: "10px", fontSize: "var(--text-sm)", opacity: 0.7, whiteSpace: "normal" }}>
                                You are using a template with no scripture values! - <Link url="https://freeshow.app/docs/scripture#template">Read more</Link>
                            </p>
                        ) : null}
                        {useOldSystem ? (
                            <Button variant="outline" style={{ marginBottom: "10px" }} onClick={() => void convertToNew()}>
                                {usingDefault ? "Convert template to new system" : "Use default template"}
                            </Button>
                        ) : null}
                        <Button variant="outline" icon="slide" title="new.show_convert [Ctrl+N]" onClick={() => void createScriptureShow()}>
                            <T id="new.show_convert" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
