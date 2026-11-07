// Caja redondeada con borde (F23.16). `rect` va normalizado ([0,1], origen arriba-izquierda); el
// fragment trabaja en píxeles locales de la caja, así no depende del viewport ni de su desplazamiento.

struct ShapeUniforms {
    rect: vec4<f32>,   // x, y, ancho, alto normalizados
    fill: vec4<f32>,   // RGBA (ya en el espacio de la superficie)
    border: vec4<f32>, // RGBA
    params: vec4<f32>, // ancho px, alto px, grosor del borde px, radio px
    _pad: array<vec4<f32>, 2>,
}

@group(0) @binding(0)
var<uniform> shape: ShapeUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>, // píxeles desde la esquina arriba-izquierda de la caja
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var unit = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0)
    );
    let c = unit[vertex_index];
    let n = shape.rect.xy + c * shape.rect.zw;
    var out: VertexOutput;
    out.position = vec4<f32>(n.x * 2.0 - 1.0, 1.0 - n.y * 2.0, 0.0, 1.0);
    out.local = c * shape.params.xy;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let b = shape.params.xy * 0.5;
    let border_width = shape.params.z;
    let r = min(shape.params.w, min(b.x, b.y));
    let p = in.local - b;
    let q = abs(p) - b + vec2<f32>(r, r);
    let d = length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - r;
    let outer = clamp(0.5 - d, 0.0, 1.0);
    let inner = clamp(0.5 - (d + border_width), 0.0, 1.0);
    let color = mix(shape.border, shape.fill, inner);
    return vec4<f32>(color.rgb, color.a * outer);
}
