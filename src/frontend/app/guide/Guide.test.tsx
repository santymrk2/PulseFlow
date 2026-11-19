// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
    function writable<T>(value: T) {
        const subs = new Set<(v: T) => void>()
        return {
            subscribe(run: (v: T) => void) {
                run(value)
                subs.add(run)
                return () => subs.delete(run)
            },
            set(v: T) {
                value = v
                subs.forEach((fn) => fn(value))
            },
            update(fn: (v: T) => T) {
                value = fn(value)
                subs.forEach((sub) => sub(value))
            }
        }
    }
    const defaults: Record<string, any> = {
        guideActive: writable(false),
        os: writable({ platform: "darwin" as const }),
        playingVideos: writable([]),
        audioFolders: writable([]),
        mediaFolders: writable([])
    }
    return new Proxy(defaults, {
        get(target, prop: string) {
            if (!(prop in target)) target[prop] = writable(undefined)
            return target[prop]
        }
    })
})

vi.mock("../../shared/core/stores", () => mocks)
vi.mock("./logic/guideSteps", () => ({ guideSteps: [] }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/common", () => ({ wait: async () => {} }))

import { Guide } from "./Guide"

describe("Guide", () => {
    afterEach(() => cleanup())

    it("no renderiza nada cuando la guía está inactiva", () => {
        const { container } = render(<Guide />)
        expect(container.firstChild).toBeNull()
    })
})
