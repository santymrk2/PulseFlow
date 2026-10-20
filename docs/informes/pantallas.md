# Informe Carril A — Pantallas (F10.3 → F10.4 → F10.5)

Rama: feature/f10-pantallas
Carpeta: /Users/santiagomercadocarbone/Documents/Develops/PulseFlow-pantallas
Inicio: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Estado base
- F10.2 en origin/feature/tauri-rust-migration: NO mergeado (sondeo dio 0). Sigo "Esperar la base": avanzo con estructura/modal/lista/monitores sin depender de tipos nuevos de F10.1/F10.2.
- test:svelte línea base: ~58 errores (no aumentar). test:unit OK.
- F10.0e ya existe: DisplayLayout.svelte + displayLayout.ts (reutilizar).

## Tareas
- [ ] F10.3 Ventana "Configuración de pantallas": estructura y Hardware
- [ ] F10.4 Pestañas Recorte y Envío; panel de Stage
- [ ] F10.5 Tipos de pantalla: Única, Espejo, Edge blend

## Decisiones
- (pendiente)

## Commits
- (pendiente)

## Verificaciones
- (pendiente)

### F10.3 (progreso)
- Creado `components/main/Modal.svelte` (modal centrado, Esc cierra, sin cerrar con click fuera, header 36px).
- Registrados `screen_config` y `looks_config` en tipos y popups.
- Creada carpeta `components/screens/` con `ScreenConfig`, `ScreenList`, `ScreenDetail`, `SystemDisplays` usando `DisplayLayout`.
- Columna izquierda: Audiencia/Stage con interruptor (toggleOutputs), + para crear, lista con punto live. Abajo Sistema con monitores (GET_DISPLAYS) + "Identificar pantallas" + sección NDI "Nueva salida NDI".
- Panel derecho: nombre editable, resolución, lienzo clicable para asignar monitor, tipo Única/Espejo/Edge blend con mirrorOf, panel Hardware (Salida/Destino/Personalizado + info). Tabs Recorte/Envío esbozados (se completa en F10.4).
- Creada carpeta `components/looks/` con `LooksWindow` (estructura modal), `LookGrid`, `LookAdvanced` (base para F10.6).

