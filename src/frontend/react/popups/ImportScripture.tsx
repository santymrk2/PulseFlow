import type { CustomBibleListContent } from "json-bible/lib/api/ApiBible"
import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import { Main } from "../../../types/IPC/Main"
import { customBibleData, getApiBiblesList } from "../../components/drawer/bible/scripture"
import { sortByName } from "../../components/helpers/array"
import { Loader } from "../main/Loader"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { scriptures } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { Center } from "../system/Center"
import { Button } from "../ui/button/Button"
import { CheckboxField } from "../ui/checkbox-field/CheckboxField"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"
import { HRule } from "../ui/h-rule/HRule"
import { Link } from "../ui/link/Link"
import { TextField } from "../ui/text-field/TextField"
import styles from "./ImportScripture.module.css"

// Port de components/main/popups/ImportScripture.svelte. Lee y escribe `scriptures` (marcar/desmarcar una biblia de la API agrega o borra su entrada).
// IPC: Main.READ_BIBLES_FOLDER (lista de la carpeta local), Main.IMPORT_FILES { id: "BIBLE", paths: [path] } (una biblia de la carpeta) y
// Main.IMPORT { channel: "BIBLE", format: { name: "Bible", extensions: ["xml","xmm","json","fsb"] } } (elegir archivo). Este popup no muestra ni importa
// texto bíblico (sólo nombres/descripciones de la lista): el filtro sanitizeVerseText corre en el resto del flujo, igual que antes. Cerrar no escribe nada.
// Se conserva a propósito del Svelte: `recommended` es un arreglo que se acumula, así que volver a entrar en "API" repite las recomendadas (ref `acumuladas`);
// al terminar de cargar la lista se vacía la búsqueda aplicada (el campo de texto no se borra), como el `$: searched = bibles`.
type Bible = CustomBibleListContent

const checkboxStyle = (bible: Bible) => (bible.source === "youversion" ? { borderLeft: "2px solid #4a3a30" } : bible.source === "api.bible" ? { borderLeft: "2px solid #253354" } : undefined)

function matches(bible: Bible, value: string) {
    return value.split(" ").find((word) => bible.name.toLowerCase().includes(word))
}

export function ImportScripture() {
    const scripturesValue = useStore(scriptures)
    const [bibles, setBibles] = useState<Bible[]>([])
    const [recommended, setRecommended] = useState<Bible[]>([])
    const acumuladas = useRef<Bible[]>([])
    const [error, setError] = useState<unknown>(null)
    const [query, setQuery] = useState("")
    const [importType, setImportType] = useState("")
    const [localBibles, setLocalBibles] = useState<{ path: string; name: string }[]>([])

    const importTypes = [
        { id: "api", name: "API", icon: "web" }, // translate | scripture_alt
        { id: "local", name: translateText("cloud.local"), icon: "folder" } // scripture
    ]

    useEffect(() => {
        if (importType === "api") loadApiBibles()
        if (importType === "local") getLocalBibles()
    }, [importType])

    async function loadApiBibles() {
        try {
            let bibleList = await getApiBiblesList()
            bibleList = bibleList.map((a) => {
                const bible = customBibleData(a)
                if (bible.description && (bible.description.toLowerCase() === "common" || bible.description === "Holy Bible" || bible.name.includes(bible.description))) bible.description = ""
                return bible
            })

            // F25.6: los códigos de API.Bible (eng, spa, nob…) son independientes del
            // selector de idiomas de la UI: se compara el subtag principal del locale
            // directamente, sin el mapa `replace` que se podó con los idiomas borrados.
            // "nb"/"nn" se normalizan al prefijo "no" que usa API.Bible para el noruego.
            const primary = window.navigator.language.split("-")[0].toLowerCase()
            const langCodes = primary === "nb" || primary === "nn" ? [primary, "no"] : [primary]
            // if it needs attribution, it's probably more in demand!
            bibleList = sortByName(bibleList).sort((a, b) => Number(b.attributionRequired || b.attributionString) - Number(a.attributionRequired || a.attributionString))
            const newSorted: Bible[] = []
            bibleList.forEach((bible) => {
                newSorted.push(bible)
                if (langCodes.some((code) => bible.language.includes(code))) {
                    acumuladas.current.push({ ...bible, name: bible.nameLocal || bible.name, description: bible.nameLocal ? bible.name : bible.description })
                    newSorted.pop()
                }
            })
            setBibles(newSorted)
            setRecommended([...acumuladas.current])
            setQuery("")
        } catch (err) {
            setError(err)
        }
    }

    async function getLocalBibles() {
        const found: { path: string; name: string }[] = (await requestMain(Main.READ_BIBLES_FOLDER)) || []
        const existingBibles = Object.values(get(scriptures)).map((a) => a.name.replace(/\.fsb$/i, ""))
        // remove already existing
        setLocalBibles(found.filter((a) => !existingBibles.includes(a.name)))
    }

    function toggleScripture(bible: Bible) {
        scriptures.update((a) => {
            const id = bible.sourceKey
            const existingId = Object.entries(a).find(([_key, value]) => value.id === id)?.[0]

            if (existingId) delete a[existingId]
            else a[uid()] = { name: bible.name, api: true, id, metadata: { copyright: bible.copyright }, attributionRequired: bible.attributionRequired, attributionString: bible.attributionString }

            return a
        })
    }

    function search(text: string) {
        const value = text.toLowerCase()
        setQuery(value.length < 2 ? "" : value)
    }

    function importBible(path: string) {
        sendMain(Main.IMPORT_FILES, { id: "BIBLE", paths: [path] })
    }

    const searchedBibles = query ? bibles.filter((a) => matches(a, query)) : bibles
    const searchedRecommendedBibles = query ? recommended.filter((a) => matches(a, query)) : recommended

    const bibleCheckbox = (bible: Bible, i: number) => <CheckboxField key={i} label={bible.name} title={`${bible.source === "youversion" ? "[YouVersion] " : ""}${bible.name}`} data={bible.description} style={checkboxStyle(bible)} checked={!!Object.values(scripturesValue).find((a) => a.id === bible.sourceKey)} onChange={() => toggleScripture(bible)} />

    return (
        <>
            {importType ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setImportType("")} /> : null}

            {importType === "api" ? (
                error ? (
                    <T id="error.bible_api" />
                ) : (
                    <>
                        <div className={styles.info}>{translateText("captions.powered_by")} API.Bible &amp; YouVersion</div>

                        <TextField label="main.search" id="scriptureApiSearchInput" value="" onInput={(value) => search(value ?? "")} autofocus />

                        <div className={styles.list}>
                            {searchedRecommendedBibles.length ? (
                                <>
                                    {searchedRecommendedBibles.map(bibleCheckbox)}

                                    {searchedBibles.length ? <hr className={styles.separator} /> : null}
                                </>
                            ) : null}

                            {bibles.length ? (
                                searchedBibles.length ? (
                                    searchedBibles.map(bibleCheckbox)
                                ) : !searchedRecommendedBibles.length ? (
                                    <Center faded>
                                        <T id="empty.search" />
                                    </Center>
                                ) : null
                            ) : (
                                <Center>
                                    <Loader />
                                </Center>
                            )}
                        </div>
                    </>
                )
            ) : importType === "local" ? (
                <>
                    {localBibles.length ? (
                        <>
                            <div className={styles.existingBiblesList}>
                                {localBibles.map((localBible, i) => (
                                    <Button key={i} variant="outline" icon="import" style={{ justifyContent: "left" }} onClick={() => importBible(localBible.path)} white>
                                        {localBible.name}
                                    </Button>
                                ))}
                            </div>

                            <HRule />
                        </>
                    ) : null}

                    <p style={{ fontSize: "1.1em" }}>
                        <T id="scripture.supported_formats" />
                    </p>
                    <ul style={{ listStyle: "inside" }}>
                        <li>
                            <span style={{ fontSize: "0.9em", fontWeight: "bold" }}>XML</span>
                            <span style={{ fontSize: "0.8em", opacity: 0.8, marginLeft: "10px" }}>Zefania/OSIS/Beblia/OpenSong</span>
                        </li>
                        <li>
                            <span style={{ fontSize: "0.9em", fontWeight: "bold" }}>JSON</span>
                            <span style={{ fontSize: "0.8em", opacity: 0.8, marginLeft: "10px" }}>PulseFlow</span>
                        </li>
                    </ul>

                    <p style={{ margin: "20px 0", opacity: 0.9 }}>
                        Find some available <Link url="https://freeshow.app/resources#scriptures">Bible versions</Link>.
                    </p>

                    <Button variant="outline" icon="import" onClick={() => sendMain(Main.IMPORT, { channel: "BIBLE", format: { name: "Bible", extensions: ["xml", "xmm", "json", "fsb"] } })}>
                        <T id="scripture.local" />
                    </Button>
                </>
            ) : (
                <ChoiceGrid options={importTypes} onClick={setImportType} />
            )}
        </>
    )
}
