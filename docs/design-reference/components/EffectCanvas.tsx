// ----- FreeShow -----
// Capa de efectos animados sobre la salida. Un `<canvas>` por efecto activo con
// un pequeño motor de partículas (lluvia, nieve, estrellas, burbujas, confeti).

import { useEffect, useRef } from "react"
import { useEffectsStore } from "@/store/useEffectsStore"
import type { Effect } from "@/lib/effects"

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    alpha: number
    phase: number
    rotation: number
    spin: number
}

function createParticles(effect: Effect, width: number, height: number): Particle[] {
    return Array.from({ length: effect.quantity }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.2 + Math.random() * 0.8,
        size: 1 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.1,
    }))
}

function step(effect: Effect, p: Particle, width: number, height: number, delta: number) {
    const speed = effect.speed
    switch (effect.type) {
        case "rain":
            p.y += p.vy * 14 * speed * delta
            p.x += p.vx * 2 * delta
            break
        case "snow":
            p.phase += 0.02 * delta
            p.y += p.vy * 2 * speed * delta
            p.x += Math.sin(p.phase) * 0.6 * speed * delta
            break
        case "stars":
            p.phase += 0.05 * delta
            p.alpha = 0.2 + (Math.sin(p.phase) * 0.5 + 0.5) * 0.8
            p.y += p.vy * 0.15 * speed * delta
            break
        case "bubbles":
            p.phase += 0.03 * delta
            p.y -= p.vy * 2.4 * speed * delta
            p.x += Math.sin(p.phase) * 0.8 * speed * delta
            break
        case "confetti":
            p.y += p.vy * 4 * speed * delta
            p.x += p.vx * 3 * delta
            p.rotation += p.spin * delta
            break
    }

    if (p.y > height + 8) {
        p.y = -10
        p.x = Math.random() * width
    }
    if (p.y < -10) p.y = height + 10
    if (p.x < -10) p.x = width + 10
    if (p.x > width + 10) p.x = -10
}

function draw(ctx: CanvasRenderingContext2D, effect: Effect, p: Particle) {
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = effect.color
    switch (effect.type) {
        case "rain": {
            ctx.fillRect(p.x, p.y, Math.max(1, p.size * 0.4), p.size * 6)
            break
        }
        case "stars": {
            ctx.beginPath()
            ctx.arc(p.x, p.y, Math.max(0.6, p.size * 0.6), 0, Math.PI * 2)
            ctx.fill()
            break
        }
        case "confetti": {
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)
            ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size)
            ctx.restore()
            break
        }
        case "bubbles": {
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2)
            ctx.strokeStyle = effect.color
            ctx.lineWidth = 1
            ctx.stroke()
            break
        }
        default: {
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    ctx.globalAlpha = 1
}

function EffectLayer({ effect }: { effect: Effect }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let width = 0
        let height = 0
        let particles: Particle[] = []
        let raf = 0
        let lastTime = performance.now()

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            width = canvas.width = Math.max(1, Math.floor(rect.width))
            height = canvas.height = Math.max(1, Math.floor(rect.height))
            particles = createParticles(effect, width, height)
        }

        const observer = new ResizeObserver(resize)
        observer.observe(canvas)
        resize()

        const render = (time: number) => {
            const delta = Math.min(3, (time - lastTime) / 16.67)
            lastTime = time
            ctx.clearRect(0, 0, width, height)
            for (const particle of particles) {
                step(effect, particle, width, height, delta)
                draw(ctx, effect, particle)
            }
            raf = requestAnimationFrame(render)
        }
        raf = requestAnimationFrame(render)

        return () => {
            cancelAnimationFrame(raf)
            observer.disconnect()
        }
    }, [effect])

    return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
}

export default function EffectCanvas({ className }: { className?: string }) {
    const effects = useEffectsStore((s) => s.effects)
    const active = useEffectsStore((s) => s.active)

    const layers = active.map((id) => effects[id]).filter(Boolean)
    if (layers.length === 0) return null

    return (
        <div className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
            {layers.map((effect) => (
                <EffectLayer key={effect.id} effect={effect} />
            ))}
        </div>
    )
}
