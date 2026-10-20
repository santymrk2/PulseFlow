<script lang="ts">
    export let item

    // la ventana webview de salida ya no existe: los captions (caption.ninja) no tienen dónde
    // renderizarse, así que este componente queda como previsualización del item
</script>

<div class="preview fill"></div>

<style>
    .fill {
        width: 100%;
        height: 100%;
    }

    .preview {
        background-color: rgb(0 0 0 / 0.5);
    }
</style>
