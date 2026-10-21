<p align='center'>
  <img src='docs/brand/logo-pulseflow.png' width=150 alt='PulseFlow' />
</p>

<h1 align='center'>PulseFlow</h1>

<p align='center'>
  Presentation software for live services and events, with a native GPU render engine for the outputs.
</p>

<p align='center'>
  <a href="https://github.com/santymrk2/PulseFlow/releases"><img alt="Releases" src="https://img.shields.io/github/v/release/santymrk2/PulseFlow?include_prereleases&style=for-the-badge" /></a>
  &nbsp;
  <a href="LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL-blue.svg?style=for-the-badge" /></a>
</p>
<br />

## What is PulseFlow

PulseFlow is a desktop app to put text, media and video on a big screen. The control UI is built with Svelte 5 and the backend with Tauri v2 / Rust. Every output (audience screens and stage displays) is drawn by a native WGPU render engine; there is no web output.

- Libraries, playlists and items in a single left panel.
- Multiple outputs and stage displays, each with its own resolution and aspect ratio.
- Native video decoding (zero-copy on macOS), text effects and transitions on the GPU.
- Remote control and stage display over the local network.
- Importers for many formats (FreeShow, OpenLP, ProPresenter, EasySlides, OSIS Bibles and more).

PulseFlow runs on macOS (Apple Silicon and Intel) and Windows 10/11 (x64) only.

## Install

Download the latest installer from the [Releases page](https://github.com/santymrk2/PulseFlow/releases).

## Development

1. Clone this repo
2. Install [Bun](https://bun.sh/) (the only package manager used here)
3. On Windows, install [Visual Studio](https://visualstudio.microsoft.com/downloads/) with "Desktop development with C++" and the "Windows 10 SDK"
4. `bun install`
5. `bun run setup:sidecars --only-host` (once)
6. `bun run dev:tauri` (frontend only: `bun run dev`)

Tests: `bun run test:unit`, `bun run test:svelte`, and `cd src-tauri && cargo test --lib`. The work plan lives in [`docs/ROADMAP.md`](docs/ROADMAP.md); agent rules in [`AGENTS.md`](AGENTS.md).

## Report an issue or request a feature

Open an [issue on GitHub](https://github.com/santymrk2/PulseFlow/issues).

## Packaging, signing and notarization

PulseFlow is built with `bun run build:tauri` (Tauri v2). Bundles are limited to `.app`/`.dmg` on macOS and NSIS on Windows (see `src-tauri/tauri.conf.json`).

### macOS

- Privacy permissions live in `src-tauri/Info.plist` (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSScreenCaptureUsageDescription`) and are merged into the `.app` automatically.
- Hardened-runtime entitlements (JIT, camera, microphone) live in `src-tauri/Entitlements.plist` (`bundle.macOS.entitlements`).
- To code sign and notarize, set these environment variables before `bun run build:tauri`:
  - `APPLE_SIGNING_IDENTITY`: `Developer ID Application: <name> (<team id>)`
  - `APPLE_ID` + `APPLE_PASSWORD` (app-specific password) + `APPLE_TEAM_ID`: enable notarization and stapling.
- Without those variables the build is ad-hoc signed (fine for local testing, not for distribution).

### Windows

- To Authenticode-sign the NSIS installer, configure `bundle.windows.signCommand` in `src-tauri/tauri.conf.json` pointing to your signing tool (e.g. `signtool.exe sign /fd SHA256 /tr http://timestamp.digicert.com {exe}`) and provide the certificate through your tool of choice.
- The WebView2 runtime is installed via `downloadBootstrapper` when missing.

## Origin and licence

PulseFlow is a fork of [FreeShow](https://github.com/ChurchApps/FreeShow) by ChurchApps and contributors, and keeps its GPL licence. Thanks to the FreeShow community for the foundation this project builds on.
