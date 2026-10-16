// ----- FreeShow -----
// Tipos compartidos de detección de codificadores (streaming).
//
// Movidos desde `src/electron/streaming/encoderProfiles.ts` y
// `src/electron/streaming/encoderDetection.ts` para que el frontend no dependa
// de la carpeta `src/electron` (retirada).

export type EncoderId = "x264" | "videotoolbox" | "nvenc" | "qsv" | "amf" | "vaapi"

export interface EncoderStatus {
    id: EncoderId
    label: string
    hardware: boolean
    available: boolean
    /** why it is unavailable, shown in the settings dropdown */
    reason?: string
}

export interface EncoderDetection {
    encoders: EncoderStatus[]
    /** best available hardware encoder, or "x264" when there is none */
    recommended: EncoderId
}
