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
Comprobado en código y `cargo test` (2026-10-18): `TOGGLE_OUTPUTS` emite `OUTPUT_STATE`
al abrir y al cerrar, y el evento `Destroyed` de cada ventana también lo emite. En la app:

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

## F2.5 — IDENTIFY_SCREENS
Verificado 2026-10-18 (automatizado): `cargo check` limpio, `cargo test --lib` 29/29
(incluidos `identify_targets_matches_bounds_then_index`,
`identify_screen_deserializa_desde_display_del_frontend` y
`identify_blocks_center_big_number`), `bun run test:unit` 47/47,
`svelte-check` 59 errores (línea base) y Prettier limpio. Verificación visual
(con monitores reales) pendiente para el usuario:

1. Settings → Outputs → "Elegir pantalla" → botón de lupa: cada monitor muestra
   una ventana negra temporal con su número grande (y "PulseFlow — Pantalla N")
   durante 3 s y se cierra sola.
2. El número coincide con el número de la previsualización de la misma pantalla.
3. Repetir desde el popup de selección de salida (misma lupa).
4. Pulsar la lupa dos veces seguidas: no debe quedarse ninguna ventana abierta
   (la segunda ejecución reemplaza a la primera).
5. Las ventanas de identificación no deben aparecer como salidas ni afectar al
   botón de salida (no emiten `OUTPUT_STATE`).

## F2.6 — Puente OUTPUT sin ruido
Verificado 2026-10-18 (automatizado): `bun run test:unit` 47/47, `svelte-check` 59
errores (línea base) y Prettier limpio. Sin cambios en Rust. La lógica es
determinista: todo comando del canal `OUTPUT` que no esté en `OUTPUT_COMMANDS` se
descarta antes de `invoke`, así que no puede generar "Command … not found".
Prueba visual pendiente para el usuario:

1. Levantar la app (`bun run dev:tauri`) con la consola del webview o la terminal
   visible.
2. Abrir una canción y pasar varias slides (también con imagen/video de fondo).
3. Debe salir **cero** error `Command … not found` / `invoke(...) failed`.
4. En desarrollo, puede aparecer **una sola vez** por nombre un warning
   `[tauri] canal OUTPUT: comando "X" descartado …` — es el aviso único, no un
   error.
5. Comprobar que lo que sí funciona sigue funcionando: abrir/cerrar salidas
   (botón de salir), mover bounds en "Elegir pantalla", lupa de identificación,
   y que las salidas siguen mostrando el contenido al cambiar de slide.

## F2.8 — Prueba end-to-end "Elegir monitor → poner en vivo → cubrirlo"
Requiere hardware real: **2 monitores**, en **macOS y Windows**. No se puede ejecutar
en este entorno (sin display físico ni segundo monitor), así que queda para el usuario.
Levantar la app con `bun run dev:tauri`. Recorrido completo:

1. Settings → Outputs → "Elegir pantalla": usar la lupa (`IDENTIFY_SCREENS`) y
   comprobar que cada monitor muestra su número 3 s y se cierra solo.
2. Elegir el **monitor secundario** como salida de audiencia y poner en vivo
   (`TOGGLE_OUTPUTS`).
3. Esperado: la slide aparece en ese monitor **cubriéndolo** (sin la UI de la app),
   con el estilo de la salida elegida.
4. Abrir una **canción** y pasar **varias slides**: cada slide se proyecta
   (`RENDER_SCENE` por salida); en consola, cero `Command … not found`.
5. Poner **imagen de fondo** en una slide → se ve en el monitor; cambiar a una slide
   con **video de fondo** → el video se reproduce y el anterior se detiene.
6. **Limpiar** la salida → vuelve a negro (sin texto ni fondo).
7. Si hay una salida **stage** habilitada: al pasar slides muestra actual + siguiente
   ("SIGUIENTE: …") y reloj, sin mezclarse con la audiencia.
8. Cerrar la salida con el mismo botón → la ventana desaparece; el botón vuelve a su
   estado inactivo (`OUTPUT_STATE` con `active: false`).
9. Repetir el recorrido en **Windows**.

Anotar abajo, por sistema, qué funcionó y qué no (fondos, stage, ubicación en el
monitor, alwaysOnTop, cierre). Ver también F2.2 (ubicación en el monitor), F2.4
(escena por pantalla) y F2.5 (lupa) para detalles puntuales.

### Resultado (pendiente de ejecutar por el usuario)
- macOS: 
- Windows: 

## F3.1 — Errores de escritura visibles
Verificado 2026-10-18 (automatizado): `cargo check` limpio, `cargo test --lib` 36/36
(incluido `set_store_value_devuelve_error_en_carpeta_sin_permisos`, que invoca el
comando con `tauri::test::mock_app()` sobre una carpeta `chmod 555` y comprueba que
devuelve error, que `settings.json` conserva su contenido original y que no queda
ningún `.tmp`), `bun run test:unit` 47/47, `svelte-check` 59 errores (línea base) y
Prettier limpio.

El toast y el indicador de estado no se pueden comprobar sin GUI. Prueba manual:

1. Apuntar la carpeta de datos (`DATA_PATH`, por defecto `~/Documents/PulseFlow`) y la
   de configuración de la app:
   - macOS: `~/Library/Application Support/com.pulseflow.app`
   - Windows: `%APPDATA%\com.pulseflow.app`
2. Cerrar la app y poner una de ellas en solo lectura:
   - Tiendas portables (proyectos, temas, overlays, stage, eventos):
     `chmod 555 ~/Documents/PulseFlow/Config`
   - Ajustes (`SETTINGS`, no portables): `chmod 555 ~/Library/Application Support/com.pulseflow.app`
     (Windows: permisos de la carpeta → denegar escritura).
3. Abrir la app y hacer algo que dispare un guardado (crear/editar un proyecto, o
   cambiar un ajuste según la carpeta elegida).
4. Esperado: toast `Could not save your changes. Check folder permissions and try
   again.` (`toast.save_error`), el indicador de estado (arriba a la izquierda) pasa a
   **Error** en lugar de quedarse en "Saving…", y la consola muestra
   `[tauri] invoke("SAVE") failed: …`.
5. Volver a poner la carpeta escribible (`chmod 755 …`) y guardar de nuevo → se guarda
   sin toast y el archivo contiene el valor nuevo.
6. Mientras hubo fallo, abrir el archivo de la tienda afectada: debe conservar su valor
   anterior (no vacío ni a medias; la escritura es atómica).

### Resultado (pendiente de ejecutar por el usuario)
- macOS: 
- Windows: 

## F3.2 — Estilo por defecto válido
Verificado 2026-10-18 (automatizado): `cargo check` limpio, `cargo test --lib` 38/38
(incluido `instalacion_limpia_el_estilo_de_la_salida_existe`, que construye un
`StoreManager` sobre una carpeta temporal vacía y comprueba que el estilo referenciado
por `settings.outputs.default.style` existe y se llama "Default"), `bun run test:unit`
47/47 y Prettier limpio. El engine de render no consume `styles`; el cambio es
cosmético en la UI.

"No muestra Unnamed" no se puede confirmar sin GUI. Prueba manual:

1. Empezar de una instalación limpia:
   - Cerrar la app.
   - Renombrar (no borrar) las carpetas de datos y de configuración para que arranque
     vacía:
     - macOS: `~/Documents/PulseFlow` y `~/Library/Application Support/com.pulseflow.app`
     - Windows: `%USERPROFILE%\Documents\PulseFlow` y `%APPDATA%\com.pulseflow.app`
2. Abrir la app e ir a **Settings → Outputs**.
3. Esperado: en la fila del estilo de la salida "Primary" aparece **Default** (no
   "Unnamed", que aparecía en cursiva).
4. Abrir el selector de estilo: debe listarse "Default" como opción.
5. Nota: una instalación existente que ya tenga su `settings_synced.json` sin
   `styles.default` seguirá mostrando "Unnamed"; en ese caso basta elegir el estilo a
   mano (no hay migración, era fuera del alcance de F3.2).

### Resultado (pendiente de ejecutar por el usuario)
- macOS: 
- Windows: 

## F3 — Transiciones GPU (WGSL)
A completar: comprobar transiciones suaves en la misma pantalla, sin parpadeo, a 60 fps.

## F4.4 — Transiciones (crossfade y corte)
Verificado 2026-10-19 (automatizado): `cargo check` limpio y `cargo test --lib` 53/53
(3 tests nuevos sobre el motor de doble buffer: el corte muestra siempre el buffer
nuevo aunque el progreso sea 0; el crossfade mezcla los dos buffers —0 = anterior,
0,5 ≈ (128, 0, 128), 1 = nuevo—; y `trigger` sólo pide copiar el fotograma anterior
cuando la transición es real). No se tocó `src/`, así que `test:unit`/`test:svelte`/
`build` no cambian.

La verificación visual (la transición animada en una ventana real) necesita GUI.
Prueba manual con `bun run dev:tauri` y **2 monitores**:

1. Settings → Outputs → dar un estilo de audiencia a la salida "Primary" y ponerla en
   vivo. Abrir una canción y pasar a la siguiente slide.
2. Con la transición de la salida en **crossfade** (duración > 0 ms): el cambio de
   slide debe ser un fundido suave entre la slide anterior y la nueva, sin parpadeo ni
   fotogramas negros, a la frecuencia del monitor.
3. Con la transición en **corte** (tipo "none" o duración 0 ms): el cambio debe ser
   instantáneo (sin fundido).
4. Cambiar algo ajeno a la salida (p. ej. mover un ajuste de la UI de control, o abrir
   una segunda salida) **no** debe producir un fundido en la primera: el engine sólo
   dispara transición si el contenido visible cambió de verdad.
5. Repetir en **Windows**.

### Resultado (pendiente de ejecutar por el usuario)
- macOS: 
- Windows: 

## F4.5 — Items de imagen/medio dentro de la slide
Verificado 2026-10-19 (automatizado): `cargo check --tests` limpio y `cargo test --lib`
56/56 (3 tests nuevos: tipos de `scene.rs`, contrato TS ↔ Rust sobre el fixture
`audience-media.json`, y el golden `item-imagen` —una imagen de 4 cuadrantes con
`fit: "fill"` en una caja de 320×180 dentro de una escena de 640×360; cada cuadrante
conserva su color en su centro y fuera de la caja queda negro—). Los goldens de F4.3
quedan byte a byte idénticos, así que el fondo no cambió. `test:unit` 49/49 y
`test:svelte` 59 errores (línea base).

La verificación visual necesita GUI. Prueba manual con `bun run dev:tauri`:

1. Abrir una canción, arrastrar una **imagen** desde el media bin a la slide y ponerla
   en vivo.
2. La imagen debe aparecer en la salida dentro de su caja (no a pantalla completa salvo
   que la caja la cubra) y con el encaje elegido (`cover`/`contain`/`fill`). Con
   `contain`, lo que sobra de la caja debe verse transparente (fondo), no negro.
3. Cambiar `fit` de la imagen: se debe re-dibujar con el nuevo encaje.
4. Poner un texto encima de la imagen: el texto debe verse sobre la imagen (el engine
   dibuja fondo → medios → texto; el orden de apilado de la slide todavía no se respeta).
5. Un **video** como item de slide no se dibuja todavía (limitación conocida); la imagen
   sí.

### Resultado (pendiente de ejecutar por el usuario)

## F4 — NDI directo desde framebuffer GPU
A completar: verificar que START_NDI_NATIVE_FEED inicia la captura y que el feed está activo.

## F5 — Looks (estilos/temas visuales) — FIN F5: PAUSA
Marcada la pausa indicada al finalizar F5. Incluir los resultados en `docs/VERIFICAR.md`.

## Otras tareas posteriores
Añadir aquí cualquier hallazgo de F6 en adelante, conforme aparezcan.
