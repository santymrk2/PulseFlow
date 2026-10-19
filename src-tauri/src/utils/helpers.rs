//! Helpers transversales (`src/electron/utils/helpers.ts`).

use std::collections::HashMap;

/// Compara si dos objetos JSON (o valores) son equivalentes ordenando entradas.
///
/// Equivale a `checkIfMatching` en TS: compara serialización de entries ordenados.
pub fn check_if_matching(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    try_eq(a, b)
}

fn try_eq(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    match (a, b) {
        (serde_json::Value::Object(oa), serde_json::Value::Object(ob)) => {
            let mut ha: HashMap<String, String> = HashMap::new();
            let mut hb: HashMap<String, String> = HashMap::new();
            for (k, v) in oa.iter() {
                ha.insert(k.clone(), serde_json::to_string(v).unwrap_or_default());
            }
            for (k, v) in ob.iter() {
                hb.insert(k.clone(), serde_json::to_string(v).unwrap_or_default());
            }
            ha == hb
        }
        _ => {
            serde_json::to_string(a).unwrap_or_default()
                == serde_json::to_string(b).unwrap_or_default()
        }
    }
}

/// Espera `ms` milisegundos.
pub async fn wait(ms: u64) {
    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
}

/// Devuelve un ID de máquina simple (fallback). No usa node-machine-id todavía
/// (se puede migrar más adelante a `machine-uid`).
pub fn get_machine_id() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .map(|s| s.hash(&mut hasher))
        .or_else(|| {
            std::env::var("USER").ok().map(|s| s.hash(&mut hasher));
            None
        });
    let host = hasher.finish();

    let pid = std::process::id();
    format!("tauri-{host:x}-{pid:x}")
}
