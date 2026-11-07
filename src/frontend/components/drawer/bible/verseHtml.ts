export const VERSE_TOKEN_TYPE = { TEXT: "text", TAG: "tag" } as const
export type VerseTokenType = (typeof VERSE_TOKEN_TYPE)[keyof typeof VERSE_TOKEN_TYPE]

export interface VerseToken {
    type: VerseTokenType
    value: string
}

// Only these tags survive sanitization; anything else is dropped and its text is kept
const EMPHASIS_TAG = /^<\/?(i|em|b|strong|sup|sub)>$/i
const WJ_OPEN_TAG = '<span class="wj">'
const UNDERTITLE_OPEN_TAG = '<span class="undertitle">'
const SPAN_CLOSE_TAG = "</span>"
// Formas de rojo que reconoce markJesusWords (scripture.ts, RED_OPEN_TAG): exactas, sin comodines
const WJ_OPEN_TAG_SPACED = '<span class="wj" >'
const RED_STYLE_OPEN_TAG = '<span style="color:red;">'
const RED_STYLE_OPEN_TAG_SPACED = '<span style="color:red;" >'
const RED_OPEN_TAG = "<red>"
const RED_OPEN_TAG_SPACED = "<red >"
const RED_CLOSE_TAG = "</red>"
const SPAN_OPEN_TAGS: readonly string[] = [WJ_OPEN_TAG, WJ_OPEN_TAG_SPACED, RED_STYLE_OPEN_TAG, RED_STYLE_OPEN_TAG_SPACED, UNDERTITLE_OPEN_TAG]
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

    let spanDepth = 0
    let redDepth = 0
    let out = ""
    for (const token of tokenizeHtml(withoutMultipleSpaces)) {
        if (token.type === VERSE_TOKEN_TYPE.TEXT) {
            out += token.value.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        } else if (EMPHASIS_TAG.test(token.value)) {
            out += token.value
        } else if (SPAN_OPEN_TAGS.includes(token.value)) {
            spanDepth++
            out += token.value
        } else if (RED_TAG_OPENS.includes(token.value)) {
            redDepth++
            out += token.value
        } else if (token.value === SPAN_CLOSE_TAG && spanDepth > 0) {
            spanDepth--
            out += token.value
        } else if (token.value === RED_CLOSE_TAG && redDepth > 0) {
            redDepth--
            out += token.value
        }
    }

    return out.trim()
}
