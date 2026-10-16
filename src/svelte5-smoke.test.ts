import { describe, expect, it } from "vitest"
import { render } from "svelte/server"
import Button from "./frontend/lib/components/ui/button/button.svelte"

// Smoke test: proves the Svelte 5 compiler + runtime actually render a
// component (SSR via `svelte/server`) and that shadcn utility classes are
// applied through tailwind-variants + `cn` ($lib alias resolution).
describe("Svelte 5 runtime", () => {
    it("renders the shadcn Button to HTML", () => {
        const { html } = render(Button, { props: {} })

        expect(html).toContain('data-slot="button"')
        expect(html).toContain("bg-primary")
        expect(html).toContain("text-primary-foreground")
    })

    it("applies variant and size classes", () => {
        const { html } = render(Button, { props: { variant: "outline", size: "lg" } })

        expect(html).toContain("border-input")
        expect(html).toContain("h-10")
    })
})
