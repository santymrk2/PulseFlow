import { useEffect, useRef } from "react"
import { mount, unmount } from "svelte"
import { createSvelteProps } from "./svelteProps.svelte"

type SvelteMountable = Parameters<typeof mount>[0]

export interface SvelteIslandProps {
    component: SvelteMountable
    props?: Record<string, unknown>
    events?: Record<string, (event: CustomEvent) => void>
}

interface MountedIsland {
    instance: ReturnType<typeof mount>
    props: Record<string, unknown>
}

// Isla Svelte dentro de React (F24.4). `events` se toma al montar: los handlers de los padres de hoy no cambian.
export function SvelteIsland({ component, props = {}, events }: SvelteIslandProps) {
    const host = useRef<HTMLDivElement>(null)
    const mounted = useRef<MountedIsland | null>(null)

    useEffect(() => {
        if (!host.current) return
        const reactiveProps = createSvelteProps({ ...props })
        const instance = mount(component, { target: host.current, props: reactiveProps, events })
        mounted.current = { instance, props: reactiveProps }
        return () => {
            unmount(instance)
            mounted.current = null
        }
    }, [component])

    useEffect(() => {
        if (mounted.current) Object.assign(mounted.current.props, props)
    })

    return <div ref={host} style={{ display: "contents" }} />
}
