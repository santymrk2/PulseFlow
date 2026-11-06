import { expect, test } from "vitest"
import { parseTscErrors } from "./checkReactTypes"

test("parseTscErrors lee ruta(línea,col): error TSxxxx: mensaje", () => {
    const output = ["src/frontend/react/ui/button/Button.tsx(3,7): error TS2322: Type 'string' is not assignable to type 'number'.", "src/frontend/stores.ts(10,1): error TS2304: Cannot find name 'x'."].join("\n")
    expect(parseTscErrors(output)).toEqual([
        { file: "src/frontend/react/ui/button/Button.tsx", line: 3, message: "Type 'string' is not assignable to type 'number'." },
        { file: "src/frontend/stores.ts", line: 10, message: "Cannot find name 'x'." }
    ])
})
