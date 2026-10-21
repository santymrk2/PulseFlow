// ----- FreeShow -----
// Tipos compartidos de timecode.
//
// Movidos desde `src/electron/timecode/timecode.ts` para que el frontend no
// dependa de la carpeta `src/electron` (retirada).

export type TimecodeMode = "LTC" | "MTC" | "ableton"
