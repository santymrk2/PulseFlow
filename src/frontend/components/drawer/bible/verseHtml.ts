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

    let depth = 0
    let out = ""
    for (const token of tokenizeHtml(withoutMultipleSpaces)) {
        if (token.type === VERSE_TOKEN_TYPE.TEXT) {
            out += token.value.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        } else if (EMPHASIS_TAG.test(token.value)) {
            out += token.value
        } else if (token.value === WJ_OPEN_TAG || token.value === UNDERTITLE_OPEN_TAG) {
            depth++
            out += token.value
        } else if (token.value === SPAN_CLOSE_TAG && depth > 0) {
            depth--
            out += token.value
        }
    }

    return out.trim()
}
