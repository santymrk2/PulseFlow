import type { ValidChannels } from "../../types/Channels"
import { OUTPUT } from "../../types/Channels"
import { invokeCommand } from "../IPC/tauri"

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => {
        // F7.3: renderizar una escena es la operación crítica del engine. Se
        // enruta por `invokeCommand` para registrar un fallo del render (p. ej.
        // ventana de salida cerrada) en la consola del frontend, sin tocar el
        // llamador (`sceneGraph.ts` no se modifica).
        if (ID === OUTPUT && channel === "RENDER_SCENE") {
            void invokeCommand(channel, data).then((result) => {
                if (!result.ok) console.error("[output] RENDER_SCENE falló:", result.error)
            })
            return
        }

        window.api.send(ID, { channel, data })
    })
}

export function receive(ID: ValidChannels, channels: any, id = "") {
    window.api.receive(
        ID,
        (msg: any) => {
            // linux dialog behind window message
            // if ((ID === OPEN_FOLDER || ID === OPEN_FILE) && get(activePopup) === "alert") {
            //     activePopup.set(null)
            //     alertMessage.set("")
            // }

            if (channels[msg.channel]) channels[msg.channel](msg.data)
        },
        id
    )
}

export function destroy(ID: ValidChannels, id: string) {
    window.api.removeListener(ID, id)
}
