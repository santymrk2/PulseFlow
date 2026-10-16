// ----- FreeShow -----
// Centro de Configuración: título de la categoría activa + contenido desplazable.

import { useCallback, useEffect, useState } from "react"
import {
    Cloud,
    FolderOpen,
    HardDriveDownload,
    Monitor,
    RefreshCw,
    RotateCcw,
    Trash2,
} from "lucide-react"
import HardwarePanel from "@/components/HardwarePanel"
import OverlaysLibraryPanel from "@/components/OverlaysLibraryPanel"
import PcoPanel from "@/components/PcoPanel"
import StreamPanel from "@/components/StreamPanel"
import TemplatesPanel from "@/components/TemplatesPanel"
import { settingsTabs } from "@/lib/settingsTabs"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { getDataPath, openAppData, openCache, openFolderDialog, openFolderPath, updateDataPath } from "@/IPC/files"
import {
    canSync,
    cloudData,
    deleteBackup,
    getDisplays,
    getOs,
    getRenderEngine,
    setRenderEngine,
    getVersion,
    getTeams,
    listBackups,
    openOutputWindow,
    openNativeOutput,
    openStageWindow,
    openNativeStage,
    restoreBackup,
    getStoreValue,
    setStoreValue,
    type BackupInfo,
    type Display,
    type OsInfo,
    type RenderEngine,
} from "@/IPC/system"
import { useAppStore } from "@/store/useAppStore"

const SHORTCUTS: { keys: string; action: string }[] = [
    { keys: "Espacio / →", action: "Siguiente diapositiva" },
    { keys: "←", action: "Diapositiva anterior" },
    { keys: "Enter", action: "Proyectar diapositiva seleccionada" },
    { keys: "Escape", action: "Limpiar pantalla de audiencia" },
    { keys: "Backspace", action: "Eliminar diapositiva seleccionada" },
    { keys: "F (ventana Output)", action: "Alternar pantalla completa" },
]

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2 text-[13px] hover:bg-zinc-800/40">
            <span className="text-muted-foreground">{label}</span>
            {children ?? <span className="truncate text-foreground">{value}</span>}
        </div>
    )
}

function GeneralTab() {
    const [dataPath, setDataPath] = useState("")
    const [version, setVersion] = useState("")
    const [os, setOs] = useState<OsInfo | null>(null)
    const [autoOutput, setAutoOutput] = useState(false)

    useEffect(() => {
        void getDataPath().then(setDataPath)
        void getVersion().then(setVersion)
        void getOs().then(setOs)
        void getStoreValue("settings", "autoOutput").then((v) => setAutoOutput(Boolean(v)))
    }, [])

    const changeDataPath = async () => {
        const folder = await openFolderDialog({ title: "Elegir carpeta de datos" })
        if (!folder) return
        await updateDataPath(folder, dataPath)
        setDataPath(folder)
    }

    return (
        <div className="flex flex-col gap-1">
            <Row label="Versión" value={version} />
            <Row label="Sistema" value={os ? `${os.name} · ${os.arch}` : ""} />
            <Row label="Carpeta de datos" value={dataPath}>
                <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void openFolderPath(dataPath)}>
                        <FolderOpen />
                        Abrir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void changeDataPath()}>
                        Cambiar
                    </Button>
                </div>
            </Row>
            <Row label="Carpeta de configuración">
                <Button size="sm" variant="ghost" onClick={() => void openAppData()}>
                    Abrir
                </Button>
            </Row>
            <Row label="Caché de miniaturas">
                <Button size="sm" variant="ghost" onClick={() => void openCache()}>
                    Abrir
                </Button>
            </Row>

            <Separator className="my-2" />

            <Row label="Abrir salida automáticamente">
                <Switch
                    checked={autoOutput}
                    onCheckedChange={(value) => {
                        setAutoOutput(value)
                        void setStoreValue("settings", "autoOutput", value)
                    }}
                />
            </Row>
        </div>
    )
}

function ShortcutsTab() {
    return (
        <div className="flex flex-col gap-1">
            {SHORTCUTS.map(({ keys, action }) => (
                <div
                    key={keys}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-2 text-[13px] hover:bg-zinc-800/40"
                >
                    <span className="text-muted-foreground">{action}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">{keys}</kbd>
                </div>
            ))}
        </div>
    )
}

function ScreensTab() {
    const [displays, setDisplays] = useState<Display[]>([])
    const [renderEngine, setEngine] = useState<RenderEngine>("web")

    const refresh = useCallback(() => {
        void getDisplays().then(setDisplays)
        void getRenderEngine().then(setEngine)
    }, [])

    useEffect(() => refresh(), [refresh])

    const handleEngineChange = async (engine: RenderEngine) => {
        setEngine(engine)
        await setRenderEngine(engine)
    }

    const handleOpenOutput = (displayId: number) => {
        if (renderEngine === "native") {
            void openNativeOutput(displayId, false)
        } else {
            void openOutputWindow({ display: displayId })
        }
    }

    const handleOpenStage = (displayId: number) => {
        if (renderEngine === "native") {
            void openNativeStage(displayId, false)
        } else {
            void openStageWindow({ display: displayId })
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Conmutador de Motor de Render (Fase 6) */}
            <div className="flex items-center justify-between rounded-md border bg-zinc-900/60 p-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-zinc-200">Motor de Render</span>
                    <span className="text-[11px] text-zinc-400">
                        {renderEngine === "native"
                            ? "Nativo GPU WGPU (60 fps VSync, shaders, <1ms)"
                            : "Web Legacy (HTML/CSS Webview tradicional)"}
                    </span>
                </div>
                <div className="flex gap-1 rounded bg-zinc-800 p-0.5">
                    <Button
                        size="sm"
                        variant={renderEngine === "web" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs"
                        onClick={() => void handleEngineChange("web")}
                    >
                        Web (Legacy)
                    </Button>
                    <Button
                        size="sm"
                        variant={renderEngine === "native" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-semibold text-amber-300"
                        onClick={() => void handleEngineChange("native")}
                    >
                        Nativo GPU (Pro)
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    <Monitor className="size-3.5" />
                    Pantallas
                </span>
                <Button size="icon-sm" variant="ghost" title="Actualizar" onClick={refresh}>
                    <RefreshCw />
                </Button>
            </div>

            {displays.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">No se detectaron pantallas.</p>
            ) : (
                displays.map((display) => (
                    <div
                        key={display.id}
                        className="flex items-center justify-between rounded-md border bg-zinc-900/40 px-3 py-2"
                    >
                        <span className="text-[13px]">{display.label || `Pantalla ${display.id}`}</span>
                        <div className="flex gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => handleOpenOutput(display.id)}>
                                Output {renderEngine === "native" ? "(GPU)" : ""}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenStage(display.id)}>
                                Stage {renderEngine === "native" ? "(GPU)" : ""}
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

function IntegrationsTab() {
    const [cloudReady, setCloudReady] = useState<boolean | null>(null)
    const [teams, setTeams] = useState<unknown[]>([])
    const [backups, setBackups] = useState<BackupInfo[]>([])

    const refresh = useCallback(() => {
        void canSync().then(setCloudReady)
        void getTeams().then(setTeams)
        void listBackups().then(setBackups)
    }, [])

    useEffect(() => refresh(), [refresh])

    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-zinc-900/40 p-3">
                <span className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    <Cloud className="size-3.5" />
                    Nube
                </span>
                <span className="text-xs text-muted-foreground">
                    {cloudReady == null ? "Comprobando…" : cloudReady ? `Disponible · ${teams.length} equipos` : "No configurado"}
                </span>
                {cloudReady && (
                    <Button size="sm" variant="secondary" className="w-fit" onClick={() => void cloudData({})}>
                        Conectar
                    </Button>
                )}
            </section>

            <section className="flex flex-col gap-2 rounded-lg border bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        <HardDriveDownload className="size-3.5" />
                        Copias de seguridad
                    </span>
                    <Button size="icon-sm" variant="ghost" title="Actualizar" onClick={refresh}>
                        <RefreshCw />
                    </Button>
                </div>
                {backups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay copias de seguridad.</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {backups.map((backup) => (
                            <li
                                key={backup.name}
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-zinc-800/40"
                            >
                                <span className="min-w-0 flex-1 truncate">{backup.name}</span>
                                <Button size="icon-xs" variant="ghost" title="Restaurar" onClick={() => void restoreBackup(backup.path)}>
                                    <RotateCcw />
                                </Button>
                                <Button size="icon-xs" variant="ghost" title="Eliminar" onClick={() => void deleteBackup(backup.path)}>
                                    <Trash2 />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <HardwarePanel />
        </div>
    )
}

export default function SettingsContent() {
    const tab = useAppStore((s) => s.settingsTab)
    const label = settingsTabs.find((t) => t.id === tab)?.label ?? "Configuración"

    return (
        <main className="flex h-full min-h-0 flex-col bg-zinc-950">
            <div className="flex h-12 shrink-0 items-center border-b px-6">
                <h2 className="text-base font-semibold">{label}</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {tab === "general" && <GeneralTab />}
                {tab === "shortcuts" && <ShortcutsTab />}
                {tab === "screens" && <ScreensTab />}
                {tab === "integrations" && <IntegrationsTab />}
                {tab === "pco" && <PcoPanel />}
                {tab === "stream" && <StreamPanel />}
                {tab === "overlays" && <OverlaysLibraryPanel />}
                {tab === "templates" && <TemplatesPanel />}
            </div>
        </main>
    )
}
