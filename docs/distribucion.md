# Distribución: firma y actualizaciones

Estado al 2026-10-21. El flujo está **preparado pero inerte**: sin los secretos de abajo, `build.yml` produce los
mismos instaladores sin firmar que antes. Nada de esto se pudo probar: necesita tus cuentas.

## Release automático (F22.14)

`.github/workflows/release.yml` corre en cada push a `main` (o a mano):

1. Lee `version` de `src-tauri/tauri.conf.json` y mira si ya existe el release `v<versión>`.
2. Si **no** existe, llama a `build.yml` (macOS Apple Silicon, macOS Intel y Windows x64; con firma si están los
   secretos de abajo) y publica `v<versión>` en GitHub Releases con los `.dmg` y los `.exe` de NSIS adjuntos
   (marcado como pre-release si la versión lleva `-beta`, `-rc`, etc.).
3. Si ya existe, no hace nada y deja un aviso: **para sacar una versión nueva hay que subir `version`** en
   `tauri.conf.json` antes de mergear. Así la etiqueta coincide con la versión que ve la app (el chequeo de
   actualizaciones compara contra los releases de `santymrk2/PulseFlow`).

Sin los secretos de firma, los instaladores salen sin firmar (Gatekeeper y SmartScreen van a avisar).
**No se pudo probar**: el workflow nunca corrió.

## Firma (F16.1)

`.github/workflows/build.yml` detecta los secretos y, si existen, firma. Se configuran en
GitHub → Settings → Secrets and variables → Actions.

### macOS (Developer ID + notarización)

| Secreto | Qué es |
| --- | --- |
| `APPLE_CERTIFICATE` | Certificado "Developer ID Application" exportado como `.p12` en base64 (`base64 -i cert.p12`). |
| `APPLE_CERTIFICATE_PASSWORD` | Contraseña del `.p12`. |
| `APPLE_SIGNING_IDENTITY` | Nombre de la identidad, p. ej. `Developer ID Application: Tu Nombre (TEAMID)`. |
| `APPLE_ID` | Apple ID usado para notarizar. |
| `APPLE_PASSWORD` | Contraseña de aplicación (appleid.apple.com → Seguridad) del `APPLE_ID`. |
| `APPLE_TEAM_ID` | Team ID de 10 caracteres. |

Criterio de aceptación: el `.dmg` abre sin aviso de Gatekeeper.

### Windows (Azure Trusted Signing)

| Secreto | Qué es |
| --- | --- |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | Credenciales de la app registrada en Entra ID con el rol de firmante. |
| `AZURE_SIGNING_ENDPOINT` | Endpoint regional de Trusted Signing. |
| `AZURE_SIGNING_ACCOUNT` | Nombre de la cuenta de firma. |
| `AZURE_SIGNING_PROFILE` | Nombre del perfil de certificado. |

El build instala `trusted-signing-cli` y firma con `bundle.windows.signCommand` (por `TAURI_CONFIG`, sin tocar
`tauri.conf.json`). Si preferís un certificado propio, se reemplaza ese paso por `certificateThumbprint`.
Criterio de aceptación: el instalador NSIS no muestra SmartScreen "editor desconocido".

## Actualizaciones (F16.2) — no iniciado

Depende de F16.1 y de decisiones que son tuyas, por eso no se tocó:

1. Generar el par de claves del updater (`bunx tauri signer generate`): la **clave privada** queda en un secreto
   (`TAURI_SIGNING_PRIVATE_KEY`) y la pública en `tauri.conf.json` (`plugins.updater.pubkey`). No se genera acá
   para no dejar una clave en el repo ni en un historial.
2. Agregar `tauri-plugin-updater` y su permiso, y apuntar `plugins.updater.endpoints` al `latest.json` de GitHub Releases.
3. Que el workflow suba el manifiesto firmado junto con los instaladores.

Criterio de aceptación: una versión instalada detecta la siguiente y se actualiza en macOS y Windows.
