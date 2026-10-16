// PulseFlow GPU Composition Shader (WGSL)
// Dibuja capas de fondo (imagen/video) y overlays con escalado, relación de aspecto y opacidad.

struct QuadVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct LayerUniforms {
    opacity: f32,
    aspect_mode: u32, // 0 = Cover, 1 = Contain, 2 = Stretch
    screen_ratio: f32,
    media_ratio: f32,
};

@group(0) @binding(0)
var<uniform> layer_uniforms: LayerUniforms;

@group(0) @binding(1)
var media_texture: texture_2d<f32>;

@group(0) @binding(2)
var media_sampler: sampler;

// Fullscreen Quad generado por índice de vértice sin vertex buffer (0, 1, 2, 3, 4, 5)
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> QuadVertexOutput {
    var out: QuadVertexOutput;
    
    // Genera 2 triángulos que cubren [-1, 1] en X e Y
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );

    let p = pos[vertex_index];
    out.position = vec4<f32>(p, 0.0, 1.0);
    // UVs van de 0.0 a 1.0 (en Y invertido para espacio de textura de GPU)
    out.uv = vec2<f32>((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5);
    return out;
}

@fragment
fn fs_main(in: QuadVertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;

    // Ajuste de relación de aspecto (Cover o Contain)
    if (layer_uniforms.aspect_mode == 0u) {
        // Cover: llena toda la pantalla recortando exceso
        if (layer_uniforms.media_ratio > layer_uniforms.screen_ratio) {
            let scale = layer_uniforms.screen_ratio / layer_uniforms.media_ratio;
            uv.x = (uv.x - 0.5) * scale + 0.5;
        } else {
            let scale = layer_uniforms.media_ratio / layer_uniforms.screen_ratio;
            uv.y = (uv.y - 0.5) * scale + 0.5;
        }
    } else if (layer_uniforms.aspect_mode == 1u) {
        // Contain: ajusta dentro de la pantalla sin recortar
        if (layer_uniforms.media_ratio > layer_uniforms.screen_ratio) {
            let scale = layer_uniforms.media_ratio / layer_uniforms.screen_ratio;
            uv.y = (uv.y - 0.5) * scale + 0.5;
            if (uv.y < 0.0 || uv.y > 1.0) {
                return vec4<f32>(0.0, 0.0, 0.0, 1.0);
            }
        } else {
            let scale = layer_uniforms.screen_ratio / layer_uniforms.media_ratio;
            uv.x = (uv.x - 0.5) * scale + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0) {
                return vec4<f32>(0.0, 0.0, 0.0, 1.0);
            }
        }
    }

    let color = textureSample(media_texture, media_sampler, uv);
    return vec4<f32>(color.rgb, color.a * layer_uniforms.opacity);
}
