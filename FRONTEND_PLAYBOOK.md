# Plan de Integración Frontend: Svelte + Tauri

## Protocolo de Trabajo Autónomo

1. Tu objetivo es desconectar el frontend de Electron y conectarlo a la nueva API de Tauri.
2. Todo el trabajo de esta fase ocurre en la carpeta `src/` (Svelte/TypeScript) y en el `package.json` principal. NO modifiques `src-tauri/` en esta fase.
3. Al terminar cada bloque, cambia `[ ]` por `[x]` y avanza al siguiente.

---

## BITÁCORA DE EJECUCIÓN

### [x] Bloque 1: Dependencias del Frontend

- **Acción:** Instala la API oficial de Tauri en el frontend ejecutando `bun add @tauri-apps/api`.
- **Limpieza:** Elimina del `package.json` las dependencias de Electron (`electron`, `electron-builder`, `electron-updater`, etc.) si están en `devDependencies` o `dependencies`.

### [x] Bloque 2: Puente de Comunicación (IPC a Invoke)

- **Objetivo:** El frontend actual se comunica usando `window.api.send("MAIN", { channel: "COMANDO", data: payload })`. Debemos cambiar esto.
- **Acción:** Busca el archivo central donde se define esta comunicación (probablemente un wrapper en `src/utils/` o directamente en las llamadas a la API).
- **Refactor:** Modifica la función de envío para que importe `import { invoke } from '@tauri-apps/api/core'` y llame a `invoke(channel, payload)`. Asegúrate de que los canales se pasen como strings exactos (ej. `"SAVE"`, `"GET_OS"`).

### [x] Bloque 3: Eventos Push (Listeners)

- **Objetivo:** Migrar los eventos que el backend envía al frontend (antes `window.api.receive(...)`).
- **Acción:** Reemplaza la lógica de escucha por `import { listen } from '@tauri-apps/api/event'`. Las funciones deben usar `await listen('NOMBRE_EVENTO', (event) => { ... })`.

### [x] Bloque 4: Limpieza de Preload y Main de Electron

- **Acción:** Elimina los archivos de configuración exclusivos de Electron que ya no sirven (como `src/electron/preload.ts`, `src/electron/index.ts` y las carpetas de IPC de Node.js). Asegúrate de no borrar lógica de negocio que aún no haya sido migrada, solo los _entrypoints_ de Electron.
