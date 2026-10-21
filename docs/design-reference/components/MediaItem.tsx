// ----- FreeShow -----
// Tarjeta de un archivo multimedia de la biblioteca. Pide la miniatura a Rust
// (`GET_THUMBNAIL`, generada en segundo plano con el crate `image` o FFmpeg) y
// muestra un esqueleto de carga mientras se procesa. Incluye menú contextual.

import { useEffect, useState } from "react"
import { Copy, FolderOpen, ImageOff, Film, MonitorPlay } from "lucide-react"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { systemOpen } from "@/IPC/files"
import { getThumbnail, mediaSrc } from "@/IPC/media"
import { isVideoFile } from "@/lib/media"
import { useProjectionStore } from "@/store/useProjectionStore"
import type { MediaFileEntry } from "@/types/Media"

const THUMBNAIL_SIZE = 250

export default function MediaItem({ file }: { file: MediaFileEntry }) {
    const [src, setSrc] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)
    const projectMedia = useProjectionStore((s) => s.projectMedia)

    useEffect(() => {
        let cancelled = false

        getThumbnail(file.path, THUMBNAIL_SIZE)
            .then((result) => {
                if (cancelled) return
                if (result.output) setSrc(mediaSrc(result.output))
                else setFailed(true)
            })
            .catch((error) => {
                if (cancelled) return
                console.warn(`[media] thumbnail failed for "${file.path}":`, error)
                setFailed(true)
            })

        return () => {
            cancelled = true
        }
    }, [file.path])

    const isVideo = isVideoFile(file.path)

    function sendToOutput() {
        projectMedia({
            id: `${file.path}-${Date.now()}`,
            kind: isVideo ? "video" : "image",
            src: mediaSrc(file.path),
            path: file.path,
            name: file.name,
            loop: true,
            muted: true,
        })
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <figure className="group flex min-w-0 cursor-pointer flex-col gap-1.5" title={file.path}>
                    <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-900 ring-1 ring-zinc-800">
                        {src ? (
                            <img src={src} alt={file.name} loading="lazy" className="size-full object-cover" />
                        ) : failed ? (
                            <div className="flex size-full items-center justify-center text-zinc-700">
                                {isVideo ? <Film className="size-6" /> : <ImageOff className="size-6" />}
                            </div>
                        ) : (
                            <Skeleton className="size-full rounded-none" />
                        )}

                        {isVideo && src && (
                            <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-zinc-200">
                                <Film className="size-2.5" />
                                VIDEO
                            </span>
                        )}

                        {/* Botón de envío a la pantalla de Audiencia. */}
                        <button
                            type="button"
                            onClick={sendToOutput}
                            title="Enviar a Output"
                            className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                        >
                            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100/90 text-zinc-900 shadow-sm">
                                <MonitorPlay className="size-4" />
                            </span>
                        </button>
                    </div>
                    <figcaption className="truncate px-0.5 text-[11px] text-zinc-400 group-hover:text-zinc-200">
                        {file.name}
                    </figcaption>
                </figure>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={sendToOutput}>
                    <MonitorPlay />
                    Enviar a Output
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => void navigator.clipboard?.writeText(file.path)}>
                    <Copy />
                    Copiar ruta
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void systemOpen(file.path)}>
                    <FolderOpen />
                    Mostrar en carpeta
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
