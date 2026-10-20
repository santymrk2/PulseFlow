import { get } from "svelte/store"
import { getFirstActiveOutput, getFirstOutput, getOutputResolution } from "../components/helpers/output"
import { OutputHelper } from "../components/helpers/OutputHelper"
import { clearAll, clearSlide } from "../components/output/clear"
import { outputs, serverData } from "../stores"

let justCleared: NodeJS.Timeout | null = null
export const receiveCONTROLLER = {
    ACTION: ({ data }) => {
        const actions = {
            next: () => OutputHelper.advanceOutputs("next"),
            previous: () => OutputHelper.advanceOutputs("previous"),
            clear: () => {
                if (justCleared) {
                    clearTimeout(justCleared)
                    justCleared = null
                    clearAll()
                    return
                }

                clearSlide()
                justCleared = setTimeout(() => (justCleared = null), 2000)
            }
        }

        if (actions[data.id]) actions[data.id]()

        if (data.id !== "clear" && justCleared) {
            clearTimeout(justCleared)
            justCleared = null
        }
    },
    GET_OUTPUT_ID: () => {
        return { channel: "GET_OUTPUT_ID", data: get(serverData)?.output_stream?.outputId || getFirstOutput()?.id }
    }
}

// export async function sendBackgroundToController(outputId: string, updater = get(outputs)) {
//     let currentOutput = updater[outputId]?.out
//     let path = currentOutput?.background?.path || ""

//     if (!path) {
//         send(CONTROLLER, ["BACKGROUND"], { path: "" })
//         return
//     }

//     let base64path = await getBase64Path(path)

//     let bg = clone({ path: base64path, mediaStyle: get(media)[path] || {} })

//     send(CONTROLLER, ["BACKGROUND"], bg)
//     return
// }
