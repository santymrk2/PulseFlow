// PulseFlow GPU Transition Shader (WGSL)
// Implementa transiciones de hardware libres de tirones a 60 fps:
// - Crossfade suave
// - Dip to Black
// - Wipe (Borrido geométrico)
// - Push (Desplazamiento)
// - Curvas de aceleración (Easing) por hardware

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct TransitionUniforms {
    progress: f32,          // 0.0 a 1.0
    transition_type: u32,   // 0 = None, 1 = Crossfade, 2 = DipToBlack, 3 = WipeLeft, 4 = WipeRight, 5 = PushLeft, 6 = PushRight
    easing: u32,            // 0 = Linear, 1 = EaseInOut, 2 = EaseOut
    _pad: u32,
};

@group(0) @binding(0)
var<uniform> uniforms: TransitionUniforms;

@group(0) @binding(1)
var texture_a: texture_2d<f32>;

@group(0) @binding(2)
var texture_b: texture_2d<f32>;

@group(0) @binding(3)
var trans_sampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
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
    out.uv = vec2<f32>((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5);
    return out;
}

// Calcula la curva de aceleración (easing)
fn apply_easing(t: f32, mode: u32) -> f32 {
    let clamped = clamp(t, 0.0, 1.0);
    if (mode == 1u) {
        // Ease In-Out (Smoothstep hermite)
        return clamped * clamped * (3.0 - 2.0 * clamped);
    } else if (mode == 2u) {
        // Ease Out
        let inv = 1.0 - clamped;
        return 1.0 - inv * inv;
    }
    // Linear
    return clamped;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let p = apply_easing(uniforms.progress, uniforms.easing);

    // Tipo 0: Corte directo (Cut / None)
    if (uniforms.transition_type == 0u || p >= 1.0) {
        return textureSample(texture_b, trans_sampler, uv);
    }
    if (p <= 0.0) {
        return textureSample(texture_a, trans_sampler, uv);
    }

    // Tipo 1: Crossfade Suave
    if (uniforms.transition_type == 1u) {
        let col_a = textureSample(texture_a, trans_sampler, uv);
        let col_b = textureSample(texture_b, trans_sampler, uv);
        return mix(col_a, col_b, p);
    }

    // Tipo 2: Dip to Black (Desvanecimiento a negro y apertura)
    if (uniforms.transition_type == 2u) {
        if (p < 0.5) {
            let fade = 1.0 - p * 2.0;
            let col = textureSample(texture_a, trans_sampler, uv);
            return vec4<f32>(col.rgb * fade, col.a);
        } else {
            let fade = (p - 0.5) * 2.0;
            let col = textureSample(texture_b, trans_sampler, uv);
            return vec4<f32>(col.rgb * fade, col.a);
        }
    }

    // Tipo 3: Wipe Left (Borrido hacia la izquierda)
    if (uniforms.transition_type == 3u) {
        if (uv.x < (1.0 - p)) {
            return textureSample(texture_a, trans_sampler, uv);
        } else {
            return textureSample(texture_b, trans_sampler, uv);
        }
    }

    // Tipo 4: Wipe Right (Borrido hacia la derecha)
    if (uniforms.transition_type == 4u) {
        if (uv.x > p) {
            return textureSample(texture_a, trans_sampler, uv);
        } else {
            return textureSample(texture_b, trans_sampler, uv);
        }
    }

    // Tipo 5: Push Left (Desplazamiento hacia la izquierda)
    if (uniforms.transition_type == 5u) {
        let uv_a = uv + vec2<f32>(p, 0.0);
        let uv_b = uv - vec2<f32>(1.0 - p, 0.0);

        if (uv_a.x <= 1.0) {
            return textureSample(texture_a, trans_sampler, uv_a);
        } else {
            return textureSample(texture_b, trans_sampler, uv_b);
        }
    }

    // Tipo 6: Push Right (Desplazamiento hacia la derecha)
    if (uniforms.transition_type == 6u) {
        let uv_a = uv - vec2<f32>(p, 0.0);
        let uv_b = uv + vec2<f32>(1.0 - p, 0.0);

        if (uv_a.x >= 0.0) {
            return textureSample(texture_a, trans_sampler, uv_a);
        } else {
            return textureSample(texture_b, trans_sampler, uv_b);
        }
    }

    return textureSample(texture_b, trans_sampler, uv);
}
