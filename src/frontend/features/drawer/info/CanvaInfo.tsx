import { addCanvaPresentationAsShow } from "../../../converters/canvaPresentation"
import { activeCanvaPresentation } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { T } from "../../../shared/ui/helpers/T"
import { Button } from "../../../shared/ui/kit/button/Button"
import { InfoMetadata } from "./InfoMetadata"
import styles from "./CanvaInfo.module.css"

// Port de components/drawer/info/CanvaInfo.svelte.
export function CanvaInfo() {
    const presentation = useStore(activeCanvaPresentation)
    if (!presentation) return <div className={styles.scroll} />

    const info = [
        { label: "export.slides", value: presentation.slideCount },
        { label: "ID", value: presentation.designId },
        { label: "inputs.url", value: `https://canva.com/design/${presentation.designId}/view`, type: "url" }
    ]

    return (
        <div className={styles.scroll}>
            {presentation.thumbnail ? <img className={styles.thumbnail} src={presentation.thumbnail} alt={presentation.presentationName} draggable={false} /> : null}
            <div style={{ padding: "5px", paddingTop: 0 }}>
                <InfoMetadata title={presentation.presentationName} info={info} />
                <div className={styles.actions}>
                    <Button
                        variant="outline"
                        icon="slide"
                        title="new.show_convert"
                        onClick={() => {
                            addCanvaPresentationAsShow(presentation)
                        }}
                    >
                        <T id="new.show_convert" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
