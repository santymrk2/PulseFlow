//! Ciclo de vida de las pantallas: abrir, cerrar, reposicionar y estado de salida.

use super::*;

// ---------------------------------------------------------------------------
// Abrir / cerrar pantallas
// ---------------------------------------------------------------------------

/// Abre (o reubica, si ya está abierta) la pantalla de una salida.
pub fn open_screen(app: &AppHandle, config: &ScreenConfig) -> AppResult<()> {
    let state = manager(app)?;
    let kind = config.kind();

    // Ya abierta con el mismo tipo: sólo reubicar.
    {
        let screens = state.screens.lock_safe();
        if let Some(handle) = screens.get(&config.id) {
            if handle.kind == kind {
                if let Some(window) = app.get_window(&handle.label) {
                    place_window(app, &window, config, kind);
                    let _ = window.set_always_on_top(config.always_on_top.unwrap_or(true));
                    let _ = window.show();
                }
                return Ok(());
            }
        }
    }
    // Cambió de tipo (audiencia <-> stage): cerrar y volver a abrir.
    close_screen(app, &config.id)?;

    let label = format!("{}-{}", screen_label(&config.id), WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed));
    let title = match kind {
        ScreenKind::Audience => format!(
            "PulseFlow — {}",
            if config.name.is_empty() { "Audiencia" } else { &config.name }
        ),
        ScreenKind::Stage => format!(
            "PulseFlow — Stage: {}",
            if config.name.is_empty() { "Stage" } else { &config.name }
        ),
    };

    // La ventana se crea visible: el handle nativo no existe hasta que la ventana
    // se realiza, y WGPU lo necesita para crear la superficie (hallazgo 2, F2.1).
    let window = WindowBuilder::new(app, &label)
        .title(title)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .shadow(false)
        .always_on_top(config.always_on_top.unwrap_or(true))
        .focused(false)
        .visible(true)
        .build()
        .map_err(|e| AppError::new(format!("Error al crear la ventana de salida: {e}")))?;

    place_window(app, &window, config, kind);

    let window = Arc::new(window);
    let scene = state.scene(&config.id);
    let video_frame: Arc<Mutex<Option<VideoFrame>>> = Arc::new(Mutex::new(None));
    let transition: Arc<Mutex<Option<TransitionRequest>>> = Arc::new(Mutex::new(None));
    let running = Arc::new(AtomicBool::new(true));
    let surface_size = Arc::new(Mutex::new(window.inner_size().unwrap_or(PhysicalSize::new(1920, 1080))));

    let thread = match spawn_render_loop(
        Arc::clone(&window),
        kind,
        Arc::clone(&scene),
        Arc::clone(&video_frame),
        Arc::clone(&running),
        Arc::clone(&transition),
        Arc::clone(&surface_size),
    ) {
        Ok(thread) => thread,
        Err(err) => {
            let _ = window.destroy();
            return Err(err);
        }
    };

    // (F2.3 agregará aquí la emisión de OUTPUT_STATE al frontend.)
    {
        let app_handle = app.clone();
        let id = config.id.clone();
        let label = label.clone();
        let surface_size = Arc::clone(&surface_size);
        window.on_window_event(move |event| match event {
            // El bucle de render lee el tamaño de acá, nunca de la ventana.
            WindowEvent::Resized(size) => *surface_size.lock_safe() = *size,
            WindowEvent::ScaleFactorChanged { new_inner_size, .. } => *surface_size.lock_safe() = *new_inner_size,
            WindowEvent::Destroyed => {
                // Sólo si esta ventana sigue siendo la de la salida (no una anterior
                // que terminó de cerrarse después de reabrir).
                let handle = manager(&app_handle).ok().and_then(|s| {
                    let mut screens = s.screens.lock_safe();
                    if screens.get(&id).map(|h| h.label == label).unwrap_or(false) {
                        screens.remove(&id)
                    } else {
                        None
                    }
                });
                if let Some(mut handle) = handle {
                    handle.stop(&app_handle, false);
                    emit_output_state(&app_handle, &[(id.clone(), false)]);
                }
            }
            _ => {}
        });
    }

    let mut handle = ScreenHandle {
        kind,
        label: label.clone(),
        running,
        thread: Some(thread),
        video_frame,
        video: None,
        transition,
    };

    // Arrancar el video de fondo si la escena actual ya tiene uno.
    let background = scene.read_safe().background.clone();
    if kind == ScreenKind::Audience {
        sync_video(app, &mut handle, background.as_ref());
    }

    state.screens.lock_safe().insert(config.id.clone(), handle);
    Ok(())
}

/// Cierra la pantalla de una salida (si está abierta).
pub fn close_screen(app: &AppHandle, id: &str) -> AppResult<()> {
    let state = manager(app)?;
    let handle = state.screens.lock_safe().remove(id);
    if let Some(mut handle) = handle {
        handle.stop(app, true);
    }
    Ok(())
}

/// Cierra todas las pantallas.
pub fn close_all_screens(app: &AppHandle) -> AppResult<Vec<String>> {
    let ids = open_ids(app);
    for id in &ids {
        close_screen(app, id)?;
    }
    Ok(ids)
}

/// Reubica una pantalla **abierta** con la configuración nueva (la que mueve el
/// usuario en "Elegir pantalla"). Si está cerrada no la abre: la configuración
/// quedará aplicada cuando se abra.
pub fn reposition_screen(app: &AppHandle, config: &ScreenConfig) -> AppResult<()> {
    let state = manager(app)?;
    let open_kind = {
        let screens = state.screens.lock_safe();
        screens.get(&config.id).map(|h| h.kind)
    };
    match open_kind {
        Some(kind) if kind == config.kind() => open_screen(app, config),
        _ => Ok(()),
    }
}

/// Ids de todas las pantallas abiertas.
pub fn open_ids(app: &AppHandle) -> Vec<String> {
    manager(app)
        .map(|s| s.screens.lock_safe().keys().cloned().collect())
        .unwrap_or_default()
}

/// Notifica al frontend el estado de las salidas (`OUTPUT` → `OUTPUT_STATE`).
pub fn emit_output_state(app: &AppHandle, states: &[(String, bool)]) {
    let data: Vec<_> = states
        .iter()
        .map(|(id, active)| serde_json::json!({ "id": id, "active": active }))
        .collect();
    let _ = app.emit("OUTPUT", serde_json::json!({ "channel": "OUTPUT_STATE", "data": data }));
}

