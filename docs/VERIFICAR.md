# VERIFICAR — Validación manual (macOS y Windows)

Este archivo recoge lo que **sólo el usuario puede verificar** (GUI, monitores, firmas reales, etc). Para las tareas automáticas, las verificaciones están en la anotación de cada checkbox del `docs/ROADMAP.md`.

## F0.2 — Snapshot debug-only y safe filename

1. Compilar en modo debug: `bun run dev:tauri` (o build debug).
2. En la consola del webview (DevTools) ejecutar el snippet (ajustar `fileName` si se quiere):
   ```js
   (async () => {
     const res = await window.__TAURI__?.core?.invoke("RENDER_SNAPSHOT", {
       scene: {
         outputId: "test",
         stage: false,
         plainText: "Hola PulseFlow",
         items: [{ type: "text", x: 100, y: 200, width: 1720, height: 700, align: "center", fontSize: 64, fontWeight: 700, color: [1,1,1,1], text: "Hola PulseFlow" }]
       },
       width: 640,
       height: 360,
       fileName: "consola-check"
     });
     console.log(res); // debe devolver la ruta completa al PNG
   })();
   ```
3. Abrir el PNG devuelto (espera 640×360 RGBA válido). El texto debe ser visible.
4. Probar un nombre inválido (ej. `../escape.png` pasado como `fileName`: `"../escape"`) → debe fallar con `AppError` (no escribir fuera de `app_cache_dir/snapshots/`).

## F1.2 — CI y Build en macOS y Windows
Verificado automáticamente (verde): CI run `39165461277`, Build run `39164663595`. Verificaciones reales: artefactos generados por Build (`pulseflow-macos-latest`, `pulseflow-windows-latest`).

## F1.4 — Permisos y firma
- [ ] **macOS:** abrir el `.app` empaquetado con `tauri build` y verificar que las descripciones de permisos existen en `Contents/Info.plist` (NSCameraUsageDescription, NSMicrophoneUsageDescription, NSScreenCaptureUsageDescription). Los entitlements se aplicarán al firmar/distribuir.
- [ ] **Windows:** verificar la sección "Packaging, signing and notarization" en `README.md`.

## F2.2 — Ubicación en el monitor elegido
En un entorno con **2 monitores** (macOS y, si aplica, Windows):

1. Configurar una salida de audiencia con `bounds` que apunten al centro del monitor secundario. Abrirla (`TOGGLE_OUTPUTS` / "poner en vivo").
2. Esperado: cubre ese monitor elegido (sin bordes y pantalla completa si bounds cubren el monitor), o ventana flotante si es el mismo monitor que la ventana de control y no cubre todo.
3. Cambiar `screen` (índice) para forzar otro monitor. Comprobar que se reubica.
4. `UPDATE_BOUNDS`: mover/redimensionar los `bounds` y llamar `UPDATE_BOUNDS` (lo hace Screens.svelte al elegir pantalla). Comprobar reubicación.
5. `alwaysOnTop`: verdadero → debe mantenerse visible sobre otras ventanas.
6. Usar **1 monitor**: al abrir en el mismo monitor que la UI de control, debe aparecer en modo ventana flotante 16:9.

**Notas**: en macOS se usa `set_simple_fullscreen(true)` para cubrir el monitor; en Windows se usa bordes desactivados y tamaño/posición. Esta parte es parte de la verificación funcional de F2.8.

## F2.3 — Estado de salidas hacia el frontend
A completar cuando se implemente F2.3:
1. Abrir una salida → frontend recibe `OUTPUT_STATE` con `active: true`.
2. Cerrar → recibe `active: false`.
3. Cerrar desde la propia ventana (`Destroyed`) → emite estado.
4. Botón de salida pasa a rojo al abrir y cierra todas con un click (comportamiento del frontend existente).

## F2.4 — Escena por pantalla con RENDER_SCENE
Verificado 2026-10-18 (automatizado): `cargo check` limpio, `cargo test --lib` 26/26
(incluido el nuevo test de `nextText` en `scene.rs`), `bun run test:unit` 47/47,
`bun run test:svelte` con 59 errores (línea base, sin aumento) y Prettier limpio.
La verificación GUI con dos monitores queda pendiente para el usuario:

1. Con dos salidas de audiencia habilitadas con estilos distintos, abrir ambas:
   cada monitor muestra su propio estilo (tipografía, color, alineación), no el
   de la primera salida.
2. Añadir una salida stage (con layout de stage asignado). Al cambiar de slide:
   la pantalla de stage muestra el texto actual **y** el siguiente
   ("SIGUIENTE: …") más el reloj; las pantallas de audiencia no muestran nada de
   stage.
3. Cambiar en el layout de stage la "salida fuente" (settings → output): el
   stage pasa a reflejar esa otra salida (y su siguiente slide).
4. Poner un video de fondo en una salida de audiencia: sólo se reproduce en esa
   pantalla; al cambiar de slide con otro fondo, el video anterior se detiene.
5. Cambiar una slide y verificar en la consola del webview que llegan varios
   `RENDER_SCENE` (uno por salida) sin errores "Command … not found".

## F2.8 — Prueba end-to-end "Elegir monitor → poner en vivo → cubrirlo"
Reunir F2.1–F2.7 en un solo test:
1. Elegir monitor secundario en Settings → Outputs (Elegir pantalla).
2. Poner en vivo → la slide aparece en ese monitor, cubriéndolo (sin UI de la app).
3. Pulsa el botón nuevamente para cerrar → la pantalla desaparece.
4. Repetir en Windows.

## F3 — Transiciones GPU (WGSL)
A completar: comprobar transiciones suaves en la misma pantalla, sin parpadeo, a 60 fps.

## F4 — NDI directo desde framebuffer GPU
A completar: verificar que START_NDI_NATIVE_FEED inicia la captura y que el feed está activo.

## F5 — Looks (estilos/temas visuales) — FIN F5: PAUSA
Marcada la pausa indicada al finalizar F5. Incluir los resultados en `docs/VERIFICAR.md`.

## Otras tareas posteriores
Añadir aquí cualquier hallazgo de F6 en adelante, conforme aparezcan.
