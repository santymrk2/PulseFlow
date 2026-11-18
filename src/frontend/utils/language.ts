import { get } from "../lib/store"
import type { DropdownOptions } from "../../types/Input"
import type { Dictionary } from "../../types/Settings"
import { sortByName } from "../components/helpers/array"
import { dictionary, language, localeDirection } from "../stores"
import { isMainWindow } from "./common"
import { languageFlags, languages, replace } from "./languageData"

// https://medium.com/i18n-and-l10n-resources-for-developers/a-step-by-step-guide-to-svelte-localization-with-svelte-i18n-v3-2c3ff0d645b8
// https://github.com/kaisermann/svelte-i18n/blob/70725828bd3aa2ba77fe37dccb2890c57b27f6e4/src/cli/includes/deepSet.ts#L5
// https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
// https://lokalise.com/blog/svelte-i18n/

const defaultPath = "./lang/en.json"

// WIP right to left
// const dir = derived(language, ($locale) => ($locale === "ar" ? "rtl" : "ltr"))

let loadingLocale = ""

// F25.9: ante un fallo de red se cae al inglés (como en F25.6): idioma activo "en",
// diccionario en.json (o el anterior si tampoco carga) y `localeDirection` se mantiene
// "ltr", acorde con "en". No se escribe settings: eso lo hace updateSettings.
function isDictionary(value: unknown): value is Dictionary {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function fetchDictionary(path: string): Promise<Dictionary> {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`No se pudo cargar ${path}: ${response.status}`)
    const messages: unknown = await response.json()
    if (!isDictionary(messages)) throw new Error(`JSON inválido en ${path}`)
    return messages
}

async function fallbackToEnglish(requestedLocale: string): Promise<void> {
    if (loadingLocale !== requestedLocale) return

    language.set("en")
    loadingLocale = "en"

    try {
        const messages = await fetchDictionary(defaultPath)
        if (loadingLocale !== "en") return
        dictionary.set(messages)
    } catch {
        // Sin red ni siquiera para el inglés: se conserva el diccionario ya cargado
        // (o `{}` en el arranque) y translateText deja las claves visibles.
    }
}

function setLanguage(locale = "", init = false) {
    if (!locale) {
        // locale = getLocaleFromHostname(/^(.*?)\./) || getLocaleFromPathname(/^\/(.*?)\//) || getLocaleFromNavigator() || getLocaleFromHash('lang') || 'en';
        // locale = window.navigator.userLanguage || window.navigator.language || 'en';
        locale = window.navigator.language
        Object.keys(replace).forEach((key) => {
            if (replace[key].includes(locale)) locale = key
        })
    }

    if (!replace[locale]) locale = "en"
    language.set(locale)

    const rtlLanguages = ["ar", "fa", "he", "ur"]
    localeDirection.set(rtlLanguages.includes(locale) ? "rtl" : "ltr")

    loadingLocale = locale
    const url = defaultPath.replace("en", locale)
    fetchDictionary(url)
        .then(returnedFile)
        // F25.9: este catch cubre tanto el fetch del idioma como el de en.json en returnedFile.
        .catch(() => fallbackToEnglish(locale))

    async function returnedFile(messages: Dictionary) {
        if (loadingLocale !== locale) return

        // replace any missing keys in dictionary with fallback english string
        if (locale !== "en") {
            const defaultStrings = await fetchDictionary(defaultPath)
            if (loadingLocale !== locale) return

            Object.keys(defaultStrings).forEach((key) => {
                if (!messages[key]) messages[key] = defaultStrings[key]
                else {
                    Object.keys(defaultStrings[key]).forEach((stringId) => {
                        if (!(messages[key]![stringId] || "").trim()) messages[key]![stringId] = defaultStrings[key][stringId]
                    })
                }
            })
        }

        dictionary.set(messages)
        if (init || !isMainWindow()) return

        language.set(locale)

        // F10.0f: `LANGUAGE` se eliminó del frontend (inventario F7.1): su
        // destinatario era el menú nativo de Electron (`setGlobalMenu`) y la
        // webview de salida, ninguno de los dos existe en PulseFlow.
        // El idioma para el control remoto lo difunde `remoteTalk.ts` (canal
        // REMOTE → `SERVER_SEND`).
        //
        // "wait until loaded": el delay de 3 s que reenviaba el idioma a la
        // webview de salida ya no hace falta.
    }
}

// new translate function
// can take a "main.yes" into "Yes", or "main.yes [y]" into "Yes [y]"
export function translateText(text: string, _updater: any = null, replaceValues: string[] = []) {
    if (typeof text !== "string" || !text) return ""

    const dict = get(dictionary)

    return text
        .replace(/\$?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g, (match, key1, key2) => {
            if (dict[key1] && dict[key1][key2]) {
                return dict[key1][key2]
            }

            return match
        })
        .replace(/\$(\d+)/g, (match, index) => {
            const value = replaceValues[Number(index) - 1]
            return value !== undefined ? value : match
        })
}

export { setLanguage }

// Chinese, Japanese, and Korean should use full width brackets: "（" / "）"
const fullWidth = ["zh", "ja", "ko"]
export const getLeftParenthesis = () => (fullWidth.find((id) => get(language).includes(id)) ? "（" : "(")
export const getRightParenthesis = () => (fullWidth.find((id) => get(language).includes(id)) ? "）" : ")")

// dropdown selector
export function getLanguageList() {
    let options: DropdownOptions = Object.keys(languages).map((id) => ({ label: languages[id], value: id }))
    options = sortByName(options, "label")

    // add flags after sorting
    options = options.map((a) => ({ ...a, prefix: languageFlags[a.value] || "" }))

    return options
}
