// Video NV12 (planos Y y CbCr) convertido a RGB en la GPU. Se concatena con
// `layer_common.wgsl` (uniforms, vértices y ajuste de aspecto).
//
// La conversión YCbCr→RGB no tiene ninguna rama: la matriz y el offset llegan
// precalculados en los uniforms (`yuv_matrix`, `yuv_offset`). Un `if` por píxel
// obligaría a la GPU a evaluar varias rutas en paralelo (divergencia de warp).

@group(1) @binding(0)
var y_texture: texture_2d<f32>;

@group(1) @binding(1)
var uv_texture: texture_2d<f32>;

@group(1) @binding(2)
var video_sampler: sampler;

@fragment
fn fs_main(in: QuadVertexOutput) -> @location(0) vec4<f32> {
    let mapped = map_uv(in.uv);
    if (!mapped.visible) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    let y = textureSample(y_texture, video_sampler, mapped.uv).r;
    let cbcr = textureSample(uv_texture, video_sampler, mapped.uv).rg;

    // (Y, Cb, Cr) normalizados: se les resta el offset y se multiplica por la matriz.
    let yuv = vec3<f32>(y, cbcr.x, cbcr.y) - layer_uniforms.yuv_offset.xyz;
    let rgb = clamp(layer_uniforms.yuv_matrix * yuv, vec3<f32>(0.0), vec3<f32>(1.0));

    return vec4<f32>(rgb, layer_uniforms.opacity);
}
