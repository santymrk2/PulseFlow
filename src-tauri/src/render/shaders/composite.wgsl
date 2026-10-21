// Composición de la capa de fondo y de los items de medio (imagen) del engine.
// Se concatena con `layer_common.wgsl` (uniforms, vértices y ajuste de aspecto).

@group(1) @binding(0)
var media_texture: texture_2d<f32>;

@group(1) @binding(1)
var media_sampler: sampler;

@fragment
fn fs_main(in: QuadVertexOutput) -> @location(0) vec4<f32> {
    let mapped = map_uv(in.uv);
    if (!mapped.visible) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    let color = textureSample(media_texture, media_sampler, mapped.uv);
    return vec4<f32>(color.rgb, color.a * layer_uniforms.opacity);
}
