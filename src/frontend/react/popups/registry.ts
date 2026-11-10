import type { ElementType } from "react"
import type { Popups } from "../../../types/Main"
import { About } from "./About"
import { Action } from "./Action"
import { ActionHistory } from "./ActionHistory"
import { AddAudioEffect } from "./AddAudioEffect"
import { Alert } from "./Alert"
import { AspectRatio } from "./AspectRatio"
import { AudioEffect } from "./AudioEffect"
import { AudioStream } from "./AudioStream"
import { CategoryAction } from "./CategoryAction"
import { ChangeIcon } from "./ChangeIcon"
import { ChooseChord } from "./ChooseChord"
import { KitDemoReact } from "./KitDemoReact"

// Popups que ya viven en React. Al migrar uno, sale del mapa `popups` de components/main/popupComponents.ts y entra acá (nunca en los dos).
export const reactPopups: Partial<Record<Popups, ElementType>> = {
    about: About,
    action: Action,
    action_history: ActionHistory,
    add_audio_effect: AddAudioEffect,
    alert: Alert,
    aspect_ratio: AspectRatio,
    audio_effect: AudioEffect,
    audio_stream: AudioStream,
    category_action: CategoryAction,
    icon: ChangeIcon,
    choose_chord: ChooseChord,
    kit_demo_react: KitDemoReact
}
