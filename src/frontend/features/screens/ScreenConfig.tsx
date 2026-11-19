import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { Display } from "../../../types/Main"
import { clone, keysToID, sortByName, sortObject } from "../../shared/utils/helpers/array"
import { addOutput, enableStageOutput } from "../../shared/utils/helpers/output"
import { requestMain } from "../../shared/core/ipc/main"
import { currentOutputSettings, outputs } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { send } from "../../shared/utils/request"
import { useStore } from "../../shared/ui/hooks/useStore"
import { useFreshStore } from "../../shared/ui/hooks/useFreshStore"
import { Modal } from "../../react/main/Modal"
import { ScreenDetail } from "./ScreenDetail"
import { ScreenList } from "./ScreenList"
import { SystemDisplays } from "./SystemDisplays"
import styles from "./ScreenConfig.module.css"

// Port completo de components/screens/ScreenConfig.svelte: el cuerpo de F24.14 más el marco
// (Modal de React), que antes aportaba el cascarón Svelte. Registrado como `screen_config`.
const firstOutputId = () => sortObject(sortByName(keysToID(get(outputs))), "stageOutput")[0]?.id || null

export function ScreenConfig() {
    const current = useStore(currentOutputSettings)
    const outputsValue = useFreshStore(outputs, clone)
    const [displays, setDisplays] = useState<Display[]>([])
    // `$: if ($currentOutputSettings && $outputs[...]) selectedOutputId = $currentOutputSettings`: se resuelve en el render
    // (no en un efecto) para que ScreenDetail reciba el id nuevo en el mismo commit en que cambia el store; si no, su propio
    // `$: if (outputId && $currentOutputSettings !== outputId)` lo devolvería al id viejo
    const valid = current && outputsValue[current] ? current : null
    const [selected, setSelected] = useState<string | null>(() => valid ?? firstOutputId())
    const [previousValid, setPreviousValid] = useState(valid)
    let selectedOutputId = selected
    if (!Object.is(previousValid, valid)) {
        setPreviousValid(valid)
        if (valid) {
            setSelected(valid)
            selectedOutputId = valid
        }
    }

    // `else if (!selectedOutputId)`: sin selección, la primera salida (que además pasa a ser la de ajustes)
    useEffect(() => {
        if (valid || selected) return
        const id = firstOutputId()
        setSelected(id)
        if (id) currentOutputSettings.set(id)
    }, [valid, selected, outputsValue])

    async function loadDisplays() {
        const res = (await requestMain(Main.GET_DISPLAYS)) || []
        setDisplays(res)
    }

    useEffect(() => {
        loadDisplays()
    }, [])

    function select(id: string) {
        setSelected(id)
        currentOutputSettings.set(id)
    }

    function addAudience() {
        const id = addOutput(false)
        if (id) select(id)
    }

    function addStage() {
        const id = enableStageOutput({})
        if (id) select(id)
    }

    function identify() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], displays)
    }

    function newNdi() {
        const id = addOutput(false)
        if (!id) return
        outputs.update((a) => {
            if (a[id]) {
                a[id].ndi = true
                a[id].invisible = true
                a[id].transparent = true
                a[id].name = a[id].name || "NDI"
            }
            return a
        })
        select(id)
    }

    return (
        <Modal title="screen_config.title" width={960} height={620}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <ScreenList selectedOutputId={selectedOutputId} onSelect={select} onAddAudience={addAudience} onAddStage={addStage} />
                    <div className={styles.system}>
                        <div className={styles["system-header"]}>{translateText("screen_config.system")}</div>
                        <SystemDisplays displays={displays} onRefresh={loadDisplays} onIdentify={identify} />
                        <div className={styles["ndi-section"]}>
                            <div className={styles["ndi-title"]}>NDI</div>
                            <button className={styles["ndi-btn"]} onClick={newNdi}>
                                {translateText("screen_config.new_ndi")} ›
                            </button>
                        </div>
                    </div>
                </div>
                <div className={styles.right}>{selectedOutputId && outputsValue[selectedOutputId] ? <ScreenDetail outputId={selectedOutputId} displays={displays} onRefreshDisplays={loadDisplays} /> : <div className={styles.empty}>{translateText("screen_config.no_outputs")}</div>}</div>
            </div>
        </Modal>
    )
}
