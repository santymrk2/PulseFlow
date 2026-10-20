// Conversión de un PDF a un show de imágenes (F7.5).
//
// El engine nativo (Rust) no tiene dependencias de renderizado de PDF, así que
// un PDF no se puede rasterizar en el backend. La conversión real ocurre en el
// webview con pdf.js: cada página se dibuja a base64 y se manda al comando Rust
// `PDF_TO_IMAGE`, que sólo persiste los bytes en `Imports/PDF/<nombre>/N.jpg` y
// devuelve las rutas escritas. Con esas rutas se arma el show (`createImageShow`).
//
// Antes de F7.5 el comando era un no-op que devolvía `[]`: convertir un PDF no
// hacía nada. Este helper cierra esa cadena y es el único lugar que llama a
// `PDF_TO_IMAGE`, tanto al importar un PDF (`responsesMain`) como al pulsar
// "Convertir en imágenes" en la vista previa del PDF.

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { encodeFilePath, getFileName, locateMediaFile, removeExtension } from "../components/helpers/media"
import { pdfImports } from "../stores"
import { createImageShow } from "./imageShow"

// Mismo worker que usa el resto de la app (viene en `public/assets`).
GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"

// El 80 % del progreso es rasterizado en el webview; el 20 % restante, guardado.
const RENDER_PHASE_PERCENT = 80

/** Actualiza el store `pdfImports` para el PDF indicado (mismo que usa el panel de progreso). */
function setImportStatus(filePath: string, name: string, progress: number, status: "importing" | "complete" | "error", message?: string) {
    pdfImports.update((imports) => {
        const updated = new Map(imports)
        updated.set(filePath, { name, progress, total: 100, status, message })
        return updated
    })
}

/** Rasteriza cada página de un PDF con pdf.js a una data URL JPEG (0–80 % de progreso). */
export async function renderPdfPages(path: string, name: string, targetResolution = 2160): Promise<string[]> {
    const loadingTask = getDocument(encodeFilePath(path))
    const pdfDoc = await loadingTask.promise
    const pageCount = pdfDoc.numPages

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No canvas 2d context available")

    const pages: string[] = []
    try {
        for (let i = 0; i < pageCount; i++) {
            const page = await pdfDoc.getPage(i + 1)
            const atScale1 = page.getViewport({ scale: 1 })

            // `targetResolution` px en el lado mayor para calidad 4K.
            const maxDim = Math.max(atScale1.width, atScale1.height)
            let scale = targetResolution / maxDim
            if (scale < 1.0) scale = 1.0
            if (scale > 4.5) scale = 4.5

            const viewport = page.getViewport({ scale })
            canvas.height = viewport.height
            canvas.width = viewport.width

            await page.render({ canvas, canvasContext: context, viewport }).promise
            pages.push(canvas.toDataURL("image/jpeg"))

            const progress = Math.round(((i + 1) / Math.max(1, pageCount)) * RENDER_PHASE_PERCENT)
            setImportStatus(path, name, progress, "importing")
        }
        return pages
    } finally {
        loadingTask.destroy()
    }
}

/**
 * Convierte un PDF en imágenes y arma el show resultante.
 *
 * @param filePath ruta (o `show.id`) del PDF; se localiza por si la media cambió.
 * @returns las rutas de imagen escritas, o `[]` si no se pudo convertir.
 */
export async function pdfToImageShow(filePath: string): Promise<string[]> {
    if (!filePath) return []

    const name = removeExtension(getFileName(filePath)) || "PDF"
    setImportStatus(filePath, name, 0, "importing")

    try {
        // El PDF puede haber sido movido desde que se importó: localizarlo primero.
        const located = await locateMediaFile(filePath)
        const resolvedPath = located?.path || filePath

        const pages = await renderPdfPages(resolvedPath, name)
        if (!pages.length) {
            setImportStatus(filePath, name, RENDER_PHASE_PERCENT, "error", "PDF has no pages")
            return []
        }

        setImportStatus(filePath, name, RENDER_PHASE_PERCENT, "importing")

        // Sólo persiste los bytes: el renderizado ya está hecho en el webview.
        const saved = (await requestMain(Main.PDF_TO_IMAGE, { filePath: resolvedPath, images: pages })) || []
        if (!saved.length) {
            setImportStatus(filePath, name, RENDER_PHASE_PERCENT, "error", "PDF could not be saved")
            return []
        }

        setImportStatus(filePath, name, 100, "complete")
        createImageShow({ images: saved, name })
        return saved
    } catch (error: any) {
        setImportStatus(filePath, name, RENDER_PHASE_PERCENT, "error", error?.message || "PDF processing failed")
        return []
    }
}
