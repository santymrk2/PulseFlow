# Verificación de F7 — IPC tipado

Notas de ejecución de la fase F7 (`docs/ROADMAP.md`). Las tareas que requieren
probar en la app con GUI quedan documentadas acá con pasos exactos; **no se marcan
como hechas** hasta que alguien las ejecute en una sesión gráfica (macOS o Windows).

## Canales salteados en F7.4 (dependencia pesada o permisos de sistema)

| Canal | Motivo del salto | Qué haría falta para implementarlo |
| --- | --- | --- |
| `PDF_TO_IMAGE` | Rasterizar PDF a imágenes requiere una dependencia pesada (pdfium/poppler o similar) | Elegir y aprobar una librería de rasterización; el popup de importación ya ofrece el fallback web (ilovepdf) |
| `ACCESS_CAMERA_PERMISSION` | Permiso de sistema (cámara) | Plugin/capability de Tauri + `Info.plist`/manifest y prueba con hardware real |
| `ACCESS_MICROPHONE_PERMISSION` | Permiso de sistema (micrófono) | Ídem (micrófono) |
| `ACCESS_SCREEN_PERMISSION` | Permiso de sistema (grabación de pantalla) | Ídem (grabación de pantalla) |
| `FFMPEG_DOWNLOAD` | Descarga el binario de ffmpeg en runtime | Decidir distribución/firma de binarios (relacionado con F8) |

## Pruebas manuales pendientes (requieren GUI)

### F7.3 — `invokeCommand<T>()` en operaciones críticas

1. Levantar la app (`bun run dev:tauri`).
2. Abrir/cerrar salidas con el botón "Poner en vivo" (debe seguir abriendo y
   cerrando las pantallas y el botón debe cambiar a rojo/gris).
3. Pasar slides con una salida abierta (el Scene Graph debe seguir renderizando;
   la migración de `RENDER_SCENE` no se hizo porque su único emisor es
   `sceneGraph.ts`, fuera de alcance de esta fase por instrucción).
4. Cambiar un ajuste que dispare `SAVE` (p. ej. renombrar un show) y verificar
   que no aparece el toast `toast.save_error` ni el indicador en rojo; para
   simular un fallo de guardado, cerrar permisos de la carpeta de datos y
   reintentar (debe aparecer el toast).

### F7.4 — IMPORT / IMPORT_FILES

1. Popup Import → "texto" (txt/chordpro/csv): elegir archivo → debe importarse
   sin esperar 15 s y el popup debe cerrarse.
2. ImportScripture → Local → elegir una biblia `.fsb`/`.xml` de la carpeta de
   biblias → debe aparecer en la lista de escrituras.
3. Arrastrar un `.show`/proyecto de FreeShow al área de la app → debe importarse.
4. PowerPoint (.pptx): el popup muestra el enlace a ilovepdf; la importación de
   `.pptx` con parseo de zip **no** está implementada (quedó fuera, ver commit).

### F7.4 — URL

1. Click en cualquier link externo (p. ej. menú → Docs, o Settings → Connection
   → Planning Center) → debe abrirse el navegador por defecto.

### F7.4 — SAVE_IMAGE

1. Popup Export → exportar imágenes de un show → deben guardarse en
   `Imágenes/Images/<show>/` y abrirse la carpeta en el primero.
2. Cargar un video en el drawer Media → la miniatura en caché debe generarse
   (Settings → Files → abrir caché de miniaturas y verificar el archivo).

### F7.4 — MIDI (`SEND_MIDI` / `RECEIVE_MIDI` / `CLOSE_MIDI`)

1. Conectar un puerto MIDI real (o un puerto virtual/"IAC Driver" en macOS).
2. Crear un emitter MIDI con ese puerto y emitir → debe llegar el mensaje
   (verificar con otro programa conectado al mismo puerto).
3. Crear una acción MIDI entrante y activarla → al recibir un noteon debe
   ejecutarse la acción; al cerrar la app no deben quedar puertos abiertos.
