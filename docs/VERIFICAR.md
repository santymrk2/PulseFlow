# Pasos de verificación manual

Cosas que el agente **no puede verificar solo** (GUI con el mouse, segundo
monitor, Windows). Cada sección dice qué hacer y qué debería verse. Al terminar
una prueba, marcar el checkbox de la tarea en [`ROADMAP.md`](ROADMAP.md).

---

## F0.2 — `RENDER_SNAPSHOT` con nombre de archivo seguro

La versión con `path` absoluto ya fue probada por consola (PNG verificado:
640×360, "Hola PulseFlow" blanco sobre negro). Tras el ajuste de seguridad, la
llamada cambió (sólo nombre de archivo; devuelve la ruta completa):

1. Levantar la app: `bun run dev:tauri`.
2. Click derecho en la ventana de PulseFlow → *Inspect* (o ⌘⌥I) → Consola.
3. Pegar:

   ```js
   await window.__TAURI_INTERNALS__.invoke("RENDER_SNAPSHOT", { data: { scene: { outputId: "manual", stage: false, width: 1920, height: 1080, background: null, items: [{ type: "text", x: 100, y: 400, width: 1720, height: 300, align: "center", verticalAlign: "center", lineHeight: 1.2, fontSize: 96, fontWeight: 700, color: [1,1,1,1], text: "Hola PulseFlow", spans: [] }], transition: null, plainText: "Hola PulseFlow" }, width: 640, height: 360, fileName: "consola-check" } })
   ```

   **Esperado:** devuelve la ruta completa, por ejemplo
   `…/Library/Caches/com.pulseflow.app/snapshots/consola-check.png` (sin error).
4. Abrir el PNG: debe verse "Hola PulseFlow" en blanco sobre negro.
5. Probar `fileName: "../escape"` en la misma llamada: **esperado**, error
   "nombre de archivo inválido".
