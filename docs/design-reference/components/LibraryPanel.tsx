// ----- FreeShow -----
// Panel de la biblioteca de shows. Lee la lista real desde el backend de Rust
// (a través del store de Zustand) y la renderiza con menú contextual.

import { useMemo } from "react"
import { FileText, FolderOpen, Loader2, MonitorPlay, Trash2 } from "lucide-react"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MAIN, Main } from "@/IPC/channels"
import { getDataPath, systemOpen } from "@/IPC/files"
import { deleteShows } from "@/IPC/shows"
import { cn } from "@/lib/utils"
import { projectSlide } from "@/lib/outputActions"
import { getLayoutSlideIds } from "@/lib/show"
import { useAppStore } from "@/store/useAppStore"
import { useShowStore } from "@/store/useShowStore"
import type { ShowList } from "@/types/Show"

function formatDate(show: ShowList): string {
    const ts = show.timestamps?.modified || show.timestamps?.created
    if (!ts) return ""
    return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

function refreshShows() {
    window.api?.send(MAIN, { channel: Main.SHOWS })
}

async function revealShow(show: ShowList) {
    const dataPath = await getDataPath()
    if (!dataPath) return
    const separator = dataPath.includes("\\") ? "\\" : "/"
    await systemOpen(`${dataPath}${separator}Shows${separator}${show.name}.show`)
}

async function removeShow(show: ShowList) {
    await deleteShows([{ id: show.id, name: show.name }])
    refreshShows()
}

export default function LibraryPanel() {
    const shows = useAppStore((s) => s.shows)
    const status = useAppStore((s) => s.status)
    const activeShowId = useShowStore((s) => s.activeShowId)
    const show = useShowStore((s) => s.show)
    const openShow = useShowStore((s) => s.openShow)

    const list = useMemo<ShowList[]>(
        () =>
            Object.entries(shows)
                .map(([id, entry]) => ({ id, ...entry }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [shows]
    )

    if (status === "connecting" && list.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-600">
                <Loader2 className="size-4 animate-spin" />
                <p className="text-xs">Cargando biblioteca…</p>
            </div>
        )
    }

    if (list.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center text-zinc-600">
                <FileText className="size-5" />
                <p className="text-xs">{status === "offline" ? "Backend no disponible" : "No hay shows todavía"}</p>
            </div>
        )
    }

    function projectFirst(showRef: ShowList) {
        const isActive = activeShowId === showRef.id && show
        const firstId = isActive ? getLayoutSlideIds(show)[0] : null
        if (firstId) {
            projectSlide(firstId)
            return
        }
        // Carga el show y proyecta su primera diapositiva cuando llegue.
        openShow(showRef.id, showRef.name)
        const unsubscribe = useShowStore.subscribe((state) => {
            if (state.show?.id !== showRef.id) return
            const id = getLayoutSlideIds(state.show)[0]
            if (id) projectSlide(id)
            unsubscribe()
        })
    }

    return (
        <ScrollArea className="flex-1">
            <nav className="flex flex-col gap-0.5 p-2">
                {list.map((entry) => (
                    <ContextMenu key={entry.id}>
                        <ContextMenuTrigger asChild>
                            <button
                                type="button"
                                onClick={() => openShow(entry.id, entry.name)}
                                className={cn(
                                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none",
                                    activeShowId === entry.id
                                        ? "bg-zinc-800 ring-1 ring-zinc-700"
                                        : "hover:bg-zinc-800 focus-visible:bg-zinc-800"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-7 shrink-0 items-center justify-center rounded text-zinc-500 group-hover:text-zinc-300",
                                        activeShowId === entry.id ? "bg-zinc-700 text-zinc-200" : "bg-zinc-800 group-hover:bg-zinc-700"
                                    )}
                                >
                                    <FileText className="size-3.5" />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[13px] text-zinc-200 group-hover:text-zinc-50">
                                        {entry.name}
                                    </span>
                                    {formatDate(entry) && (
                                        <span className="text-[11px] text-zinc-600">{formatDate(entry)}</span>
                                    )}
                                </span>
                                {entry.locked && <span className="text-[10px] text-zinc-600">🔒</span>}
                            </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                            <ContextMenuItem onClick={() => openShow(entry.id, entry.name)}>
                                <FileText />
                                Abrir
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => projectFirst(entry)}>
                                <MonitorPlay />
                                Proyectar primera diapositiva
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => void revealShow(entry)}>
                                <FolderOpen />
                                Mostrar en carpeta
                            </ContextMenuItem>
                            <ContextMenuItem variant="destructive" onClick={() => void removeShow(entry)}>
                                <Trash2 />
                                Eliminar
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                ))}
            </nav>
        </ScrollArea>
    )
}
