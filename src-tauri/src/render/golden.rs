//! F4.3: golden tests visuales del engine.
//!
//! Renderiza escenas de referencia con `snapshot::render_snapshot_rgba` (offscreen,
//! sin monitor; F0.2) y las compara contra los PNG commiteados en
//! `src-tauri/tests/golden/scene/`. La comparación es por celdas (media de color de
//! cada bloque) con tolerancia: así detecta regresiones de composición (una capa que
//! no se dibuja, un color o una posición que cambian) sin depender de diferencias
//! mínimas de rasterizado de glifos. El texto usa las fuentes del sistema, que no son
//! las mismas en cada plataforma, por lo que una comparación píxel a píxel sería
//! frágil; cada escena además comprueba lo suyo a mano (texto, contorno/sombra, fondo).
//!
//! Regenerar los goldens: `UPDATE_GOLDEN=1 cargo test --lib golden`.

use super::scene::ScenePayload;
use super::snapshot::render_snapshot_rgba;

/// Carpeta de los PNG de referencia (relativa a la raíz del crate).
const GOLDEN_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden/scene");
/// Variable de entorno que regenera los goldens en vez de compararlos.
const UPDATE_ENV: &str = "UPDATE_GOLDEN";
/// Lado (px) de las celdas de la comparación por bloques.
const CELL_SIZE: u32 = 32;
/// Diferencia máxima por canal (0..=255) admitida en la media de una celda.
const CELL_TOLERANCE: i32 = 40;
/// Fracción de celdas que pueden superar la tolerancia (ruido de rasterizado).
const MAX_DIFF_FRACTION: f32 = 0.05;

/// Resolución de las escenas de referencia (16:9).
const WIDTH: u32 = 640;
const HEIGHT: u32 = 360;

/// Ruta del PNG de referencia `name`.
fn golden_path(name: &str) -> std::path::PathBuf {
    std::path::Path::new(GOLDEN_DIR).join(format!("{name}.png"))
}

/// Compara la imagen recién renderizada con el golden `name`, o lo (re)genera si
/// `UPDATE_GOLDEN` está definido.
fn assert_golden(name: &str, actual: &[u8], width: u32, height: u32) {
    assert_eq!(actual.len(), (width * height * 4) as usize, "tamaño del buffer de «{name}»");
    let path = golden_path(name);

    if std::env::var_os(UPDATE_ENV).is_some() {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("crear la carpeta de goldens");
        }
        image::RgbaImage::from_raw(width, height, actual.to_vec())
            .expect("buffer RGBA del golden")
            .save(&path)
            .expect("guardar el golden");
        eprintln!("golden actualizado: {}", path.display());
        return;
    }

    let golden = image::open(&path)
        .unwrap_or_else(|e| {
            panic!(
                "no se pudo abrir el golden {} ({e}); regenerá con {UPDATE_ENV}=1 cargo test --lib",
                path.display()
            )
        })
        .to_rgba8();
    assert_eq!(
        (golden.width(), golden.height()),
        (width, height),
        "el golden «{name}» tiene otro tamaño"
    );
    compare_cells(name, golden.as_raw(), actual, width, height);
}

/// Divide ambas imágenes en celdas (media RGB por bloque) y falla si demasiadas
/// difieren. Es la tolerancia visual: iguala zonas con el mismo contenido aunque los
/// glifos no coincidan píxel a píxel.
fn compare_cells(name: &str, golden: &[u8], actual: &[u8], width: u32, height: u32) {
    let mut total = 0usize;
    let mut differing = 0usize;
    let mut worst = 0i32;

    let mut y = 0;
    while y < height {
        let cell_h = CELL_SIZE.min(height - y);
        let mut x = 0;
        while x < width {
            let cell_w = CELL_SIZE.min(width - x);
            let golden_mean = cell_mean(golden, width, x, y, cell_w, cell_h);
            let actual_mean = cell_mean(actual, width, x, y, cell_w, cell_h);
            let delta = (0..3).map(|c| (golden_mean[c] - actual_mean[c]).abs()).max().unwrap_or(0);
            worst = worst.max(delta);
            total += 1;
            if delta > CELL_TOLERANCE {
                differing += 1;
            }
            x += cell_w;
        }
        y += cell_h;
    }

    let allowed = (total as f32 * MAX_DIFF_FRACTION).ceil() as usize;
    assert!(
        differing <= allowed,
        "el golden «{name}» cambió visualmente: {differing} de {total} celdas difieren en más de {CELL_TOLERANCE} (peor canal: {worst}); si es intencional, corré {UPDATE_ENV}=1 cargo test --lib"
    );
}

/// Media RGB (0..=255) de la celda `(x, y, w, h)`.
fn cell_mean(rgba: &[u8], width: u32, x: u32, y: u32, w: u32, h: u32) -> [i32; 3] {
    let mut sum = [0i64; 3];
    for row in y..y + h {
        let start = ((row * width + x) * 4) as usize;
        for px in rgba[start..start + (w * 4) as usize].chunks_exact(4) {
            sum[0] += i64::from(px[0]);
            sum[1] += i64::from(px[1]);
            sum[2] += i64::from(px[2]);
        }
    }
    let n = i64::from(w * h);
    [(sum[0] / n) as i32, (sum[1] / n) as i32, (sum[2] / n) as i32]
}

/// Color RGB de un píxel (sin alfa).
fn pixel_at(rgba: &[u8], width: u32, x: u32, y: u32) -> [u8; 3] {
    let i = ((y * width + x) * 4) as usize;
    [rgba[i], rgba[i + 1], rgba[i + 2]]
}

/// Cuenta los píxeles cuyo RGB cumple `predicate`.
fn count_pixels(rgba: &[u8], predicate: impl Fn([u8; 3]) -> bool) -> usize {
    rgba.chunks_exact(4).filter(|p| predicate([p[0], p[1], p[2]])).count()
}

/// Luminosidad aproximada (suma de canales) de un píxel.
fn luminosity(rgba: &[u8], width: u32, x: u32, y: u32) -> u32 {
    pixel_at(rgba, width, x, y).iter().map(|&c| u32::from(c)).sum()
}

/// Payload de una escena de referencia, desde el mismo JSON que viaja por IPC.
fn scene(value: serde_json::Value) -> ScenePayload {
    serde_json::from_value(value).expect("payload de golden válido")
}

/// Texto blanco centrado en una caja de 640×120 (y = 120..240), sin fondo.
fn texto_centrado() -> ScenePayload {
    scene(serde_json::json!({
        "outputId": "golden-texto",
        "stage": false,
        "width": WIDTH,
        "height": HEIGHT,
        "background": null,
        "items": [{
            "type": "text",
            "id": "item-0",
            "x": 0, "y": 120, "width": WIDTH, "height": 120,
            "align": "center", "verticalAlign": "center", "lineHeight": 1.2,
            "fontSize": 64, "fontWeight": 700, "color": [1, 1, 1, 1],
            "text": "PULSEFLOW"
        }],
        "transition": null,
        "plainText": "PULSEFLOW"
    }))
}

/// Texto blanco con contorno rojo y sombra azul desplazada 8 px: ejercita las tres
/// capas del motor de texto (sombra, contorno y texto principal).
fn texto_contorno_sombra() -> ScenePayload {
    scene(serde_json::json!({
        "outputId": "golden-contorno",
        "stage": false,
        "width": WIDTH,
        "height": HEIGHT,
        "background": null,
        "items": [{
            "type": "text",
            "id": "item-0",
            "x": 0, "y": 120, "width": WIDTH, "height": 120,
            "align": "center", "verticalAlign": "center", "lineHeight": 1.2,
            "fontSize": 64, "fontWeight": 700, "color": [1, 1, 1, 1],
            "stroke": { "color": [1, 0, 0, 1], "width": 6 },
            "shadow": { "color": [0, 0, 1, 1], "offsetX": 8, "offsetY": 8 },
            "text": "PULSEFLOW"
        }],
        "transition": null,
        "plainText": "PULSEFLOW"
    }))
}

/// Fondo de imagen (4 cuadrantes) con texto blanco encima.
fn fondo_imagen(image_path: &str) -> ScenePayload {    scene(serde_json::json!({
        "outputId": "golden-fondo",
        "stage": false,
        "width": WIDTH,
        "height": HEIGHT,
        "background": {
            "path": image_path,
            "type": "image",
            "fit": "fill",
            "opacity": 1,
            "loop": false,
            "muted": false
        },
        "items": [{
            "type": "text",
            "id": "item-0",
            "x": 0, "y": 120, "width": WIDTH, "height": 120,
            "align": "center", "verticalAlign": "center", "lineHeight": 1.2,
            "fontSize": 64, "fontWeight": 700, "color": [1, 1, 1, 1],
            "text": "PULSEFLOW"
        }],
        "transition": null,
        "plainText": "PULSEFLOW"
    }))
}

/// Item de medio (imagen de 4 cuadrantes) dentro de la slide, con `fit: "fill"`, en
/// la caja x: 160..480, y: 90..270 de la escena 640×360 (F4.5).
fn item_imagen(image_path: &str) -> ScenePayload {
    scene(serde_json::json!({
        "outputId": "golden-item",
        "stage": false,
        "width": WIDTH,
        "height": HEIGHT,
        "background": null,
        "items": [{
            "type": "media",
            "id": "item-0",
            "x": 160, "y": 90, "width": 320, "height": 180,
            "src": image_path,
            "mediaType": "image",
            "fit": "fill",
            "opacity": 1
        }],
        "transition": null,
        "plainText": ""
    }))
}

/// Escena con overlays (texto e imagen) encima de un texto de slide (F4.6).
fn overlays(image_path: &str) -> ScenePayload {
    scene(serde_json::json!({
        "outputId": "golden-overlays",
        "stage": false,
        "width": WIDTH,
        "height": HEIGHT,
        "background": null,
        "items": [{
            "type": "text",
            "id": "item-0",
            "x": 0, "y": 120, "width": WIDTH, "height": 120,
            "align": "center", "verticalAlign": "center", "lineHeight": 1.2,
            "fontSize": 64, "fontWeight": 700, "color": [1, 1, 1, 1],
            "text": "Slide"
        }],
        "overlays": [
            {
                "type": "media",
                "id": "overlay-media",
                "x": 160, "y": 90, "width": 320, "height": 180,
                "src": image_path,
                "mediaType": "image",
                "fit": "fill",
                "opacity": 0.9
            },
            {
                "type": "text",
                "id": "overlay-text",
                "x": 0, "y": 0, "width": WIDTH, "height": 60,
                "align": "left", "verticalAlign": "center", "lineHeight": 1.2,
                "fontSize": 32, "fontWeight": 700, "color": [1, 1, 0, 1],
                "text": "Aviso"
            }
        ],
        "transition": null,
        "plainText": "Slide"
    }))
}

/// Escribe en la carpeta temporal una imagen de 4 cuadrantes (rojo/verde/azul/blanco)
/// y devuelve su ruta. Es determinista, así el golden del fondo no depende de assets.
fn reference_background() -> String {
    let dir = std::env::temp_dir().join("pulseflow-golden");
    std::fs::create_dir_all(&dir).expect("carpeta temporal de goldens");
    let path = dir.join("cuadrantes.png");

    let (w, h) = (32u32, 18u32);
    let mut image = image::RgbaImage::new(w, h);
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let color = match (x < w / 2, y < h / 2) {
            (true, true) => [255, 0, 0, 255],
            (false, true) => [0, 255, 0, 255],
            (true, false) => [0, 0, 255, 255],
            (false, false) => [255, 255, 255, 255],
        };
        *pixel = image::Rgba(color);
    }
    image.save(&path).expect("guardar la imagen de referencia");
    path.to_string_lossy().into_owned()
}

/// Aproxima dos colores canal a canal.
fn assert_color_near(actual: [u8; 3], expected: [u8; 3], what: &str) {
    (0..3).for_each(|c| {
        let diff = i32::from(actual[c]) - i32::from(expected[c]);
        assert!(
            diff.abs() <= 40,
            "{what}: canal {c} = {} (esperado ~{}; RGB {actual:?} vs {expected:?})",
            actual[c],
            expected[c]
        );
    });
}

#[test]
fn golden_texto_centrado() {
    let scene = texto_centrado();
    let rgba = render_snapshot_rgba(&scene, WIDTH, HEIGHT).expect("render del snapshot");

    // Estructural: hay texto (píxeles claros) en su zona, es blanco/gris (no de
    // color) y el resto queda negro.
    let mut lit_in_text_zone = 0usize;
    let mut lit_outside = 0usize;
    for y in 0..HEIGHT {
        for x in 0..WIDTH {
            if luminosity(&rgba, WIDTH, x, y) > 60 {
                if (120..240).contains(&y) {
                    lit_in_text_zone += 1;
                } else {
                    lit_outside += 1;
                }
            }
        }
    }
    assert!(lit_in_text_zone > 200, "debe haber texto en su zona ({lit_in_text_zone})");
    assert_eq!(lit_outside, 0, "fuera de la zona del texto todo debe ser negro");

    let blancos = count_pixels(&rgba, |[r, g, b]| r > 200 && g > 200 && b > 200);
    let de_color = count_pixels(&rgba, |[r, g, b]| {
        let (max, min) = (r.max(g).max(b), r.min(g).min(b));
        max - min > 40
    });
    assert!(blancos > 100, "el texto debe ser blanco ({blancos})");
    assert_eq!(de_color, 0, "sin contorno ni sombra, todo el texto debe ser acromático");

    assert_golden("texto-centrado", &rgba, WIDTH, HEIGHT);
}

#[test]
fn golden_texto_contorno_sombra() {
    let scene = texto_contorno_sombra();
    let rgba = render_snapshot_rgba(&scene, WIDTH, HEIGHT).expect("render del snapshot");

    let blancos = count_pixels(&rgba, |[r, g, b]| r > 200 && g > 200 && b > 200);
    let rojos = count_pixels(&rgba, |[r, g, b]| r > 150 && g < 80 && b < 80);
    let azules = count_pixels(&rgba, |[r, g, b]| b > 150 && r < 80 && g < 80);
    assert!(blancos > 100, "debe haber texto blanco ({blancos})");
    assert!(rojos > 100, "debe haber contorno rojo ({rojos})");
    assert!(azules > 100, "debe haber sombra azul ({azules})");

    assert_golden("texto-contorno-sombra", &rgba, WIDTH, HEIGHT);
}

#[test]
fn golden_fondo_imagen() {
    let scene = fondo_imagen(&reference_background());
    let rgba = render_snapshot_rgba(&scene, WIDTH, HEIGHT).expect("render del snapshot");

    // Con `fit: "fill"` la imagen estirada ocupa toda la salida: el centro de cada
    // cuadrante debe conservar su color.
    assert_color_near(pixel_at(&rgba, WIDTH, 160, 90), [255, 0, 0], "cuadrante rojo");
    assert_color_near(pixel_at(&rgba, WIDTH, 480, 90), [0, 255, 0], "cuadrante verde");
    assert_color_near(pixel_at(&rgba, WIDTH, 160, 270), [0, 0, 255], "cuadrante azul");
    assert_color_near(pixel_at(&rgba, WIDTH, 480, 270), [255, 255, 255], "cuadrante blanco");

    assert_golden("fondo-imagen", &rgba, WIDTH, HEIGHT);
}

/// F4.5: un item de medio se dibuja en su caja (no cubre toda la salida) y, con
/// `fit: "fill"`, estira la imagen al rect.
#[test]
fn golden_item_imagen() {
    let scene = item_imagen(&reference_background());
    let rgba = render_snapshot_rgba(&scene, WIDTH, HEIGHT).expect("render del snapshot");

    // Caja x: 160..480, y: 90..270 → cada cuadrante conserva su color en su centro.
    assert_color_near(pixel_at(&rgba, WIDTH, 240, 135), [255, 0, 0], "item rojo");
    assert_color_near(pixel_at(&rgba, WIDTH, 400, 135), [0, 255, 0], "item verde");
    assert_color_near(pixel_at(&rgba, WIDTH, 240, 225), [0, 0, 255], "item azul");
    assert_color_near(pixel_at(&rgba, WIDTH, 400, 225), [255, 255, 255], "item blanco");

    // Fuera de la caja sigue el fondo negro del render.
    assert_eq!(pixel_at(&rgba, WIDTH, 20, 20), [0, 0, 0], "esquina sin item");
    assert_eq!(pixel_at(&rgba, WIDTH, 620, 340), [0, 0, 0], "esquina opuesta sin item");

    assert_golden("item-imagen", &rgba, WIDTH, HEIGHT);
}

/// F4.6: los overlays (imagen y texto) se dibujan encima de la slide.
#[test]
fn golden_overlays() {
    let scene = overlays(&reference_background());
    let rgba = render_snapshot_rgba(&scene, WIDTH, HEIGHT).expect("render del snapshot");

    // texto de la slide (blanco) presente
    let blancos = count_pixels(&rgba, |[r, g, b]| r > 200 && g > 200 && b > 200);
    assert!(blancos > 50, "debe haber texto de slide ({blancos})");

    // imagen del overlay en su caja (cuadrante rojo)
    assert_color_near(pixel_at(&rgba, WIDTH, 240, 135), [255, 0, 0], "overlay rojo");

    // texto del overlay (amarillo) presente
    let amarillos = count_pixels(&rgba, |[r, g, b]| r > 200 && g > 200 && b < 80);
    assert!(amarillos > 20, "debe haber texto de overlay amarillo ({amarillos})");

    assert_golden("overlays", &rgba, WIDTH, HEIGHT);
}
