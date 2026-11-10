// F23.15: el engine recibe la hora ya formateada; si la escena tiene un reloj, listeners.ts la reenvía cada segundo.
// Módulo sin dependencias para poder testearlo sin cargar sceneGraph.ts (arrastra toda la app).
let sceneHasClock = false

export function resetSceneClock() {
    sceneHasClock = false
}

export function markSceneClock() {
    sceneHasClock = true
}

export function scenesHaveClock(): boolean {
    return sceneHasClock
}
