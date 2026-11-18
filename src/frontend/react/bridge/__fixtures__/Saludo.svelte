<script lang="ts">
    // Fixture de test de SvelteIsland (F24.4): componente legado a propósito.
    import { createEventDispatcher } from "svelte"

    export let nombre = ""

    const dispatch = createEventDispatcher<{ saludo: string }>()
</script>

<span>Hola {nombre}</span>
<slot />
<slot name="extra" />
<button on:click={() => dispatch("saludo", nombre)}>Saludar</button>
