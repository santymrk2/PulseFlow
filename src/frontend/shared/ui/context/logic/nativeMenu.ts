// El webview dibuja su propio menú contextual (Reload, Inspect, cortar/pegar…) si el evento `contextmenu` no se cancela.
// El menú de la app (renombrar, duplicar, borrar…) vive en `ContextMenu.svelte`, así que se cancela el nativo para que no
// salgan los dos a la vez. La excepción son los campos de texto de macOS, donde el nativo ya trae cortar/copiar/pegar y
// ortografía: ahí se deja sólo ese. En Windows el nativo no trae "pegar", por eso la app dibuja el suyo.

export function contextMenuMode(isTextInput: boolean, platform: string): "app" | "native" {
    return isTextInput && platform !== "win32" ? "native" : "app"
}
