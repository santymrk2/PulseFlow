import qrcode from "qrcode-generator"
import { useEffect, useState } from "react"
import type { Item } from "../../../../types/Show"
import { Icon } from "../../helpers/Icon"
import styles from "./QrCode.module.css"

export interface QrCodeProps {
    item: Item
    edit?: boolean
}

// (F24.18a). La generación (M con respaldo L y los tres
// reemplazos del SVG) se conserva igual: el `{@html}` original pasa a dangerouslySetInnerHTML con la misma fuente.
function generate(data: string, qrColor: string, qrBg: string): string {
    let svg = ""
    try {
        const qr = qrcode(0, "M")
        qr.addData(data)
        qr.make()
        svg = qr.createSvgTag({ scalable: true, margin: 3 })
    } catch {
        try {
            const qr = qrcode(0, "L")
            qr.addData(data)
            qr.make()
            svg = qr.createSvgTag({ scalable: true, margin: 3 })
        } catch (e) {
            console.error("Failed to generate QR code:", e)
            svg = ""
        }
    }

    if (!svg) return ""

    svg = svg.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid meet"')

    if (qrBg) svg = svg.replace(/<rect\s+width="100%"\s+height="100%"\s+fill="[^"]*"/, `<rect width="100%" height="100%" fill="${qrBg}"`)
    else svg = svg.replace(/<rect\s+width="100%"\s+height="100%"\s+fill="[^"]*"\s*cx="[^"]*"\s*cy="[^"]*"\/>/, "")
    if (qrColor) svg = svg.replace(/fill="black"/g, `fill="${qrColor}"`)

    return svg
}

export function QrCode({ item, edit = false }: QrCodeProps) {
    const qrData = item?.qr_code
    const text = qrData?.text || ""
    const color = qrData?.color || "#000000"
    const background = qrData?.background ?? "#FFFFFF"
    const [svg, setSvg] = useState("")

    useEffect(() => {
        setSvg(text ? generate(text, color, background) : "")
    }, [text, color, background])

    if (svg) return <div className={styles.qrItem} dangerouslySetInnerHTML={{ __html: svg }} />

    return (
        <div className={styles.qrItem}>
            {edit ? (
                <div className={styles.emptyQr}>
                    <Icon id="qr_code" white />
                </div>
            ) : null}
        </div>
    )
}
