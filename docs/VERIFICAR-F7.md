# VERIFICAR-F7.md

## Canales marcados como "eliminar" en F7.1
LANGUAGE (Main.LANGUAGE): eliminado del mapeo Rust (no se expone comando). Verificar que el frontend no invoque (o usar fallback).  
AI_*: 9 canales no implementados y marcados eliminar.  
PCO_PUSHER_AUTH: marcado eliminar.  
OUTPUT: marcado eliminar según tabla.  

## Canales pospuestos (57)
Se responde `undefined` inmediatamente en `tauri.ts` para `POSTPONED_COMMANDS` sin bloquear (F7.2).

## F7.4 - salteados/pendientes de verificación

- SEND_MIDI: **salteado**. `commands/midi.rs` stubea `GET_MIDI_OUTPUTS`/`GET_MIDI_INPUTS` (devuelven listas vacías a propósito). Implementar requiere crate MIDI y acceso al sistema; omitido por bloqueante. Verificar: ¿se usa en runtime? Si no, dejar stub.  
- POWERPOINT/WORD: `IMPORT` alerta "Sin soporte para importar ..." para `pptx/ppt`/`word` (protobuf/office).  
- POWERKEY_BINARY / sqlite / mdb / .pro: sin soporte en IMPORT Rust (alerta).  
- CAPTURE_SLIDE: bloquea Export→Imagen (mencionado en notas). Verificar.
- MAXIMIZED: implementado el comando (si se agrega) y emitido desde eventos; MAXIMIZE alterna estado en Electron. En Tauri `window.maximize()` no alterna; considerar `is_maximized()` + `maximize()`/`unmaximize()` si necesario.  
- PDF_TO_IMAGE: frontend espera respuesta con rutas; en Rust solo emite eventos `PDF_IMPORT_PROGRESS`/`IMAGES_TO_SHOW` vía MAIN (como Electron original)? Revisar payloads (`{id, filePath, pages}` vs `{filePath, pages}` actual en frontend).
- URL: al abrir links externos, usar `tauri_plugin_opener` con `open_url` (no `shell.openExternal` directo).  
