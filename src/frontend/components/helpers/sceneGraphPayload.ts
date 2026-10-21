// Punto único donde se arma el payload del Scene Graph (`src/types/SceneGraph.ts`).
//
// Existe para que el contrato TS ↔ Rust tenga un solo lugar que enumere las claves:
// `buildSceneGraph()`/`buildStageScene()` (en `sceneGraph.ts`) lo llaman y el test de
// fixtures (`sceneGraphPayload.test.ts`, F4.2) genera los JSON que verifica el engine
// (`src-tauri/src/render/scene_contract.rs`). Cambiar una clave acá rompe ese test.
//
// Las claves que el engine dibuja y las que son sólo tipo están documentadas en
// `SceneGraph.ts` (F4.1).

import type { SceneBackground, SceneGraph, SceneItem, SceneMediaItem, SceneTextItem, SceneTextSpan, SceneTransition } from "../../../types/SceneGraph"
import { SCENE_GRAPH_VERSION } from "../../../types/SceneGraph"

/** Todo el Scene Graph salvo `version`, que lo pone este módulo. */
export interface SceneGraphParts {
    outputId: string
    stage: boolean
    width: number
    height: number
    background: SceneBackground | null
    items: SceneItem[]
    /** Items de las overlays activas (F4.6): capa propia encima de la slide */
    overlays: SceneItem[]
    transition: SceneTransition | null
    plainText: string
    nextText?: string
    /** Alineación del encuadre (F21.2); sin valor, centrada. */
    align?: "start" | "end"
}

/** Arma el payload con las claves exactas del contrato y la versión actual. */
export function sceneGraphPayload(parts: SceneGraphParts): SceneGraph {
    return defined<SceneGraph>({
        version: SCENE_GRAPH_VERSION,
        outputId: parts.outputId,
        stage: parts.stage,
        width: parts.width,
        height: parts.height,
        background: parts.background,
        items: parts.items,
        overlays: parts.overlays,
        transition: parts.transition,
        plainText: parts.plainText,
        nextText: parts.nextText,
        align: parts.align
    })
}

/** Fondo de la escena: imagen o video (el engine lo dibuja si `path` no está vacío). */
export function sceneBackground(parts: SceneBackground): SceneBackground {
    return defined<SceneBackground>({
        path: parts.path,
        type: parts.type,
        fit: parts.fit,
        opacity: parts.opacity,
        loop: parts.loop,
        muted: parts.muted
    })
}

/** Transición entre escenas (crossfade y corte en el bucle de render; F4.4). */
export function sceneTransition(parts: SceneTransition): SceneTransition {
    return defined<SceneTransition>({
        type: parts.type,
        durationMs: parts.durationMs,
        easing: parts.easing
    })
}

/** Item de texto de la escena. */
export function sceneTextItem(parts: Omit<SceneTextItem, "type">): SceneTextItem {
    return defined<SceneTextItem>({
        type: "text",
        id: parts.id,
        x: parts.x,
        y: parts.y,
        width: parts.width,
        height: parts.height,
        align: parts.align,
        verticalAlign: parts.verticalAlign,
        lineHeight: parts.lineHeight,
        fontFamily: parts.fontFamily,
        fontSize: parts.fontSize,
        fontWeight: parts.fontWeight,
        fontStyle: parts.fontStyle,
        color: parts.color,
        stroke: parts.stroke,
        shadow: parts.shadow,
        text: parts.text,
        spans: parts.spans
    })
}

/** Item de medio (imagen) dentro de la slide (F4.5). */
export function sceneMediaItem(parts: Omit<SceneMediaItem, "type">): SceneMediaItem {
    return defined<SceneMediaItem>({
        type: "media",
        id: parts.id,
        x: parts.x,
        y: parts.y,
        width: parts.width,
        height: parts.height,
        src: parts.src,
        mediaType: parts.mediaType,
        fit: parts.fit,
        opacity: parts.opacity
    })
}

/** Tramo de texto con estilo propio; los saltos de línea van dentro de `text`. */
export function sceneTextSpan(parts: SceneTextSpan): SceneTextSpan {
    return defined<SceneTextSpan>({
        text: parts.text,
        fontFamily: parts.fontFamily,
        fontSize: parts.fontSize,
        fontWeight: parts.fontWeight,
        fontStyle: parts.fontStyle,
        color: parts.color
    })
}

/**
 * Quita las claves sin valor: el contrato no distingue entre una clave ausente y una
 * sin valor (Rust usa los mismos defaults para las dos), así el JSON que viaja por IPC
 * y el de los fixtures son estables.
 */
function defined<T extends object>(value: T): T {
    Object.keys(value).forEach((key) => {
        if ((value as any)[key] === undefined) delete (value as any)[key]
    })
    return value
}
