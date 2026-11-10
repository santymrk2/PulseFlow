import type { ComponentType } from "svelte"
import type { Popups } from "../../../types/Main"

import Confirm from "./popups/Confirm.svelte"
import Connect from "./popups/Connect.svelte"
import CreateCollection from "./popups/CreateCollection.svelte"
import CreatePlayer from "./popups/CreatePlayer.svelte"
import CreateShow from "./popups/createShow/CreateShow.svelte"
import CustomAction from "./popups/CustomAction.svelte"
import CustomText from "./popups/CustomText.svelte"
import DeleteDuplicatedShows from "./popups/DeleteDuplicatedShows.svelte"
import DeleteShow from "./popups/DeleteShow.svelte"
import DisplayDuration from "./popups/DisplayDuration.svelte"
import DynamicValues from "./popups/DynamicValues.svelte"
import EditChart from "./popups/EditChart.svelte"
import EditEvent from "./popups/EditEvent.svelte"
import EffectItems from "./popups/EffectItems.svelte"
import Emitters from "./popups/Emitters.svelte"
import Export from "./popups/export/Export.svelte"
import FindReplace from "./popups/FindReplace.svelte"
import History from "./popups/History.svelte"
import Import from "./popups/Import.svelte"
import ImportCalendar from "./popups/ImportCalendar.svelte"
import ImportScripture from "./popups/ImportScripture.svelte"
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
    confirm: Confirm,
    custom_text: CustomText,
    import: Import,
    export: Export,
    show: CreateShow,
    delete_show: DeleteShow,
    select_show: SelectShow,
    select_template: SelectTemplate,
    select_overlay: SelectOverlay,
    select_style: SelectStyle,
    select_look: SelectLook,
    select_stage_layout: SelectStageLayout,
    delete_duplicated_shows: DeleteDuplicatedShows,
    manage_groups: ManageGroups,
    manage_fonts: ManageFonts,
    manage_icons: ManageIcons,
    manage_colors: ManageColors,
    manage_metadata: ManageMetadata,
    manage_dynamic_values: ManageDynamicValues,
    template_style_overrides: TemplateStyleOverrides,
    regex_manager: RegexManager,
    player: CreatePlayer,
    rename: Rename,
    find_replace: FindReplace,
    timer: Timer,
    variable: Variable,
    interaction_input: InteractionInput,
    now_playing: NowPlaying,
    max_lines: MaxLines,
    transition: Transition,
    media_fit: MediaFit,
    metadata_display: MetadataDisplay,
    import_scripture: ImportScripture,
    import_calendar: ImportCalendar,
    create_collection: CreateCollection,
    edit_event: EditEvent,
    edit_chart: EditChart,

    choose_output_type: OutputSetup,

    output_selector: OutputSelector,
    set_time: SetTime,
    assign_shortcut: SlideShortcut,
    dynamic_values: DynamicValues,
    translate: Translate,
    next_timer: NextTimer,
    display_duration: DisplayDuration,
    manage_tags: ManageTags,
    update_manager: UpdateManager,
    shortcuts: Shortcuts,
    unsaved: Unsaved,
    restore: Restore,
    reset_all: ResetAll,
    new_update: NewUpdate,
    history: History,
    manage_emitters: Emitters,
    custom_action: CustomAction,
    slide_midi: SlideMidi,
    connect: Connect,
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
