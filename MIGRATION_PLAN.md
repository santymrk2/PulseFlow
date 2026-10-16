# MIGRATION_PLAN.md

Migración de FreeShow de Electron + Svelte a Tauri + React, manteniendo la
estética moderna de shadcn/ui + Tailwind v4 y copiando de Svelte únicamente la
**ubicación espacial** de los paneles (Flexbox/Grid).

- [x] Fase 1: Ensamblaje Visual (UI Shell) - Restaurar el layout de Svelte (Library izquierda, Editor centro, Properties derecha, MediaBar abajo, Topbar arriba) pero usando EXCLUSIVAMENTE los estilos modernos de shadcn/ui y Tailwind v4. Limpiar clases que simulen Svelte.
- [x] Fase 2: Editor Core (Núcleo) - Capas (ItemsPanel), auto-size (useAutoFit + toggle por ítem), estilos por ítem (Box/Slide/Text), notas (SlideNotes → Stage Display).
- [ ] Fase 3: Salidas y Conversores - Output layers y conversores vitales (ProPresenter, OpenLP, Biblias).
- [ ] Fase 4: Entradas en Vivo y NDI - Cámaras, micrófonos, captura de pantalla y red NDI.
- [ ] Fase 5: Control Remoto - Integración con OBS / Controladores externos.
