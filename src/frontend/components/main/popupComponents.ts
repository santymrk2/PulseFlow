import type { ComponentType } from "svelte"
import type { Popups } from "../../../types/Main"

import EffectItems from "./popups/EffectItems.svelte"
import Translate from "./popups/localization/Translate.svelte"
import LooksWindow from "../looks/LooksWindow.svelte"
import KitDemo from "./popups/KitDemo.svelte"
import SlideShortcut from "./popups/SlideShortcut.svelte"
import TemplateInfo from "./popups/TemplateInfo.svelte"
import TemplateStyleOverrides from "./popups/TemplateStyleOverrides.svelte"
import Timecode from "./popups/Timecode.svelte"
import TimelineSettings from "./popups/TimelineSettings.svelte"
import Timer from "./popups/Timer.svelte"
import Transition from "./popups/Transition.svelte"
import Unsaved from "./popups/Unsaved.svelte"
import UpdateManager from "./popups/UpdateManager.svelte"
import Variable from "./popups/Variable.svelte"
import ScreenConfig from "../screens/ScreenConfig.svelte"
import AddShowsModal from "../show/left/AddShowsModal.svelte"
import PlaylistOptionsModal from "../show/left/PlaylistOptionsModal.svelte"

export const popups: Partial<{ [key in Popups]: ComponentType }> = {
    template_style_overrides: TemplateStyleOverrides,
    timer: Timer,
    variable: Variable,
    transition: Transition,


    assign_shortcut: SlideShortcut,
    translate: Translate,
    update_manager: UpdateManager,
    unsaved: Unsaved,
    effect_items: EffectItems,
    timeline: TimelineSettings,
    timecode: Timecode,
    template_info: TemplateInfo,
    looks: LooksWindow,
    screen_config: ScreenConfig,
    add_shows: AddShowsModal,
    playlist_options: PlaylistOptionsModal,
    kit_demo: KitDemo
}
