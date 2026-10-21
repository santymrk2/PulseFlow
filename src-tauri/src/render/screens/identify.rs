//! Identificación de pantallas: ventana con el número de cada monitor.

use super::*;

// ---------------------------------------------------------------------------
// Identificación de monitores (F2.5)
// ---------------------------------------------------------------------------

/// Duración del número en pantalla al identificar monitores.
const IDENTIFY_DURATION: Duration = Duration::from_secs(3);

/// Pantalla enviada por `IDENTIFY_SCREENS` (espejo en TypeScript:
/// `IdentifyScreen` en `src/types/Output.ts`). El frontend manda la lista de
/// `GET_DISPLAYS` ya ordenada como la previsualiza; la posición (1-based) de
/// cada entrada es el número que se muestra en el monitor.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct IdentifyScreen {
    /// Id del monitor en `GET_DISPLAYS`. Desde F10.0c es un string estable; se
    /// acepta también el índice viejo (número/string numérico) como desempate.
    pub id: Option<serde_json::Value>,
    /// Bounds del monitor (mismo sistema que `ScreenRect`, lógicos).
    pub bounds: Option<ScreenRect>,
}

impl IdentifyScreen {
    /// Índice de fallback: sólo si `id` es numérico (id viejo).
    pub(super) fn legacy_index(&self) -> Option<usize> {
        match &self.id {
            Some(serde_json::Value::Number(n)) => n.as_u64().map(|n| n as usize),
            Some(serde_json::Value::String(s)) => s.parse().ok(),
            _ => None,
        }
    }
}

/// Emparejamiento puro entre las entradas del payload y los monitores reales
/// (testeable sin monitores): devuelve (número a mostrar, índice de monitor).
/// El monitor es el que contiene el centro de los bounds de la entrada; si no,
/// el mismo índice de la entrada (el orden de `GET_DISPLAYS` coincide con el de
/// `available_monitors`). Sin monitor, la entrada se omite.
pub(super) fn identify_targets(monitors: &[ScreenRect], entries: &[IdentifyScreen]) -> Vec<(String, usize)> {
    entries
        .iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            let monitor = entry
                .bounds
                .filter(|b| b.width > 0 && b.height > 0)
                .and_then(|b| monitors.iter().position(|m| m.contains(b.center())))
                .or_else(|| entry.legacy_index().filter(|i| *i < monitors.len()))
                .or_else(|| (index < monitors.len()).then_some(index))?;
            Some(((index + 1).to_string(), monitor))
        })
        .collect()
}

/// `IDENTIFY_SCREENS`: ventana temporal por monitor con su número grande
/// durante 3 s (F2.5), usando el mismo bucle de render que las salidas. No
/// entra en `ScreenManager`: son ventanas `identify-*` que se destruyen solas.
pub fn identify_screens(app: &AppHandle, entries: &[IdentifyScreen]) -> AppResult<()> {
    let monitors = app.available_monitors().map_err(|e| AppError::new(e.to_string()))?;
    let rects: Vec<ScreenRect> = monitors.iter().map(ScreenRect::of_monitor).collect();

    let targets = if entries.is_empty() {
        // Sin payload: todos los monitores, numerados por su orden.
        rects.iter().enumerate().map(|(i, _)| ((i + 1).to_string(), i)).collect()
    } else {
        identify_targets(&rects, entries)
    };

    for (number, monitor_index) in targets {
        let Some(monitor) = monitors.get(monitor_index) else { continue };
        if let Err(err) = open_identify_window(app, &number, monitor) {
            eprintln!("[identify] no se pudo abrir la ventana del monitor {monitor_index}: {err}");
        }
    }
    Ok(())
}

/// Ventana temporal cubriendo el monitor con el número grande; se cierra sola.
pub(super) fn open_identify_window(app: &AppHandle, number: &str, monitor: &Monitor) -> AppResult<()> {
    let label = format!("identify-{number}");
    // Reemplaza una identificación anterior en curso (mismo monitor).
    if let Some(existing) = app.get_window(&label) {
        let _ = existing.destroy();
    }

    let rect = ScreenRect::of_monitor(monitor);
    let window = WindowBuilder::new(app, &label)
        .title(format!("Pantalla {number}"))
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .always_on_top(true)
        .visible(true)
        .build()
        .map_err(|e| AppError::new(format!("Error al crear la ventana de identificación: {e}")))?;

    let _ = window.set_position(LogicalPosition::new(rect.x as f64, rect.y as f64));
    let _ = window.set_size(LogicalSize::new(rect.width as f64, rect.height as f64));

    let window = Arc::new(window);
    let scene = Arc::new(RwLock::new(ScreenScene {
        text: identify_blocks(number, rect.width, rect.height),
        ..Default::default()
    }));
    let running = Arc::new(AtomicBool::new(true));

    // La ventana de identificación no transiciona: nace con su contenido.
    let render_thread = match spawn_render_loop(
        Arc::clone(&window),
        ScreenKind::Audience,
        Arc::clone(&scene),
        Arc::clone(&running),
        Arc::new(Mutex::new(None)),
        Arc::new(Mutex::new(window.inner_size().unwrap_or(PhysicalSize::new(rect.width as u32, rect.height as u32)))),
    ) {
        Ok(thread) => thread,
        Err(err) => {
            let _ = window.destroy();
            return Err(err);
        }
    };

    // La ventana se destruye sola a los 3 s (F2.5).
    thread::Builder::new()
        .name(format!("PulseFlow-Identify-{number}"))
        .spawn(move || {
            thread::sleep(IDENTIFY_DURATION);
            running.store(false, Ordering::SeqCst);
            let _ = render_thread.join();
            let _ = window.destroy();
        })
        .map_err(|e| AppError::new(format!("Error iniciando el temporizador de identificación: {e}")))?;

    Ok(())
}

/// Bloques de texto de una ventana de identificación: número grande centrado
/// y, debajo, el nombre del monitor.
pub(super) fn identify_blocks(number: &str, width: u32, height: u32) -> Vec<TextBlock> {
    let (w, h) = (width as f32, height as f32);
    vec![
        TextBlock {
            text: number.to_string(),
            font_size: (h * 0.5).min(w * 0.5),
            font_weight: 800,
            color: [1.0, 1.0, 1.0, 1.0],
            alignment: "center".to_string(),
            vertical_align: Some("center".to_string()),
            x: 0.0,
            y: 0.0,
            width: w,
            height: h,
            line_height_ratio: 1.0,
            outline_color: Some([0.0, 0.0, 0.0, 1.0]),
            outline_width: Some(4.0),
            ..Default::default()
        },
        TextBlock {
            text: format!("PulseFlow — Pantalla {number}"),
            font_size: (h * 0.04).clamp(16.0, 40.0),
            color: [0.6, 0.6, 0.6, 1.0],
            alignment: "center".to_string(),
            x: 0.0,
            y: h * 0.9,
            width: w,
            height: h * 0.08,
            line_height_ratio: 1.2,
            ..Default::default()
        },
    ]
}

