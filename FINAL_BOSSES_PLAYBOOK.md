# Plan de Migración Final: Motores Nativos y Hardware (Tauri/Rust)

## Protocolo de Trabajo Autónomo

1. **Flujo de Ejecución Estricto:** Avanza bloque por bloque. Escribe el código, añade las dependencias a `Cargo.toml` si es necesario, compila con `cargo check` dentro de `tauri-app/src-tauri/`.
2. **Cero Interrupciones:** Si hay errores, resuélvelos leyendo el log. No te detengas a pedir confirmación al usuario. Cuando un bloque compile, márcalo con `[x]` y pasa INMEDIATAMENTE al siguiente.
3. **Manejo de Errores:** Sigue usando `AppResult` y `AppError`. Cero `.unwrap()` o `.expect()`.

---

## BITÁCORA DE EJECUCIÓN

### [x] Bloque 1: Motores Multimedia (FFmpeg y Thumbnails)

- **Objetivo:** Implementar la generación de miniaturas y extracción de metadata de video/audio.
- **Acción:** En `commands/media.rs` y módulos de miniaturas, implementa el uso de `tauri::process::Command::new_sidecar("ffmpeg")` y `ffprobe`.
- **Detalle:** Prepara la lógica para invocar estos binarios como Sidecars de Tauri. Devuelve los paths de las imágenes generadas a la caché. Implementa el empaquetado de medios (`BUNDLE_MEDIA_FILES`).

### [x] Bloque 2: Servidor REST Interno (Reemplazo de Express.js)

- **Objetivo:** Levantar un servidor web ultrarrápido en Rust para que la app móvil y navegadores externos puedan ver el Stage/Output.
- **Acción:** Añade el crate `axum` y `tokio`. En `commands/servers.rs` (o un nuevo módulo `server/`), configura un enrutador de Axum que sirva los archivos estáticos del frontend (las rutas de `public/` o `dist/`) y exponga los endpoints REST necesarios (ej. `/api/status`, `/api/data`).
- **Estado:** Controla el ciclo de vida del servidor (START/STOP) gestionando el hilo de Tokio dentro del `AppState`.

### [x] Bloque 3: WebSockets y Tiempo Real (Reemplazo de Socket.io)

- **Objetivo:** Comunicación bidireccional en tiempo real con los controles remotos.
- **Acción:** Integra WebSockets en el servidor Axum usando crates como `axum::extract::ws` o `socketioxide`.
- **Detalle:** Establece las salas (rooms) para `remote`, `stage`, y `output`. Implementa la retransmisión de mensajes (broadcast) cuando el backend recibe un cambio de diapositiva o un `STARTUP`.

### [x] Bloque 4: Archivos de Respaldo (Compresión ZIP)

- **Objetivo:** Permitir la creación de backups completos de FreeShow.
- **Acción:** Usa el crate `zip` o `async-zip`. Implementa la lógica para empaquetar la carpeta de `Data` (Settings, Shows, Media) en un archivo `.zip` comprimido y la lógica inversa para restaurarlo (`RESTORE`).

### [x] Bloque 5: Hardware de Captura y Red (NDI & Blackmagic)

- **Objetivo:** Streaming profesional y salida gráfica.
- **Acción:** En `commands/ndi.rs` y `commands/blackmagic.rs`. Investiga e implementa los cascarones avanzados usando FFI (`libloading` o crates NDI de Rust) para buscar fuentes NDI en la red local y detectar tarjetas DeckLink. _Nota: Si las librerías C++ no están disponibles, deja la arquitectura de Rust FFI lista y comentada para su inyección posterior._
