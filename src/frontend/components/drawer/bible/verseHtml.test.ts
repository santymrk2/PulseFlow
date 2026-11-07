import { describe, expect, it } from "vitest"
import { sanitizeVerseText } from "./verseHtml"

describe("sanitizeVerseText", () => {
    it("conserva las palabras de Jesús y los subtítulos", () => {
        expect(sanitizeVerseText('<span class="wj">Yo soy</span>')).toBe('<span class="wj">Yo soy</span>')
        expect(sanitizeVerseText("<h4>Título</h4> En el principio")).toBe('<span class="undertitle">Título </span>En el principio')
    })
    it("convierte <q> en comillas y <br> en espacio", () => {
        expect(sanitizeVerseText("dijo: <q>Hola</q><br>fin")).toBe("dijo: “Hola” fin")
    })
    it("quita etiquetas no permitidas y deja su texto", () => {
        expect(sanitizeVerseText("Hola <img src=x onerror=alert(1)>mundo")).toBe("Hola mundo")
        expect(sanitizeVerseText("<script>alert(1)</script>Juan")).toBe("alert(1)Juan")
        expect(sanitizeVerseText('<span class="wj" onclick="x">a</span>')).toBe("a")
        expect(sanitizeVerseText('<a href="javascript:x">b</a>')).toBe("b")
    })
    it("escapa < y > sueltos", () => {
        expect(sanitizeVerseText("a <img src=x onerror=alert(1)//")).toBe("a &lt;img src=x onerror=alert(1)//")
        expect(sanitizeVerseText("1 < 2 > 0")).toBe("1 &lt; 2 &gt; 0")
    })
    it("permite énfasis sin atributos", () => {
        expect(sanitizeVerseText("<i>Señor</i> <sup>3</sup>")).toBe("<i>Señor</i> <sup>3</sup>")
    })
    it("devuelve vacío para valores vacíos", () => {
        expect(sanitizeVerseText(undefined)).toBe("")
        expect(sanitizeVerseText(null)).toBe("")
    })
    it.each(['<span class="wj" >a</span>', '<span style="color:red;">a</span>', '<span style="color:red;" >a</span>', "<red>a</red>", "<red >a</red>"])("conserva la forma de rojo que reconoce markJesusWords: %s", (input) => {
        expect(sanitizeVerseText(input)).toBe(input)
    })
    it("descarta comillas simples y mayúsculas en el span de rojo", () => {
        expect(sanitizeVerseText("<span class='wj'>a</span>")).toBe("a")
        expect(sanitizeVerseText('<SPAN CLASS="WJ">a</SPAN>')).toBe("a")
    })
    it("descarta un </span> huérfano", () => {
        expect(sanitizeVerseText("a</span>b")).toBe("ab")
    })
    it("descarta <i> con atributos, deja su texto y conserva el </i> sin atributos", () => {
        expect(sanitizeVerseText("<i onmouseover=x>a</i>")).toBe("a</i>")
    })
    it("descarta etiquetas autocerradas no permitidas", () => {
        expect(sanitizeVerseText("<sup/>")).toBe("")
    })
    it("conserva el span de rojo anidado en otro", () => {
        expect(sanitizeVerseText('<span class="wj"><span class="wj">a</span></span>')).toBe('<span class="wj"><span class="wj">a</span></span>')
    })
    it("deja las entidades escapadas tal cual", () => {
        expect(sanitizeVerseText("&lt;script&gt;")).toBe("&lt;script&gt;")
    })
})
