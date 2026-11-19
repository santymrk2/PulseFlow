export const VERSE_TOKEN_TYPE = { TEXT: "text", TAG: "tag" } as const
export type VerseTokenType = (typeof VERSE_TOKEN_TYPE)[keyof typeof VERSE_TOKEN_TYPE]

export interface VerseToken {
    type: VerseTokenType
    value: string
}

// Only these tags survive sanitization; anything else is dropped and its text is kept
const EMPHASIS_TAG = /^<\/?(i|em|b|strong|sup|sub|u|del)>$/i
const WJ_OPEN_TAG = '<span class="wj">'
const UNDERTITLE_OPEN_TAG = '<span class="undertitle">'
// Formas de rojo que reconoce markJesusWords (scripture.ts, RED_OPEN_TAG): exactas, sin comodines
const WJ_OPEN_TAG_SPACED = '<span class="wj" >'
const RED_STYLE_OPEN_TAG = '<span style="color:red;">'
const RED_STYLE_OPEN_TAG_SPACED = '<span style="color:red;" >'
// Formas de json-bible (parseMarkdown) que no son rojo: lo incierto va en span; subrayado y tachado como el énfasis
const UNCERTAIN_OPEN_TAG = '<span class="uncertain">'
const RED_OPEN_TAG = "<red>"
const RED_OPEN_TAG_SPACED = "<red >"
const SPAN_OPEN_TAGS: readonly string[] = [WJ_OPEN_TAG, WJ_OPEN_TAG_SPACED, RED_STYLE_OPEN_TAG, RED_STYLE_OPEN_TAG_SPACED, UNDERTITLE_OPEN_TAG, UNCERTAIN_OPEN_TAG]
const RED_TAG_OPENS: readonly string[] = [RED_OPEN_TAG, RED_OPEN_TAG_SPACED]

export function tokenizeHtml(value: string): VerseToken[] {
    const tokens: VerseToken[] = []
    const regex = /<\/?[a-z][^>]*>/gi
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(value))) {
        if (match.index > lastIndex) tokens.push({ type: VERSE_TOKEN_TYPE.TEXT, value: value.slice(lastIndex, match.index) })
        tokens.push({ type: VERSE_TOKEN_TYPE.TAG, value: match[0] })
        lastIndex = regex.lastIndex
    }
    if (lastIndex < value.length) tokens.push({ type: VERSE_TOKEN_TYPE.TEXT, value: value.slice(lastIndex) })
    return tokens
}

export function sanitizeVerseText(input: unknown): string {
    if (input === null || input === undefined) return ""

    const text = typeof input === "string" ? input : String(input)
    const withoutBreaks = text.replace(/<\s*br\s*\/?>/gi, " ")
    const normalizedSpaces = withoutBreaks.replace(/\u00a0/g, " ")
    const withQuotes = normalizedSpaces.replace(/<q>(.*?)<\/q>/g, "“$1”")
    const replacedUndertitles = withQuotes.replace(/<h4[^>]*>(.*?)<\/h4>\s*/g, '<span class="undertitle">$1 </span>')
    const withoutMultipleSpaces = replacedUndertitles.replace(/ {2,}/g, " ")

    // Una pila por tipo de etiqueta: cada cierre vuelve a la apertura que le toca, aunque la apertura se haya descartado
    const spanStack: boolean[] = []
    const redStack: boolean[] = []
    let out = ""
    for (const token of tokenizeHtml(withoutMultipleSpaces)) {
        if (token.type === VERSE_TOKEN_TYPE.TEXT) {
            out += token.value.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        } else if (EMPHASIS_TAG.test(token.value)) {
            out += token.value
        } else {
            const name = tagNameOf(token.value)
            if (name === "span") out += filterPairedTag(token.value, spanStack, SPAN_OPEN_TAGS)
            else if (name === "red") out += filterPairedTag(token.value, redStack, RED_TAG_OPENS)
        }
    }

    return out.trim()
}

function tagNameOf(tag: string) {
    return tag.match(/^<\/?([a-z][a-z0-9-]*)/i)?.[1]?.toLowerCase() ?? ""
}

// Devuelve la etiqueta si se conserva; la pila guarda si cada apertura se conservó
function filterPairedTag(tag: string, stack: boolean[], keptOpens: readonly string[]) {
    if (tag.startsWith("</")) return stack.pop() ? tag : ""
    if (tag.endsWith("/>")) return ""
    const kept = keptOpens.includes(tag)
    stack.push(kept)
    return kept ? tag : ""
}
