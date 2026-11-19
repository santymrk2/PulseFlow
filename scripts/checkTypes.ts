export interface TscError {
    file: string
    line: number
    message: string
}

const TSC_ERROR = /^(.+?)\((\d+),\d+\): error TS\d+: (.*)$/

/** Lee la salida de `tsc --pretty false`: `ruta(línea,col): error TSxxxx: mensaje`. */
export function parseTscErrors(output: string): TscError[] {
    const errors: TscError[] = []
    for (const text of output.split("\n")) {
        const match = TSC_ERROR.exec(text.trim())
        if (match) errors.push({ file: match[1], line: Number(match[2]), message: match[3] })
    }
    return errors
}
