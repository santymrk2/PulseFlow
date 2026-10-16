# Plan de Migración: Electron → Tauri

> Análisis de descubrimiento del backend Electron actual de FreeShow (v1.6.7-beta.1)
> como preparación para la reescritura del backend en Rust + Tauri.
> **Estado:** Fase de descubrimiento. No se genera código Rust todavía.

---

## 0. Resumen ejecutivo

- **Punto de entrada Electron:** `src/electron/index.ts` (proceso principal).
- **Preload / puente:** `src/electron/preload.ts` (`contextBridge.exposeInMainWorld("api")`).
- **Arquitectura IPC:** existe **un único canal lógico `MAIN`** con patrón *request/response* basado en `channel` + `listenerId`. Toda la lógica de negocio se despacha desde `src/electron/IPC/main.ts` → `mainResponses` (`src/electron/IPC/responsesMain.ts`).
- **Canales IPC adicionales (sin payload de retorno, sólo push/eventos):** `OUTPUT`, `EXPORT`, `CLOUD`, `NDI`, `OMT`, `BLACKMAGIC`, `AUDIO` (y los canales de servidor `REMOTE`, `STAGE`, `CONTROLLER`, `OUTPUT_STREAM`).
- **Volumen de comandos a migrar:** ~130 comandos (`Main` enum) + ~7 manejadores de canales especiales + puente de servidores socket.io.
- **Dominios funcionales detectados:** `ai`, `audio`, `blackmagic`, `capture`, `cloud`, `contentProviders`, `data`, `ndi`, `omt`, `output`, `streaming`, `timecode`, `utils`.
- **Riesgo principal:** dependencias con **binarios nativos C/C++ propietarios o muy específicos** (NDI, Blackmagic DeckLink, OMT, osr-capture, sherpa-onnx, LTC, Opus) que no tienen crate puro Rust equivalente y requerirán FFI/`*-sys` + sidecars.

---

## 1. Paso 1 — Dependencias nativas / de sistema del proceso principal

Fuente: `package.json` (dependencies + optionalDependencies + devDependencies usadas en el main) cruzada con los `import` reales en `src/electron/`.

### 1.1 Base de datos y almacenamiento

| Paquete Node | Uso actual (archivo) | Crate Rust equivalente | Notas |
|---|---|---|---|
| `better-sqlite3` | `data/import.ts` (SQLite síncrono) | `rusqlite` (sync) o `sqlx` (async) | `rusqlite` mapea 1:1 el modelo síncrono; `sqlx` si se quiere async + pool. |
| `electron-store` | `data/store.ts`, `data/zip.test.ts`, `cloud/syncManager.test.ts` | `tauri-plugin-store` / `confy` / `serde_json` | El store es JSON por archivo (`config`, `SETTINGS`, `PROJECTS`, etc.). |
| `mdb-reader` | `data/import.ts` (lectura `.mdb` Access) | *sin crate puro* → FFI a `mdbtools` (`mdb-sys`) | Requiere binario/lib externo (`libmdb`). Marcar como dependencia de sistema. |
| `json-bible` | `data/save.ts` | `serde` + parsing propio (es sólo formato de datos) | No es una dependencia nativa real; se reemplaza por `struct`s. |

### 1.2 Red / servidores / protocolos

| Paquete Node | Uso actual (archivo) | Crate Rust equivalente | Notas |
|---|---|---|---|
| `express` | `servers.ts`, `utils/api.ts`, `audio/nowPlaying.ts`, `contentProviders/*` (servidores locales + OAuth callback) | `axum` (recomendado con Tauri/tokio) o `actix-web` | Sirve estáticos (`REMOTE/STAGE/CONTROLLER/OUTPUT_STREAM`) y endpoints REST. |
| `socket.io` (server) | `servers.ts`, `utils/api.ts` | `socketioxide` | Servidor Socket.io nativo en Rust. |
| `socket.io-client` | devDep (frontend) | `rust-socketio` (sólo si el main actúa como cliente) | El cliente principal vive en el frontend. |
| `bonjour-service` | `data/bonjour.ts` (mDNS/zeroconf) | `mdns-sd` | Publicación de puertos para descubrimiento en LAN. |
| `axios` | `cloud/*`, `utils/LyricSearch.ts`, `ai/llm/providers/*` | `reqwest` | Cliente HTTP async estándar. |
| `@googleapis/drive` | `cloud/drive.ts` | `google-drive3` (o `reqwest` + OAuth propio) | API de Google Drive. |
| `opensocket`/`pusher-js` (frontend) | frontend | — | Permanece en el frontend. |
| `osc-js` | `utils/oscPatch.ts`, `utils/api.ts` | `rosc` / `osc` | OSC UDP. |
| `bonjour` (ver arriba) | — | `mdns-sd` | — |

### 1.3 Medios / video / audio (incluye binarios del sistema)

| Paquete Node | Uso actual (archivo) | Crate Rust equivalente | Notas |
|---|---|---|---|
| `ffmpeg` (binario vía `child_process`) | `streaming/ffmpegManager.ts`, `streaming/encoderDetection.ts`, `streaming/RtmpStreamer.ts`, `output/ppt/pptToPdf.ts` | `tokio::process::Command` + **sidecar** ffmpeg (`tauri-plugin-shell`) | FFmpeg se descarga/empaqueta como binario; NO se reescribe. |
| `mp4box` | `utils/files.ts`, `IPC/responsesMain.ts` (codecs/tracks) | `mp4` / `mp4parse` | Parseo de MP4 para tracks/subtítulos. |
| `ebml` | (declarado; uso indirecto) | `ebml-iterable` / `matroska` | Parseo EBML/Matroska. |
| `music-metadata` | `audio/nowPlaying.ts`, `audio/audio.ts` | `lofty` (tags) + `symphonia` (decode/metadata) | `lofty` cubre metadatos; `symphonia` si se decodifica. |
| `@discordjs/opus` | `audio/processAudio.ts` | `audiopus` / `opus` (bindings) | Codec Opus nativo (C). |
| `sherpa-onnx-node` (optional) | `ai/stt/models/nemotronWorker.ts`, `ai/setup/models/nemotron.ts` | `sherpa-rs` / `ort` (ONNX Runtime) | STT local onnx. Binario nativo. |
| `exif` | `utils/files.ts` | `kamadak-exif` (`rexif`) | Lectura de metadatos EXIF de imágenes. |

### 1.4 Video profesional / captura (riesgo alto — FFI)

| Paquete Node | Uso actual (archivo) | Crate Rust equivalente | Notas |
|---|---|---|---|
| `grandiose` (NDI) | `ndi/NdiSender.ts`, `ndi/ndiWorker.ts`, `capture/streamReceiverProcess.ts` | `grafton-ndi` / `ndi` (`ndi-sys`) | Requiere runtime NDI SDK (lib nativa). |
| `macadam` (Blackmagic DeckLink) | `blackmagic/*` (Manager, Sender, Receiver, BufferManager, TypeData, loader) | `decklink` / `decklink-sys` (FFI a DeckLink SDK) | Binario/SDK propietario de Blackmagic. |
| `openmediatransport` (OMT) | `omt/omtModule.ts`, `omt/omtWorker.ts`, `omt/OmtSender.ts` | *sin crate* → FFI a `libomt` | Proyecto meros-co; enlazar C. |
| `osr-capture` (offscreen render capture) | `capture/senderWorker.ts`, `capture/helpers/CaptureTransmitter.ts`, `blackmagic/BlackmagicSender.ts`, `ndi/ndiWorker.ts`, `output/helpers/OutputLifecycle.ts` | `scrap` / `xcap` / `wgpu` (captura nativa por OS) | Captura de la ventana offscreen; en Tauri se captura la WebView/GPU. |
| `libltc-wrapper` (LTC timecode) | `timecode/LTC.ts` | `ltc` / FFI a `libltc` (`libltc-sys`) | Codificador/decodificador LTC. |
| `jzz` (MIDI) | `utils/midi.ts`, `timecode/MTC.ts` | `midir` | MIDI in/out multiplataforma. |

### 1.5 Utilidades del sistema / Node core

| Paquete / módulo Node | Uso actual (archivo) | Crate Rust equivalente | Notas |
|---|---|---|---|
| `fs` / `fs.promises` | múltiples (`utils/files.ts`, `data/*`, `output/*`) | `std::fs` + `tokio::fs` | Regla del proyecto: std/tokio, no crates de terceros. |
| `path` | múltiples | `std::path` | — |
| `upath` | `data/import.ts`, `utils/files.ts` | `std::path` (normalización) | No se necesita crate; se elimina. |
| `child_process` | `streaming/*`, `output/ppt/pptToPdf.ts`, `utils/spotify.ts`, `data/bonjour.ts` | `std::process::Command` / `tokio::process` | — |
| `worker_threads` | `ndi/NdiSender.ts`, `omt/omtModule.ts`, `omt/OmtSender.ts`, `capture/senderWorker.ts` | `tokio::task` / `std::thread` / `rayon` | Los workers pasan a tareas async o hilos. |
| `node-machine-id` | `utils/helpers.ts` | `machine-uid` | Device ID estable. |
| `uid` | `IPC/main.ts`, `cloud/drive.ts`, `utils/files.ts`, etc. | `uuid` | Generación de IDs. |
| `xml2js` / `fast-xml-parser` | `output/ppt/pptToShow.ts` | `quick-xml` / `roxmltree` | Parseo XML/PPTX. |
| `protobufjs` | `data/import.ts` | `prost` (+ `prost-build`) | Mensajes protobuf. |
| `word-extractor` | `data/import.ts` | `docx-rs` / `docx-rust` | Extracción de texto `.docx`. |
| `yauzl` / `yazl` | `data/zip.ts`, `cloud/syncManager.ts` | `zip` | Lectura/escritura de archivos ZIP. |
| `slideshow` (macOS iWork) | `output/ppt/presentation.ts` | *sin crate* → `std::process` (osascript/JXA) | Control de Keynote/AppleScript en macOS. |
| `libspotifyctl` (optional) | `utils/spotify.ts` | `rspotify` (API Web) o FFI | Control de Spotify; `rspotify` es alternativa pura. |
| `@sentry/electron` | `IPC/responsesMain.ts` | `sentry` | Reporte de errores. |
| `electron-updater` | `utils/updater.ts` | `tauri-plugin-updater` | Auto-actualización integrada en Tauri. |
| `electron-store` (config) | `data/store.ts` | `tauri-plugin-store` | Ver 1.1. |
| `uid` (ver arriba) | — | `uuid` | — |

### 1.6 APIs de Electron a sustituir por APIs de Tauri

| API Electron | Uso (archivo) | Equivalente Tauri |
|---|---|---|
| `app.getVersion`, `app.getPath`, `app.name` | `IPC/responsesMain.ts`, `data/store.ts` | `app` / `path` plugins de Tauri. |
| `BrowserWindow`, `webContents.send` | `index.ts`, `servers.ts`, `output/*` | `WebviewWindow` + `emit`/`emitter`. |
| `desktopCapturer`, `screen` | `IPC/responsesMain.ts` (`getScreens`, `getDisplays`) | `xcap`/`scrap` + plugins de monitor. |
| `shell.openExternal`, `shell.openPath` | `utils/files.ts` (`openInSystem`), `IPC/responsesMain.ts` | `tauri-plugin-opener` / `tauri-plugin-shell`. |
| `nativeTheme`, `Menu` (menú global) | `utils/menuTemplate.ts`, `utils/init.ts` | `tauri-plugin-menu` / menú nativo de Tauri. |
| `powerSaveBlocker` | `index.ts` | `tauri-plugin-...` / `keepawake`. |
| `protocol.registerSchemesAsPrivileged("freeshow-protected")` | `index.ts`, `data/protected.ts` | `tauri::register_uri_scheme_protocol` (custom protocol handler). |
| `systemPreferences` (permisos cámara/mic) | `IPC/responsesMain.ts` | `tauri-plugin-macos-permissions` / FFI AVFoundation. |
| `dialog` (selectFiles/selectFolder) | `utils/files.ts` | `tauri-plugin-dialog`. |
| `ipcMain`, `ipcRenderer`, `contextBridge` | `IPC/main.ts`, `preload.ts` | `#[tauri::command]`, `invoke`, `emit`/`listen`, `@tauri-apps/api/core`. |
| `utilityProcess` (si aplica) / worker | `servers.ts`, workers | Tauri sidecars / tokio tasks. |

---

## 2. Paso 2 — Inventario de canales IPC a convertir en `#[tauri::command]`

### 2.1 Notas de arquitectura IPC actual

- Existe **un solo canal `MAIN`** (`src/types/Channels.ts`). El frontend llama `window.api.send("MAIN", { channel, data }, listenerId)` y el main responde con el mismo `channel` + `listenerId`.
- El **dispatcher** es `receiveMain()` en `src/electron/IPC/main.ts`; el **mapa de handlers** es `mainResponses` en `src/electron/IPC/responsesMain.ts`.
- Las respuestas main→frontend usan `sendMain()` / `sendToMain()` (eventos push tipo `ToMain`), que en Tauri se convierten en **`app.emit(...)` / `emit_to(...)`** (event listeners), NO en comandos.
- **Regla del proyecto:** cada `Main.X` (que hoy hace request/response) ⇒ **un `#[tauri::command]`** que devuelve `Result<T, String>`.

### 2.2 Comandos `Main` (request → response) agrupados por dominio

#### DEV / APP
| # | Canal (`Main.*`) | Handler en `responsesMain.ts` | Notas |
|---|---|---|---|
| 1 | `LOG` | `console.info` | Sólo log. |
| 2 | `IS_DEV` | `!isProd` | — |
| 3 | `GET_CACHE_PATH` | `getThumbnailFolderPath` | — |
| 4 | `VERSION` | `app.getVersion` | — |
| 5 | `GET_OS` | `os.platform/hostname/arch` | — |
| 6 | `DEVICE_ID` | `getMachineId` | — |
| 7 | `GET_DEVICE_NAME` | `os.hostname` | — |
| 8 | `IP` | `getLocalIPs` | — |
| 9 | `CHECK_RAM_USAGE` | `os.totalmem/freemem` | — |

#### STORES (persistencia)
| # | Canal | Handler | Notas |
|---|---|---|---|
| 10 | `SETTINGS` | `getStore("SETTINGS")` | — |
| 11 | `SYNCED_SETTINGS` | `getStore` | — |
| 12 | `STAGE` | `getStore` | — |
| 13 | `PROJECTS` | `getStore` | — |
| 14 | `OVERLAYS` | `getStore` | — |
| 15 | `TEMPLATES` | `getStore` | — |
| 16 | `EVENTS` | `getStore` | — |
| 17 | `MEDIA` | `getStore` | — |
| 18 | `THEMES` | `getStore` | — |
| 19 | `DRIVE_API_KEY` | `getStore` | — |
| 20 | `HISTORY` | `getStore` | — |
| 21 | `USAGE` | `getStore` | — |
| 22 | `CACHE` | `getStore` | — |
| 23 | `GET_STORE_VALUE` | `getStoreValue` | acceso genérico. |
| 24 | `SET_STORE_VALUE` | `setStoreValue` | acceso genérico. |

#### WINDOW
| # | Canal | Handler |
|---|---|---|
| 25 | `CLOSE` | `closeMain` |
| 26 | `MAXIMIZE` | `maximizeMain` |
| 27 | `MAXIMIZED` | `isMaximized` |
| 28 | `MINIMIZE` | `minimize` |
| 29 | `FULLSCREEN` | `setFullScreen` |
| 30 | `SPELLCHECK` | `correctSpelling` |

#### SAVE / IMPORT / SHOWS
| # | Canal | Handler |
|---|---|---|
| 31 | `SAVE` | `save(a)` |
| 32 | `BACKUPS` | `getBackups` |
| 33 | `DELETE_BACKUP` | `deleteBackup` |
| 34 | `IMPORT` | `startImport` |
| 35 | `IMPORT_FILES` | `importFiles` |
| 36 | `BIBLE` | `loadScripture` |
| 37 | `SHOW` | `loadShow` |
| 38 | `SHOWS` | `loadShowsAsync` |
| 39 | `DELETE_SHOWS` | `deleteShows` |
| 40 | `DELETE_SHOWS_NI` | `deleteShowsNotIndexed` |
| 41 | `REFRESH_SHOWS` | `refreshAllShows` |
| 42 | `GET_EMPTY_SHOWS` | `getEmptyShows` |
| 43 | `FULL_SHOWS_LIST` | `getAllShows` |
| 44 | `READ_BIBLES_FOLDER` | `readBiblesFolder` |

#### APP / RUTAS / SISTEMA
| # | Canal | Handler |
|---|---|---|
| 45 | `AUTO_UPDATE` | `checkForUpdates` |
| 46 | `URL` | `openURL` |
| 47 | `LANGUAGE` | `setGlobalMenu` |
| 48 | `GET_PATHS` | `getPaths` |
| 49 | `DATA_PATH` | `getDataFolderRoot` |
| 50 | `UPDATE_DATA_PATH` | `config.set` + `createStores` |
| 51 | `LOG_ERROR` | `logError` |
| 52 | `OPEN_LOG` | `openInSystem` |
| 53 | `OPEN_CACHE` | `openInSystem` |
| 54 | `OPEN_APPDATA` | `openInSystem` |
| 55 | `OPEN_FOLDER_PATH` | `openInSystem` |
| 56 | `OPEN_NOW_PLAYING` | `openNowPlaying` |
| 57 | `SYSTEM_OPEN` | `openInSystem` |
| 58 | `RECORDER` | `saveRecording` |

#### OUTPUT / PANTALLAS
| # | Canal | Handler |
|---|---|---|
| 59 | `GET_SCREENS` | `getScreens("screen")` |
| 60 | `GET_WINDOWS` | `getScreens("window")` |
| 61 | `GET_DISPLAYS` | `screen.getAllDisplays` |
| 62 | `GET_GRAPHICS_DEVICES` | `listGraphicsDevices` |
| 63 | `OUTPUT` | identifica sender |

#### MEDIA / THUMBNAILS
| # | Canal | Handler |
|---|---|---|
| 64 | `DOES_MEDIA_EXIST` | `doesMediaExist` |
| 65 | `GET_THUMBNAIL` | `getThumbnail` |
| 66 | `SAVE_IMAGE` | `saveImage` |
| 67 | `PDF_TO_IMAGE` | `pdfToImage` |
| 68 | `READ_EXIF` | `readExifData` |
| 69 | `MEDIA_CODEC` | `getMediaCodec` |
| 70 | `MEDIA_TRACKS` | `getMediaTracks` |
| 71 | `DOWNLOAD_LESSONS_MEDIA` | `downloadLessonsMedia` |
| 72 | `MEDIA_DOWNLOAD` | `downloadMedia` |
| 73 | `MEDIA_IS_DOWNLOADED` | `checkIfMediaDownloaded` |
| 74 | `NOW_PLAYING` | `setPlayingState` |
| 75 | `NOW_PLAYING_UNSET` | `unsetPlayingAudio` |
| 76 | `READ_AUDIO_METADATA` | `getAudioMetadata` |
| 77 | `CAPTURE_SLIDE` | `captureSlide` |
| 78 | `ACCESS_CAMERA_PERMISSION` | `getPermission("camera")` |
| 79 | `ACCESS_MICROPHONE_PERMISSION` | `getPermission("microphone")` |
| 80 | `ACCESS_SCREEN_PERMISSION` | `getPermission("screen")` |

#### PPT / PRESENTACIÓN
| # | Canal | Handler |
|---|---|---|
| 81 | `PPT_TO_PDF` | `pptToPdf` |
| 82 | `SLIDESHOW_GET_APPS` | `getPresentationApplications` |
| 83 | `START_SLIDESHOW` | `startSlideshow` |
| 84 | `PRESENTATION_CONTROL` | `presentationControl` |

#### SERVERS / API / WEBSOCKET / OSC
| # | Canal | Handler |
|---|---|---|
| 85 | `START` | `startServers` |
| 86 | `STOP` | `closeServers` |
| 87 | `SERVER_DATA` | `updateServerData` |
| 88 | `WEBSOCKET_START` | `startWebSocketAndRest` |
| 89 | `WEBSOCKET_STOP` | `stopApiListener` |
| 90 | `API_TRIGGER` | `apiReturnData` |
| 91 | `EMIT_OSC` | `emitOSC` |

#### MIDI
| # | Canal | Handler |
|---|---|---|
| 92 | `GET_MIDI_OUTPUTS` | `getMidiOutputs` |
| 93 | `GET_MIDI_INPUTS` | `getMidiInputs` |
| 94 | `SEND_MIDI` | `sendMidi` |
| 95 | `RECEIVE_MIDI` | `receiveMidi` |
| 96 | `CLOSE_MIDI` | `closeMidiInPorts` |

#### LYRICS
| # | Canal | Handler |
|---|---|---|
| 97 | `GET_LYRICS` | `getLyrics` |
| 98 | `SEARCH_LYRICS` | `searchLyrics` |

#### FILES
| # | Canal | Handler |
|---|---|---|
| 99 | `RESTORE` | `restoreFiles` |
| 100 | `LOCATE_MEDIA_FILE` | `locateMediaFile` |
| 101 | `GET_MEDIA_FOLDER_PATH` | `getMediaSyncFolderPath` |
| 102 | `SET_MEDIA_FOLDER_PATH` | `setMediaSyncFolderPath` |
| 103 | `GET_SIMILAR` | `getSimularPaths` |
| 104 | `BUNDLE_MEDIA_FILES` | `bundleMediaFiles` |
| 105 | `MEDIA_FOLDER_COPY` | `addToMediaFolder` |
| 106 | `FILE_INFO` | `getFileInfo` |
| 107 | `READ_FOLDER` | `readFolderContent` |
| 108 | `READ_FILE` | `readFile` |
| 109 | `OPEN_FOLDER` | `selectFolder` |
| 110 | `OPEN_FILE` | `selectFiles` |

#### SYNC / CLOUD
| # | Canal | Handler |
|---|---|---|
| 111 | `CAN_SYNC` | `canSync` |
| 112 | `GET_TEAMS` | `getSyncTeams` |
| 113 | `CLOUD_DATA` | `hasTeamData` |
| 114 | `CLOUD_SYNC` | `syncData` |
| 115 | `RESTORE_CLOUD_BACKUP` | `restoreCloudBackup` |
| 116 | `GET_CONVERSATION_ID` | `ChurchAppsChat.getOrCreateConversation` |
| 117 | `SEND_SOCKET_MESSAGE` | `sendSocketMessage` |

#### CONTENT PROVIDERS (Planning Center / OnStage / ChurchApps / Canva / AmazingLife)
| # | Canal | Handler |
|---|---|---|
| 118 | `PROVIDER_LOAD_SERVICES` | `ContentProviderRegistry.loadServices` |
| 119 | `PROVIDER_CONNECTIONS` | `getConnectedProviders` |
| 120 | `PROVIDER_DISCONNECT` | `disconnect` |
| 121 | `PROVIDER_STARTUP_LOAD` | `startupLoad` |
| 122 | `PROVIDER_FETCH_FOLDERS` | `fetchFolderTree` |
| 123 | `PCO_FETCH_SERVICE_TREE` | `fetchServiceTree` |
| 124 | `PCO_LOAD_PLAN` | `loadSinglePlan` |
| 125 | `PCO_LIVE_GET` | `getPcoLiveData` |
| 126 | `PCO_PUSHER_AUTH` | `getPcoPusherAuth` |
| 127 | `ONSTAGE_GET_TEAMS` | `getOnStageTeams` |
| 128 | `ONSTAGE_SWITCH_TEAM` | `switchOnStageTeam` |
| 129 | `ONSTAGE_LOAD_SERVICE` | `loadOnStageService` |
| 130 | `GET_CONTENT_PROVIDERS` | `getAvailableProviders` |
| 131 | `GET_CONTENT_LIBRARY` | `getContentLibrary` |
| 132 | `GET_PROVIDER_CONTENT` | `getContent` |
| 133 | `CHECK_MEDIA_LICENSE` | `checkMediaLicense` |

#### TIMECODE
| # | Canal | Handler |
|---|---|---|
| 134 | `TIMECODE_START` | `timecodeStart` |
| 135 | `TIMECODE_STOP` | `timecodeStop` |
| 136 | `TIMECODE_VALUE` | `updateTimecodeValue` |
| 137 | `TIMECODE_AUDIO_DATA` | `processAudioData` |
| 138 | `TIMECODE_STATUS` | log |

#### SPOTIFY
| # | Canal | Handler |
|---|---|---|
| 139 | `SPOTIFY_GET_STATE` | `getSpotifyState` |
| 140 | `SPOTIFY_COMMAND` | `executeSpotifyCommand` |

#### FFMPEG / STREAMING
| # | Canal | Handler |
|---|---|---|
| 141 | `FFMPEG_CHECK` | `resolveFfmpegPath` |
| 142 | `FFMPEG_DOWNLOAD` | `downloadFfmpeg` |
| 143 | `ENCODER_DETECT` | `detectEncoders` |
| 144 | `SET_RTMP_ENCODER` | `setRtmpEncoderSetting` |

#### AI
| # | Canal | Handler |
|---|---|---|
| 145 | `AI_GET_MODELS` | `fetchProviderModels` |
| 146 | `AI_GET_BIN` | `LocalModelManager.getDownloadedBinFiles` |
| 147 | `AI_LISTEN_START` | `SpeechToText.listen` |
| 148 | `AI_LISTEN_STOP` | `SpeechToText.stop` |
| 149 | `AI_AUDIO_DATA` | `SpeechToText.pushAudio` |
| 150 | `AI_GET_STATUS` | `aiGetModelStatus` |
| 151 | `AI_SETUP` | `aiHandleLocalSetup` |
| 152 | `AI_SET_KEY` | `setAiKey` |
| 153 | `AI_LLM_COMPLETE` | `completeLLM` |

> **Total:** ~153 entradas del enum `Main` en `src/types/IPC/Main.ts` (las numeradas 1–153). Cada una que hoy pasa por `mainResponses` se convierte en un `#[tauri::command]` (o en un evento, si es sólo notificación).

### 2.3 Canales IPC NO-MAIN (push/eventos o bridges de servidor)

Estos NO son request/response puros y en Tauri se modelan como **eventos** (`app.emit` / `emit_to`) o comandos sin retorno:

| Canal | Registro (`ipcMain.on/once`) | Handler | Modelo en Tauri |
|---|---|---|---|
| `STARTUP` (evento `LOADED`) | `index.ts:411` | `mainWindowLoaded` | `emit`/`listen` (señal de arranque). |
| `MAIN` | `index.ts:412` | `receiveMain` | Dispatcher → `#[tauri::command]` por `Main.X`. |
| `OUTPUT` | `index.ts:413` | `OutputHelper.receiveOutput` | Evento bidireccional (varias ventanas de salida). |
| `EXPORT` | `index.ts:414` | `startExport` | Comando/evento. |
| `CLOUD` | `index.ts:415` | `cloudConnect` | Comando/evento. |
| `NDI` | `index.ts:416` | `receiveNDI` | Evento bidireccional. |
| `OMT` | `index.ts:417` | `receiveOMT` | Evento bidireccional. |
| `BLACKMAGIC` | `index.ts:418` | `receiveBM` | Evento bidireccional. |
| `AUDIO` | `index.ts:419` | `receiveAudio` | Evento bidireccional (audio). |
| `WEBRTC_LOG`, `DO_WHIP_POST`, `DO_WHIP_DELETE` | `streaming/WebRtcHost.ts:4,19,60` | WebRTC | Comandos/eventos. |
| `REMOTE`, `STAGE`, `CONTROLLER`, `OUTPUT_STREAM` | `servers.ts:104` | puente a socket.io | Comandos de servidor (`socketioxide`). |

### 2.4 Eventos main → frontend (ex `sendMain`/`sendToMain` → `ToMain`)

El enum `ToMain` (`src/types/IPC/ToMain.ts`) define los **push events** que en Tauri deben ser `app.emit()`:

`ALERT`, `TOAST`, `MENU`, `API`, `SPELL_CHECK`, `BACKUP`, `RECENTLY_ADDED_FILES`, `PRESENTATION_STATE`, `CAPTURE_CANVAS`, `REPLACE_MEDIA_PATHS`, `LESSONS_DONE`, `IMAGES_TO_SHOW`, `MEDIA_DOWNLOAD_PROGRESS`, `PDF_IMPORT_PROGRESS`, `RTMP_STATUS`, `GPU_HEALTH`, `AI_STATUS`, `AI_TRANSCRIPT`, `PROVIDER_CONNECT`, `PROVIDER_PROJECTS`, `WEBSOCKET`, `AUDIO_METADATA`, `GET_DYNAMIC_VALUES`, `IMPORT2`, `SHOW2`, `SAVE2`, `REFRESH_SHOWS2`, `RESTORE2`, `API_TRIGGER2`, `OPEN_FOLDER2`, `OPEN_FILE2`, `RECEIVE_MIDI2`.

---

## 3. Paso 3 — Propuesta de estructura de carpetas para `src-tauri/src/`

Estructura espejo de los dominios actuales de `src/electron/`, con separación **comandos (IPC) / lógica de dominio / estado / tipos**.

```
src-tauri/
├── Cargo.toml
├── build.rs                      # tauri-build + prost-build (protobuf)
├── tauri.conf.json
├── icons/
├── binaries/                     # sidecars: ffmpeg, etc. (tauri-plugin-shell)
└── src/
    ├── main.rs                   # entrypoint: llama a freeshow_lib::run()
    ├── lib.rs                    # Builder de Tauri: plugins, state, invoke_handler, setup
    │
    ├── state.rs                  # AppState (Mutex/RwLock sobre stores, servidores, workers)
    ├── error.rs                  # AppError -> impl serde::Serialize (NUNCA unwrap/expect)
    ├── events.rs                 # Constantes + helpers para emit/emit_to (equivalente a ToMain)
    │
    ├── commands/                 # 1 archivo por dominio; cada fn -> #[tauri::command]
    │   ├── mod.rs                # pub use + generate_handler! macro
    │   ├── app.rs                # LOG, IS_DEV, VERSION, GET_OS, DEVICE_ID, IP, RAM, ...
    │   ├── window.rs             # CLOSE, MAXIMIZE, MINIMIZE, FULLSCREEN, SPELLCHECK
    │   ├── stores.rs             # SETTINGS, PROJECTS, GET/SET_STORE_VALUE, DATA_PATH, ...
    │   ├── shows.rs              # SAVE, SHOW(S), BIBLE, IMPORT(_FILES), BACKUPS, DELETE_*
    │   ├── files.rs              # FILE_INFO, READ_FOLDER, READ_FILE, OPEN_FILE/FOLDER, BUNDLE...
    │   ├── media.rs              # DOES_MEDIA_EXIST, GET_THUMBNAIL, MEDIA_CODEC/TRACKS, EXIF, ...
    │   ├── output.rs             # GET_SCREENS/WINDOWS/DISPLAYS, GRAPHICS_DEVICES, PPT*
    │   ├── servers.rs            # START, STOP, SERVER_DATA, WEBSOCKET_*, API_TRIGGER, EMIT_OSC
    │   ├── sync.rs               # CAN_SYNC, GET_TEAMS, CLOUD_*, RESTORE_CLOUD_BACKUP, chat
    │   ├── providers.rs          # PROVIDER_*, PCO_*, ONSTAGE_*, CONTENT_LIBRARY, MEDIA_LICENSE
    │   ├── timecode.rs           # TIMECODE_*
    │   ├── midi.rs               # GET/SEND/RECEIVE_MIDI, CLOSE_MIDI
    │   ├── lyrics.rs             # GET_LYRICS, SEARCH_LYRICS
    │   ├── streaming.rs          # FFMPEG_*, ENCODER_DETECT, SET_RTMP_ENCODER
    │   ├── spotify.rs            # SPOTIFY_*
    │   └── ai.rs                 # AI_* (LLM, STT, setup)
    │
    ├── types/                    # structs #[derive(Serialize, Deserialize)] espejo de TS
    │   ├── mod.rs
    │   ├── main.rs               # enums Main/ToMain, payloads
    │   ├── show.rs, settings.rs, projects.rs, output.rs, stage.rs, socket.rs, ...
    │   └── ai.rs
    │
    ├── domain/                   # lógica de negocio pura (sin Tauri), testeable
    │   ├── mod.rs
    │   ├── data/                 # store.rs, import.rs, save.rs, zip.rs, backup.rs, thumbnails.rs
    │   ├── output/               # helpers de ventanas de salida, ppt/
    │   ├── capture/              # CaptureHelper, transmisores, workers
    │   ├── streaming/            # RtmpStreamer, ffmpeg_manager, encoder_detection, webrtc
    │   ├── timecode/             # LTC, MTC, timecode core
    │   ├── audio/                # nowPlaying, processAudio, icecast
    │   ├── ndi/                  # sender/receiver (FFI grafton-ndi)
    │   ├── omt/                  # sender/receiver (FFI libomt)
    │   ├── blackmagic/           # DeckLink (FFI decklink-sys)
    │   ├── cloud/                # sync_manager, drive, churchApps
    │   ├── providers/            # base + amazingLife, canva, churchApps, onStage, planningCenter
    │   └── ai/                   # llm/providers, stt, setup
    │
    ├── platform/                 # wrappers por SO (aislar cfg(target_os))
    │   ├── mod.rs
    │   ├── permissions.rs        # cámara/mic/pantalla (macOS AVFoundation)
    │   ├── presentation.rs       # slideshow macOS (osascript/JXA)
    │   ├── process.rs            # spawn sidecars (ffmpeg, spotifyctl, libltc)
    │   └── screen.rs             # captura/desktopCapturer (xcap/scrap)
    │
    ├── server/                   # axum + socketioxide (REMOTE/STAGE/CONTROLLER/OUTPUT_STREAM)
    │   ├── mod.rs
    │   ├── http.rs
    │   └── socketio.rs
    │
    └── utils/                    # fs, paths, ids (uuid), xml, protobuf, machine-id
        ├── mod.rs
        ├── fs.rs
        ├── paths.rs
        └── ids.rs
```

### Principios de la estructura

1. **`commands/` = puerta de entrada IPC.** Contiene sólo `#[tauri::command]` que validan y delegan. Firmas `Result<T, String>` / `Result<T, AppError>`.
2. **`domain/` = lógica reutilizable, sin dependencia de Tauri.** Facilita tests unitarios (hoy existen `.test.ts` en `cloud/`, `data/`, `streaming/`, `timecode/` que deben portarse).
3. **`platform/` = aislamiento por SO** (`#[cfg(target_os = "...")]`), donde viven FFI y procesos nativos.
4. **`types/` = contrato de datos.** Cada interfaz TS que cruza IPC debe tener struct con `#[derive(Serialize, Deserialize)]` (regla 4 del proyecto).
5. **`events.rs`** centraliza los nombres de eventos `ToMain` para no hardcodear strings.

---

## 4. Riesgos y consideraciones para la Fase 2 (implementación)

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| SDKs propietarios: **NDI, Blackmagic DeckLink, OMT** | Alto | FFI a `*-sys` + binarios del SDK; aislar en `platform/`. Evaluar disponibilidad de SDK redistribuible. |
| **osr-capture** (captura offscreen de Electron) | Alto | Tauri no tiene equivalente directo; usar `xcap`/`scrap`/`wgpu` o capturar el frame del `WebviewWindow`. |
| **FFmpeg** | Medio | Mantener como **sidecar** (`tauri-plugin-shell`), no reescribir. |
| **sherpa-onnx / ONNX** | Medio | `sherpa-rs` u `ort`; binarios por plataforma. |
| **express + socket.io** | Medio | Migrar a `axum` + `socketioxide`; los clientes frontend siguen hablando Socket.io. |
| Seguridad de memoria (`unwrap`/`expect` prohibidos) | Transversal | Tipo `AppError` con `Serialize`; `?` en todo el código de producción. |
| Tipos cruzando IPC (regla 4) | Transversal | `serde` en todos los structs de `types/`. |
| Protocolo custom `freeshow-protected` | Bajo | `register_uri_scheme_protocol` de Tauri. |
| Manager de paquetes | Transversal | **Sólo `bun`** (regla 6); nada de npm/yarn/pnpm. |

---

## 5. Próximos pasos sugeridos (fuera del alcance de esta fase)

1. Validar la tabla de crates 1.1–1.5 (especialmente los FFI de §1.4).
2. Definir el `AppState` y el mapa `Main.X → #[tauri::command]` en `commands/mod.rs`.
3. Portar `types/` (TS → structs Rust) por dominio.
4. Priorizar por bajo riesgo: `app`, `window`, `stores`, `files`, `shows` antes que `ndi`/`blackmagic`/`omt`/`capture`.

---

*Generado como análisis de descubrimiento. No contiene código Rust de implementación (por instrucción de la tarea).*
