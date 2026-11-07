import { useEffect, useState, type ComponentType } from "react"

// Port de components/helpers/LazyLoad.svelte: carga el módulo la primera vez que `show` es true y renderiza su `default` sin props.
export interface LazyLoadProps {
    component: () => Promise<{ default: ComponentType }>
    show?: boolean
}

export function LazyLoad({ component, show = false }: LazyLoadProps) {
    // se guarda dentro de un objeto: un componente de función en el estado se llamaría como actualizador
    const [loaded, setLoaded] = useState<{ Component: ComponentType } | null>(null)

    useEffect(() => {
        if (!show || loaded) return
        let cancelled = false
        void component().then((module) => {
            if (!cancelled) setLoaded({ Component: module.default })
        })
        return () => {
            cancelled = true
        }
    }, [show, loaded, component])

    return loaded ? <loaded.Component /> : null
}
