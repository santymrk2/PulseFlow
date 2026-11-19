// Ayudas comunes de los tests de conversores (F15.4). Importar DESPUÉS de `./testEnv`.

import { readFileSync } from "node:fs"

/** Lee un archivo de ejemplo de `converters/fixtures/`. */
export const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

/** Toda la letra de un show, en orden de diapositivas, como una sola cadena. */
export function showText(show: any): string {
    return Object.values<any>(show.slides || {})
        .flatMap((slide) => slide.items || [])
        .flatMap((item: any) => item.lines || [])
        .map((line: any) => (line.text || []).map((t: any) => t.value).join(""))
        .join("\n")
}

/** Nombres de grupo (verso, estribillo…) de las diapositivas, en orden. */
export const slideGroups = (show: any): string[] => Object.values<any>(show.slides || {}).map((slide) => slide.group ?? "")
