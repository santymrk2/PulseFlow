import type { ComponentType } from "svelte"
import type { Popups } from "../../../types/Main"

import EffectItems from "./popups/EffectItems.svelte"
import Translate from "./popups/localization/Translate.svelte"
import LooksWindow from "../looks/LooksWindow.svelte"
import KitDemo from "./popups/KitDemo.svelte"
import ResetAll from "./popups/ResetAll.svelte"
import Restore from "./popups/Restore.svelte"
import SelectLook from "./popups/SelectLook.svelte"
import SelectOverlay from "./popups/SelectOverlay.svelte"
import SelectShow from "./popups/SelectShow.svelte"
import SelectStageLayout from "./popups/SelectStageLayout.svelte"
import SelectStyle from "./popups/SelectStyle.svelte"
import SelectTemplate from "./popups/SelectTemplate.svelte"
import SetTime from "./popups/SetTime.svelte"
import Shortcuts from "./popups/Shortcuts.svelte"
import SlideMidi from "./popups/SlideMidi.svelte"
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
    select_show: SelectShow,
    select_template: SelectTemplate,
    select_overlay: SelectOverlay,
    select_style: SelectStyle,
    select_look: SelectLook,
    select_stage_layout: SelectStageLayout,
    template_style_overrides: TemplateStyleOverrides,
    timer: Timer,
    variable: Variable,
    transition: Transition,


    set_time: SetTime,
    assign_shortcut: SlideShortcut,
    translate: Translate,
    update_manager: UpdateManager,
    shortcuts: Shortcuts,
    unsaved: Unsaved,
    restore: Restore,
    reset_all: ResetAll,
    slide_midi: SlideMidi,
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
