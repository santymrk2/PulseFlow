#!/usr/bin/env bun
"use strict"

/**
 * setup-sidecars.js
 *
 * Prepara los binarios estáticos de FFmpeg/FFprobe como *sidecars* de Tauri.
 *
 * Pasos:
 *  1. Instala (si hace falta) `ffmpeg-static` y `ffprobe-static` como devDependencies.
 *  2. Crea `tauri-app/src-tauri/binaries/` si no existe.
 *  3. Localiza los binarios que aportan esos paquetes.
 *  4. Los copia a `binaries/` con el nombre que Tauri espera:
 *     `<nombre>-<target-triple>[.exe]`.
 *
 * Genera SIEMPRE el sidecar de la máquina actual y, además, la variante de
 * Windows (`x86_64-pc-windows-msvc.exe`) para compilaciones cruzadas:
 *  - ffprobe: se prefiere `@ffprobe-installer/<platform>-<arch>` (binario nativo
 *             real; evita el bug de ffprobe-static, cuyo `darwin/arm64` contiene
 *             un binario x86_64). Si el paquete no está disponible para esa
 *             plataforma (p. ej. cross-target a Windows), se cae a los binarios
 *             empaquetados en `ffprobe-static` (que sí incluye `win32/x64`).
 *  - ffmpeg:  `ffmpeg-static` solo trae el de la plataforma anfitriona, así que
 *             el de Windows se descarga del release oficial de ffmpeg-static
 *             (mismo origen que usa su `install.js`) y se descomprime (.gz).
 *
 * Uso:
 *   bun scripts/setup-sidecars.js            # host + Windows
 *   bun scripts/setup-sidecars.js --only-host
 */

const { execSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const ROOT = path.resolve(__dirname, "..")
const BINARIES_DIR = path.join(ROOT, "tauri-app", "src-tauri", "binaries")

const PACKAGES = ["ffmpeg-static", "ffprobe-static", "@ffprobe-installer/ffprobe"]

// Igual que `ffmpeg-static/package.json` -> `binary-release-tag`.
const FFMPEG_RELEASE = "b6.1.1"
const FFMPEG_BASE_URL = "https://github.com/eugeneware/ffmpeg-static/releases/download"

// `process.platform/arch` -> target triple de Rust.
const TRIPLES = {
    "darwin-arm64": "aarch64-apple-darwin",
    "darwin-x64": "x86_64-apple-darwin",
    "win32-x64": "x86_64-pc-windows-msvc",
    "win32-arm64": "aarch64-pc-windows-msvc",
    "linux-x64": "x86_64-unknown-linux-gnu",
    "linux-arm64": "aarch64-unknown-linux-gnu"
}

const WINDOWS_TARGET = {
    platform: "win32",
    arch: "x64",
    triple: "x86_64-pc-windows-msvc",
    ext: ".exe"
}

function log(msg) {
    console.log(`[sidecars] ${msg}`)
}

function ensurePackages() {
    const missing = PACKAGES.filter((name) => {
        try {
            require.resolve(name)
            return false
        } catch {
            return true
        }
    })
    if (missing.length === 0) return

    log(`Instalando dependencias: ${missing.join(", ")}`)
    execSync(`bun add --dev ${missing.join(" ")}`, { cwd: ROOT, stdio: "inherit" })
}

function packageRoot(name) {
    return path.dirname(require.resolve(name))
}

function hostTarget() {
    const key = `${process.platform}-${process.arch}`
    const triple = TRIPLES[key]
    if (!triple) throw new Error(`Plataforma no soportada: ${key}`)
    return {
        platform: process.platform,
        arch: process.arch,
        triple,
        ext: process.platform === "win32" ? ".exe" : ""
    }
}

function targets(onlyHost) {
    const host = hostTarget()
    const list = [host]
    const hostIsWindowsX64 = host.platform === "win32" && host.arch === "x64"
    if (!onlyHost && !hostIsWindowsX64) list.push(WINDOWS_TARGET)
    return list
}

function ffmpegHostPath() {
    const resolved = require("ffmpeg-static")
    return typeof resolved === "string" ? resolved : resolved && resolved.path
}

function ffprobeBundledPath(platform, arch) {
    const ext = platform === "win32" ? ".exe" : ""
    return path.join(packageRoot("ffprobe-static"), "bin", platform, arch, `ffprobe${ext}`)
}

/**
 * Devuelve la mejor fuente de `ffprobe` para una plataforma/arquitectura.
 *
 * Se prefiere `@ffprobe-installer/<platform>-<arch>` (binario nativo). Si el
 * paquete de esa plataforma no está instalado (p. ej. en compilaciones
 * cruzadas, porque los optionalDependencies solo instalan la del host), se usa
 * el binario empaquetado en `ffprobe-static`.
 */
function ffprobeSource(platform, arch) {
    const binaryName = platform === "win32" ? "ffprobe.exe" : "ffprobe"
    try {
        const candidate = require.resolve(`@ffprobe-installer/${platform}-${arch}/${binaryName}`)
        if (candidate && fs.existsSync(candidate)) return candidate
    } catch {
        // Paquete no instalado para esta plataforma: se usa el fallback.
    }
    return ffprobeBundledPath(platform, arch)
}

function copySidecar(src, base, triple, ext) {
    if (!src || !fs.existsSync(src)) throw new Error(`No se encontró el binario de origen: ${src}`)
    const destName = `${base}-${triple}${ext}`
    const dest = path.join(BINARIES_DIR, destName)
    fs.copyFileSync(src, dest)
    fs.chmodSync(dest, 0o755)
    log(`OK  ${destName}`)
}

async function downloadWindowsFfmpeg(destName) {
    const dest = path.join(BINARIES_DIR, destName)
    if (fs.existsSync(dest)) {
        log(`OK  ${destName} (ya existe)`)
        return
    }

    const url = `${FFMPEG_BASE_URL}/${FFMPEG_RELEASE}/ffmpeg-win32-x64.gz`
    log(`Descargando ${destName} desde ${url}`)
    const res = await fetch(url, { redirect: "follow" })
    if (!res.ok) throw new Error(`Fallo la descarga de ffmpeg Windows (HTTP ${res.status})`)

    const gunzipped = zlib.gunzipSync(Buffer.from(await res.arrayBuffer()))
    fs.writeFileSync(dest, gunzipped)
    fs.chmodSync(dest, 0o755)
    log(`OK  ${destName}`)
}

async function main() {
    const onlyHost = process.argv.includes("--only-host")
    const host = hostTarget()

    ensurePackages()

    fs.mkdirSync(BINARIES_DIR, { recursive: true })
    log(`Destino: ${BINARIES_DIR.replace(ROOT + path.sep, "")}`)
    log(`Plataforma anfitriona: ${host.platform}-${host.arch} (${host.triple})`)

    for (const target of targets(onlyHost)) {
        copySidecar(ffprobeSource(target.platform, target.arch), "ffprobe", target.triple, target.ext)

        const isHost = target.platform === host.platform && target.arch === host.arch
        if (isHost) {
            copySidecar(ffmpegHostPath(), "ffmpeg", target.triple, target.ext)
        } else if (target.platform === "win32" && target.arch === "x64") {
            await downloadWindowsFfmpeg(`ffmpeg-${target.triple}${target.ext}`)
        } else {
            log(`SKIP ffmpeg para ${target.triple}: solo disponible ejecutando el script en esa plataforma`)
        }
    }

    log("Listo: sidecars preparados.")
}

main().catch((err) => {
    console.error(`[sidecars] ERROR: ${err.message}`)
    process.exit(1)
})
