// Props reactivas ($state) para que React pueda actualizar un componente Svelte ya montado.
export function createSvelteProps<T extends Record<string, unknown>>(initial: T): T {
    const props = $state(initial)
    return props
}
