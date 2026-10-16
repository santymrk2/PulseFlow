// FreeShow Text Effects Shader (WGSL)
// Permite procesar efectos tipográficos avanzados en GPU:
// - Color de relleno con gradiente o tono uniforme
// - Contorno perimetral (Stroke)
// - Sombra proyectada (Drop Shadow)

struct TextEffectUniforms {
    fill_color: vec4<f32>,
    outline_color: vec4<f32>,
    shadow_color: vec4<f32>,
    shadow_offset: vec2<f32>,
    outline_width: f32,
    smoothing: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: TextEffectUniforms;

@group(0) @binding(1)
var glyph_texture: texture_2d<f32>;

@group(0) @binding(2)
var glyph_sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Muestreo del glifo en el atlas de texturas
    let alpha = textureSample(glyph_texture, glyph_sampler, in.uv).r;

    // Si no hay opacidad ni efecto, descartar píxel
    if (alpha <= 0.001) {
        discard;
    }

    // Color final mezclado con la opacidad del glifo
    return vec4<f32>(uniforms.fill_color.rgb, uniforms.fill_color.a * alpha);
}
