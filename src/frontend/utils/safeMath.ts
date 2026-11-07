// Reemplaza el antiguo evaluador por Function (ejecutaba código arbitrario): sólo suma, resta, multiplica, divide, módulo, signos y paréntesis.
// Gramática: expr := term (("+"|"-") term)* ; term := factor (("*"|"/"|"%") factor)* ;
// factor := ("+"|"-") factor | number | "(" expr ")" ; number := digits ("." digits)? | "." digits

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9"
const finite = (n: number): number | null => (Number.isFinite(n) ? n : null)

function applyOperator(op: string, a: number, b: number): number | null {
    if ((op === "/" || op === "%") && b === 0) return null
    switch (op) {
        case "+":
            return finite(a + b)
        case "-":
            return finite(a - b)
        case "*":
            return finite(a * b)
        case "/":
            return finite(a / b)
        default:
            return finite(a % b)
    }
}

export function evaluateArithmetic(expression: string): number | null {
    try {
        let pos = 0

        const skipSpaces = () => {
            while (pos < expression.length && /\s/.test(expression[pos])) pos++
        }
        const eat = (char: string): boolean => {
            skipSpaces()
            if (expression[pos] !== char) return false
            pos++
            return true
        }

        const parseNumber = (): number | null => {
            skipSpaces()
            const start = pos
            while (isDigit(expression[pos])) pos++
            if (expression[pos] !== ".") return pos > start ? finite(Number(expression.slice(start, pos))) : null
            pos++
            const fractionStart = pos
            while (isDigit(expression[pos])) pos++
            if (pos === fractionStart) return null
            return finite(Number(expression.slice(start, pos)))
        }

        // Un nivel de precedencia: operando (operador operando)*. Cualquier fallo propaga null.
        const parseBinary = (ops: string[], parseOperand: () => number | null): number | null => {
            let left = parseOperand()
            let op = ops.find((candidate) => eat(candidate))
            while (left !== null && op !== undefined) {
                const right = parseOperand()
                left = right === null ? null : applyOperator(op, left, right)
                op = ops.find((candidate) => eat(candidate))
            }
            return left
        }

        const parseFactor = (): number | null => {
            if (eat("+")) return parseFactor()
            if (eat("-")) {
                const value = parseFactor()
                return value === null ? null : -value
            }
            if (eat("(")) {
                const value = parseExpr()
                return value !== null && eat(")") ? value : null
            }
            return parseNumber()
        }
        const parseTerm = (): number | null => parseBinary(["*", "/", "%"], parseFactor)
        const parseExpr = (): number | null => parseBinary(["+", "-"], parseTerm)

        const result = parseExpr()
        skipSpaces()
        // entrada sobrante (ej. "1)" o "1e3") invalida toda la expresión
        return result !== null && pos === expression.length ? result : null
    } catch {
        // anidación extrema desborda la pila: cualquier cosa que no sea aritmética → null
        return null
    }
}
