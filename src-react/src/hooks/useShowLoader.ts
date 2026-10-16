// ----- FreeShow -----
// Receptor de las respuestas `SHOW` del backend y aplicación al store del editor.

import { useEffect } from "react"
import { MAIN, Main } from "@/IPC/channels"
import { useShowStore } from "@/store/useShowStore"

interface MainMessage {
    channel: string
    data: any
}

export function useShowLoader() {
    useEffect(() => {
        const api = window.api
        if (!api) return

        const onMain = (msg: MainMessage) => {
            if (msg?.channel !== Main.SHOW) return
            const id = msg.data?.id ?? useShowStore.getState().activeShowId ?? ""
            useShowStore.getState().applyShow(msg.data, id)
        }

        api.receive(MAIN, onMain, "show-loader")
        return () => api.removeListener(MAIN, "show-loader")
    }, [])
}
