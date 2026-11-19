import { activePopup, cloudSyncData } from "../../shared/core/stores"
import { Tip } from "../../react/main/Tip"
import { syncWithCloud } from "../../app/wiring/cloudSync"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"

// Port de components/main/popups/CloudMethod.svelte. Escribe: cloudSyncData.cloudMethod (en el lugar) + syncWithCloud(true) + activePopup = null; "cancelar": cloudSyncData = {} + activePopup = null.
// En el Svelte `showMore` era una constante `true` (el botón que la cambiaba está comentado), así que las 4 opciones salen siempre y `multipleTeams` no influía: se omiten.
// Tip usa el port React.
type CloudMethodId = "merge" | "read_only" | "upload" | "replace"

const OPTIONS: { name: string; description: string; icon: string; method: CloudMethodId }[] = [
    { name: "actions.merge", description: "cloud.merge_tip", icon: "merge", method: "merge" },
    { name: "cloud.read_only", description: "cloud.readonly_tip", icon: "cloud_download", method: "read_only" },
    { name: "cloud.upload", description: "cloud.upload_tip", icon: "export", method: "upload" },
    { name: "cloud.replace", description: "cloud.replace_tip", icon: "import", method: "replace" }
]

function setMethod(method: CloudMethodId) {
    cloudSyncData.update((a) => {
        a.cloudMethod = method
        return a
    })
    syncWithCloud(true)
    activePopup.set(null)
}

function cancel() {
    cloudSyncData.set({})
    activePopup.set(null)
}

export function CloudMethod() {
    return (
        <>
            <Tip type="info" value="cloud.choose_method_tip" bottom={20} />

            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {OPTIONS.map((option, i) => (
                    <Button key={option.method} variant="outline" style={{ ...(i === 2 ? { marginTop: "5px" } : {}), justifyContent: "start", flex: 1, minHeight: "50px", fontWeight: "normal" }} onClick={() => setMethod(option.method)}>
                        <Icon id={option.icon} size={2.4} white={i > 0} />

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: "5px", marginLeft: "10px" }}>
                            <p style={{ fontSize: "1.1em" }}>{translateText(option.name)}</p>
                            <span style={{ opacity: 0.5 }}>{translateText(option.description)}</span>
                        </div>
                    </Button>
                ))}
            </div>

            <Button variant="outline" style={{ marginTop: "20px" }} icon="close" onClick={cancel}>
                <T id="popup.cancel" />
            </Button>
        </>
    )
}
