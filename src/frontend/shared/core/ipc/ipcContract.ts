// Lectura de los tres lados del contrato de IPC (F15.2). Funciones puras sobre texto, para testear.

/** Nombres de los miembros de `enum Main` (`NAME = "NAME"`). */
export function parseMainEnum(source: string): Set<string> {
    const body = source.match(/export enum Main \{([\s\S]*?)\n\}/)?.[1] ?? ""
    return new Set([...body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]))
}

/** Comandos registrados en `tauri::generate_handler!` (`commands::modulo::NOMBRE`). */
export function parseRegisteredCommands(source: string): Set<string> {
    return new Set([...source.matchAll(/commands::[a-z_0-9]+::([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))
}

/** Canales marcados como pospuestos en `IPC/tauri.ts` (`POSTPONED_COMMANDS`). */
export function parsePostponed(source: string): Set<string> {
    const body = source.match(/const POSTPONED_COMMANDS = new Set<Main>\(\[([\s\S]*?)\]\)/)?.[1] ?? ""
    return new Set([...body.matchAll(/Main\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))
}

/** Canales `Main.X` que aparecen en el código del frontend y existen en el enum. */
export function collectChannelUses(sources: string[], enumNames: Set<string>): Set<string> {
    const used = new Set<string>()
    for (const text of sources) {
        for (const match of text.matchAll(/\bMain\.([A-Z][A-Z0-9_]*)\b/g)) {
            if (enumNames.has(match[1])) used.add(match[1])
        }
    }
    return used
}

/**
 * `unmapped`: usados sin comando, sin marca de pospuesto y sin excepción.
 * `staleKnown`: excepciones que ya no hacen falta (nadie las usa o ya tienen comando/marca).
 */
export function classifyChannels(input: { used: Set<string>; registered: Set<string>; postponed: Set<string>; known: Set<string> }) {
    const covered = (name: string) => input.registered.has(name) || input.postponed.has(name)
    const unmapped = [...input.used].filter((name) => !covered(name) && !input.known.has(name)).sort()
    const staleKnown = [...input.known].filter((name) => !input.used.has(name) || covered(name)).sort()
    return { unmapped, staleKnown }
}
