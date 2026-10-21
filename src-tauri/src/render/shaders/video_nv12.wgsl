// Video NV12 (planos Y y CbCr) convertido a RGB en la GPU. Se concatena con
// `layer_common.wgsl` (uniforms, vértices y ajuste de aspecto).

@group(1) @binding(0)
var y_texture: texture_2d<f32>;

@group(1) @binding(1)
var uv_texture: texture_2d<f32>;

@group(1) @binding(2)
var video_sampler: sampler;

// YCbCr -> RGB según la matriz y el rango (limitado 16–235 / 16–240, o completo).
fn yuv_to_rgb(y_raw: f32, cb_raw: f32, cr_raw: f32) -> vec3<f32> {
    var y = y_raw;
    var cb = cb_raw - 128.0 / 255.0;
    var cr = cr_raw - 128.0 / 255.0;
    if (layer_uniforms.color.y == 0u) {
        y = (y_raw * 255.0 - 16.0) / 219.0;
        cb = (cb_raw * 255.0 - 128.0) / 224.0;
        cr = (cr_raw * 255.0 - 128.0) / 224.0;
    }

    var rgb: vec3<f32>;
    if (layer_uniforms.color.x == 0u) {
        // BT.601
        rgb = vec3<f32>(y + 1.402 * cr, y - 0.344136 * cb - 0.714136 * cr, y + 1.772 * cb);
    } else if (layer_uniforms.color.x == 1u) {
        // BT.709
        rgb = vec3<f32>(y + 1.5748 * cr, y - 0.187324 * cb - 0.468124 * cr, y + 1.8556 * cb);
    } else {
        // BT.2020
        rgb = vec3<f32>(y + 1.4746 * cr, y - 0.164553 * cb - 0.571353 * cr, y + 1.8814 * cb);
    }
    return clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: QuadVertexOutput) -> @location(0) vec4<f32> {
    let mapped = map_uv(in.uv);
    if (!mapped.visible) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    let y = textureSample(y_texture, video_sampler, mapped.uv).r;
    let cbcr = textureSample(uv_texture, video_sampler, mapped.uv).rg;
    return vec4<f32>(yuv_to_rgb(y, cbcr.x, cbcr.y), layer_uniforms.opacity);
}
