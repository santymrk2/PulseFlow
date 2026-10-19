// Composición de la capa de fondo y de los items de medio (imagen) del engine.
//
// El mismo pipeline sirve para las dos: el fondo es un rect que cubre toda la
// pantalla y un item es un rect en píxeles. `rect` va normalizado ([0,1], origen
// arriba-izquierda) y `target_ratio` es la relación de aspecto del rect destino
// (para el fondo coincide con la de la pantalla).

struct QuadVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

struct LayerUniforms {
    opacity: f32,
    aspect_mode: u32, // 0 = Cover, 1 = Contain, 2 = Stretch
    target_ratio: f32,
    media_ratio: f32,
    rect: vec4<f32>, // x, y, ancho, alto normalizados [0,1], origen arriba-izquierda
}

@group(0) @binding(0)
var<uniform> layer_uniforms: LayerUniforms;

@group(0) @binding(1)
var media_texture: texture_2d<f32>;

@group(0) @binding(2)
var media_sampler: sampler;

// Quad generado por índice de vértice sin vertex buffer (0, 1, 2, 3, 4, 5).
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> QuadVertexOutput {
    var out: QuadVertexOutput;

    // Esquinas del rect en [0, 1]: (0, 0) es arriba-izquierda.
    var unit = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0)
    );

    let c = unit[vertex_index];
    let n = layer_uniforms.rect.xy + c * layer_uniforms.rect.zw;
    // Normalizado (y hacia abajo) a espacio de recorte.
    out.position = vec4<f32>(n.x * 2.0 - 1.0, 1.0 - n.y * 2.0, 0.0, 1.0);
    out.uv = c;
    return out;
}

@fragment
fn fs_main(in: QuadVertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;

    // Ajuste de relación de aspecto (Cover o Contain) contra el rect destino.
    if (layer_uniforms.aspect_mode == 0u) {
        // Cover: llena todo el rect recortando exceso
        if (layer_uniforms.media_ratio > layer_uniforms.target_ratio) {
            let scale = layer_uniforms.target_ratio / layer_uniforms.media_ratio;
            uv.x = (uv.x - 0.5) * scale + 0.5;
        } else {
            let scale = layer_uniforms.media_ratio / layer_uniforms.target_ratio;
            uv.y = (uv.y - 0.5) * scale + 0.5;
        }
    } else if (layer_uniforms.aspect_mode == 1u) {
        // Contain: ajusta dentro del rect sin recortar; lo que sobra no se pinta.
        if (layer_uniforms.media_ratio > layer_uniforms.target_ratio) {
            let scale = layer_uniforms.media_ratio / layer_uniforms.target_ratio;
            uv.y = (uv.y - 0.5) * scale + 0.5;
            if (uv.y < 0.0 || uv.y > 1.0) {
                return vec4<f32>(0.0, 0.0, 0.0, 0.0);
            }
        } else {
            let scale = layer_uniforms.target_ratio / layer_uniforms.media_ratio;
            uv.x = (uv.x - 0.5) * scale + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0) {
                return vec4<f32>(0.0, 0.0, 0.0, 0.0);
            }
        }
    }

    let color = textureSample(media_texture, media_sampler, uv);
    return vec4<f32>(color.rgb, color.a * layer_uniforms.opacity);
}
