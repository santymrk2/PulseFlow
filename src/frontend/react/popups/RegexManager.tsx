import { useState } from "react"
import { get } from "../../lib/store"
import { activePopup, globalRegexes, popupData } from "../../stores"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import { TextField } from "../ui/text-field/TextField"
import { useStore } from "../hooks/useStore"
import styles from "./RegexManager.module.css"

// Port de components/main/popups/RegexManager.svelte. Lee popupData.id al montar (y previousPopup/previousData al volver) y globalRegexes en forma reactiva.
// Escribe: globalRegexes[id].label/value y, al volver, popupData/activePopup. Los {@html} del original se portan con dangerouslySetInnerHTML sobre el mismo HTML generado y saneado.
export function RegexManager() {
    const [regexId] = useState<string>(() => get(popupData).id || "")
    const globalRegexesValue = useStore(globalRegexes)
    const [testInput, setTestInput] = useState("Lorem ipsum 123! test@example.com https://example.com/path?q=1&x=2 #tag (alpha)_beta +47.5%")

    const label = globalRegexesValue[regexId]?.label || ""
    const pattern = globalRegexesValue[regexId]?.value || ""
    const isValid = validateRegex(pattern)
    const previewHtml = getPreviewHtml(pattern, testInput)
    const patternHtml = highlightRegexSyntax(pattern)

    function update(key: string, value: string) {
        globalRegexes.update((a) => {
            if (!a[regexId]) a[regexId] = { label: "", value: "" }
            a[regexId][key] = value
            return a
        })
    }

    function setRegex(regex: string) {
        regex = regex.trim()
        if (regex && !regex.startsWith("/")) regex = "/" + regex
        // Skip the opening slash so it can't be mistaken for the closing delimiter
        if (regex && !/\/[gimsuy]*$/.test(regex.slice(1))) regex = regex + "/"
        // Normalize double backslashes to single (support pasting string-escaped regexes)
        const m = regex.match(/^(\/)(.*)(\/)([gimsuy]*)$/)
        if (m) regex = m[1] + m[2].replace(/\\\\/g, "\\") + m[3] + m[4]
        update("value", regex)
    }

    function goBack() {
        const popup = get(popupData)
        const previousPopup = popup.previousPopup
        if (popup.previousData) popupData.set(popup.previousData)
        if (previousPopup) activePopup.set(previousPopup)
    }

    function validateRegex(pat: string): boolean {
        const match = pat.match(/^\/(.*)\/([gimsuy]*)$/)
        if (!match) return false
        try {
            new RegExp(match[1], match[2])
            return true
        } catch {
            return false
        }
    }

    function escapeHtml(s: string): string {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }

    function highlightRegexSyntax(pat: string): string {
        const match = pat.match(/^(\/)(.*)(\/)([gimsuy]*)$/)
        if (!match) return `<span class="rx-literal">${escapeHtml(pat)}</span>`
        const [, open, body, close, flags] = match
        return `<span class="rx-delim">${escapeHtml(open)}</span>` + tokenizeRegex(body) + `<span class="rx-delim">${escapeHtml(close)}</span>` + (flags ? `<span class="rx-flag">${escapeHtml(flags)}</span>` : "")
    }

    function tokenizeRegex(body: string): string {
        let result = ""
        let i = 0
        while (i < body.length) {
            const ch = body[i]
            if (ch === "\\") {
                result += `<span class="rx-escape">${escapeHtml(body.slice(i, i + 2))}</span>`
                i += 2
            } else if (ch === "[") {
                let j = i + 1
                if (j < body.length && body[j] === "^") j++
                while (j < body.length) {
                    if (body[j] === "\\") j++
                    else if (body[j] === "]") break
                    j++
                }
                result += `<span class="rx-charclass">${escapeHtml(body.slice(i, j + 1))}</span>`
                i = j + 1
            } else if (ch === "(") {
                result += `<span class="rx-group">(</span>`
                i++
                if (body[i] === "?") {
                    let k = i + 1
                    while (k < body.length && /[:<>=!]/.test(body[k])) k++
                    result += `<span class="rx-group-mod">${escapeHtml(body.slice(i, k))}</span>`
                    i = k
                }
            } else if (ch === ")") {
                result += `<span class="rx-group">)</span>`
                i++
            } else if (/[*+?]/.test(ch)) {
                let q = ch
                i++
                if (i < body.length && body[i] === "?") {
                    q += "?"
                    i++
                }
                result += `<span class="rx-quantifier">${escapeHtml(q)}</span>`
            } else if (ch === "{") {
                let j = i + 1
                while (j < body.length && body[j] !== "}") j++
                result += `<span class="rx-quantifier">${escapeHtml(body.slice(i, j + 1))}</span>`
                i = j + 1
            } else if (ch === "^" || ch === "$") {
                result += `<span class="rx-anchor">${escapeHtml(ch)}</span>`
                i++
            } else if (ch === "|") {
                result += `<span class="rx-alternation">|</span>`
                i++
            } else if (ch === ".") {
                result += `<span class="rx-dot">.</span>`
                i++
            } else {
                result += `<span class="rx-literal">${escapeHtml(ch)}</span>`
                i++
            }
        }
        return result
    }

    function getPreviewHtml(pat: string, text: string): string {
        if (!text) return ""
        const match = pat.match(/^\/(.*)\/([gimsuy]*)$/)
        if (!match) return escapeHtml(text)
        let regex: RegExp
        try {
            const flags = match[2].includes("g") ? match[2] : match[2] + "g"
            regex = new RegExp(match[1], flags)
        } catch {
            return escapeHtml(text)
        }
        let result = ""
        let lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = regex.exec(text)) !== null) {
            result += escapeHtml(text.slice(lastIndex, m.index))
            result += `<mark>${escapeHtml(m[0])}</mark>`
            lastIndex = m.index + m[0].length
            if (m[0].length === 0) {
                regex.lastIndex++
                lastIndex++
            }
        }
        result += escapeHtml(text.slice(lastIndex))
        return result
    }

    return (
        <>
            <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={goBack} />

            <TextField label="midi.description" value={label} onChange={(value) => update("label", value ?? "")} />
            <TextField label="/regex/" value={pattern} onChange={(value) => setRegex(value ?? "")} autofocus />

            <HRule />

            <div className={styles.preview}>
                {pattern ? (
                    <div className={`${styles.regexDisplay} ${isValid ? styles.valid : styles.invalid}`}>
                        <code className={styles.regexHighlight} dangerouslySetInnerHTML={{ __html: patternHtml }} />
                        <span className={styles.validityBadge}>{isValid ? "✓" : "✗"}</span>
                    </div>
                ) : null}

                <TextField label="timer.preview" value={testInput} onChange={(value) => setTestInput(value ?? "")} />
                {testInput ? <div className={styles.previewText} dangerouslySetInnerHTML={{ __html: previewHtml }} /> : null}
            </div>
        </>
    )
}
