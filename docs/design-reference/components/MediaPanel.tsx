// ----- FreeShow -----
// Panel de la biblioteca de medios. Lee los archivos multimedia de la carpeta de
// medios (vía el store) y los muestra en una rejilla con miniaturas asíncronas.

import { useEffect } from "react"
import { FolderOpen, Loader2 } from "lucide-react"
import MediaItem from "@/components/MediaItem"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useMediaStore } from "@/store/useMediaStore"

export default function MediaPanel() {
    const files = useMediaStore((s) => s.files)
    const loading = useMediaStore((s) => s.loading)
    const loaded = useMediaStore((s) => s.loaded)
    const error = useMediaStore((s) => s.error)
    const loadMedia = useMediaStore((s) => s.loadMedia)

    useEffect(() => {
        void loadMedia()
    }, [loadMedia])

    if (!loaded && loading) {
        return (
            <div className="grid flex-1 grid-cols-2 gap-2 overflow-hidden p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video w-full" />
                ))}
            </div>
        )
    }

    if (files.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center text-zinc-600">
                {loading ? <Loader2 className="size-5 animate-spin" /> : <FolderOpen className="size-5" />}
                <p className="text-xs">
                    {error ? "No se pudo leer la carpeta de medios" : "No hay medios todavía"}
                </p>
            </div>
        )
    }

    return (
        <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-2 p-2">
                {files.map((file) => (
                    <MediaItem key={file.path} file={file} />
                ))}
            </div>
        </ScrollArea>
    )
}
