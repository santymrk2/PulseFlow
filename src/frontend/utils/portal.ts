// Mueve un nodo al <body> mientras exista. Los menús desplegables lo usan para no quedar recortados por el
// `overflow` de los paneles ni por los `transform` de los popups.
export function portal(node: HTMLElement, target: HTMLElement = document.body) {
    target.appendChild(node)
    return {
        destroy() {
            node.remove()
        }
    }
}
