import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { createRawSnippet, mount, unmount } from "svelte"
import { createSvelteProps } from "./svelteProps.svelte"

type SvelteMountable = Parameters<typeof mount>[0]

export interface SvelteIslandProps {
    component: SvelteMountable
    props?: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
    // Slots de componentes legacy: `default` → <slot />, el resto → <slot name="x" />. Los children React se envían al
    // placeholder del snippet con createPortal, así los gestiona la raíz React padre (sin raíces anidadas).
    slots?: Record<string, ReactNode>
}

interface MountedIsland {
    instance: ReturnType<typeof mount>
    props: Record<string, unknown>
}

// Isla Svelte dentro de React (F24.4). `events` se toma al montar: los handlers de los padres de hoy no cambian.
export function SvelteIsland({ component, props = {}, events, slots = {} }: SvelteIslandProps) {
    const host = useRef<HTMLDivElement>(null)
    const mounted = useRef<MountedIsland | null>(null)
    const [slotElements, setSlotElements] = useState<Record<string, Element>>({})

    useEffect(() => {
        if (!host.current) return
        const placeholders: Record<string, Element> = {}
        setSlotElements({})
        const toSnippet = (name: string) =>
            createRawSnippet(() => ({
                // Los slots Svelte no agregan wrapper: el placeholder debe ser transparente al layout.
                render: () => `<div data-react-slot="${name}" style="display: contents"></div>`,
                setup: (element) => {
                    placeholders[name] = element
                    setSlotElements({ ...placeholders })
                }
            }))
        const slotProps = Object.fromEntries(Object.keys(slots).map((name) => [name === "default" ? "children" : name, toSnippet(name)]))
        const $$slots = Object.fromEntries(Object.keys(slots).map((name) => [name, true]))
        const reactiveProps = createSvelteProps({ ...props, ...slotProps, $$slots })
        const instance = mount(component, { target: host.current, props: reactiveProps, events })
        mounted.current = { instance, props: reactiveProps }
        return () => {
            unmount(instance)
            mounted.current = null
        }
        // Los snippets (y sus placeholders) se crean al montar; el contenido de cada slot se actualiza solo vía portal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [component])

    useEffect(() => {
        if (!mounted.current) return
        Object.assign(mounted.current.props, props)
    })

    return (
        <div ref={host} style={{ display: "contents" }}>
            {Object.entries(slots).map(([name, content]) => (slotElements[name] ? <FragmentPortal key={name} container={slotElements[name]} content={content} /> : null))}
        </div>
    )
}

function FragmentPortal({ container, content }: { container: Element; content: ReactNode }) {
    return createPortal(content, container)
}
