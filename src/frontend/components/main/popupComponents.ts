import type { ComponentType } from "svelte"
import type { Popups } from "../../../types/Main"

import EffectItems from "./popups/EffectItems.svelte"
import Initialize from "./popups/Initialize.svelte"
import InteractionInput from "./popups/InteractionInput.svelte"
import Translate from "./popups/localization/Translate.svelte"
import ManageColors from "./popups/ManageColors.svelte"
import ManageDynamicValues from "./popups/ManageDynamicValues.svelte"
import ManageFonts from "./popups/ManageFonts.svelte"
import ManageGroups from "./popups/ManageGroups.svelte"
import ManageIcons from "./popups/ManageIcons.svelte"
import ManageMetadata from "./popups/ManageMetadata.svelte"
import ManageTags from "./popups/ManageTags.svelte"
import LooksWindow from "../looks/LooksWindow.svelte"
import KitDemo from "./popups/KitDemo.svelte"
import MaxLines from "./popups/MaxLines.svelte"
import MediaFit from "./popups/MediaFit.svelte"
import MetadataDisplay from "./popups/MetadataDisplay.svelte"
import NewUpdate from "./popups/NewUpdate.svelte"
import NextTimer from "./popups/NextTimer.svelte"
import NodeOptions from "./popups/NodeOptions.svelte"
import NowPlaying from "./popups/NowPlaying.svelte"
import OutputSelector from "./popups/OutputSelector.svelte"
import OutputSetup from "./popups/OutputSetup.svelte"
import RegexManager from "./popups/RegexManager.svelte"
import Rename from "./popups/Rename.svelte"
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
    initialize: Initialize,
    select_show: SelectShow,
    select_template: SelectTemplate,
    select_overlay: SelectOverlay,
    select_style: SelectStyle,
    select_look: SelectLook,
    select_stage_layout: SelectStageLayout,
    manage_groups: ManageGroups,
    manage_fonts: ManageFonts,
    manage_icons: ManageIcons,
    manage_colors: ManageColors,
    manage_metadata: ManageMetadata,
    manage_dynamic_values: ManageDynamicValues,
    template_style_overrides: TemplateStyleOverrides,
    regex_manager: RegexManager,
    rename: Rename,
    timer: Timer,
    variable: Variable,
    interaction_input: InteractionInput,
    now_playing: NowPlaying,
    max_lines: MaxLines,
    transition: Transition,
    media_fit: MediaFit,
    metadata_display: MetadataDisplay,

    choose_output_type: OutputSetup,

    output_selector: OutputSelector,
    set_time: SetTime,
    assign_shortcut: SlideShortcut,
    translate: Translate,
    next_timer: NextTimer,
    manage_tags: ManageTags,
    update_manager: UpdateManager,
    shortcuts: Shortcuts,
    unsaved: Unsaved,
    restore: Restore,
    reset_all: ResetAll,
    new_update: NewUpdate,
    slide_midi: SlideMidi,
    effect_items: EffectItems,
    timeline: TimelineSettings,
    timecode: Timecode,
    template_info: TemplateInfo,
    node_options: NodeOptions,
    looks: LooksWindow,
    screen_config: ScreenConfig,
    add_shows: AddShowsModal,
    playlist_options: PlaylistOptionsModal,
    kit_demo: KitDemo
}
