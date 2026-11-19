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
import { ChooseMediaInput } from "./ChooseMediaInput"
import { ChooseOutput } from "./ChooseOutput"
import { ChooseStyle } from "./ChooseStyle"
import { ChurchAppsSyncCategories } from "./ChurchAppsSyncCategories"
import { CleaningUtility } from "./CleaningUtility"
import { CloudMethod } from "./CloudMethod"
import { CloudSync } from "./CloudSync"
import { CloudUpdate } from "./CloudUpdate"
import { Color } from "./Color"
import { ColorGradient } from "./ColorGradient"
import { Conditions } from "./Conditions"
import { Confirm } from "./Confirm"
import { Connect } from "./Connect"
import { CreateCollection } from "./CreateCollection"
import { CreatePlayer } from "./CreatePlayer"
import { CreateShow } from "./CreateShow"
import { CustomAction } from "./CustomAction"
import { CustomText } from "./CustomText"
import { DeleteDuplicatedShows } from "./DeleteDuplicatedShows"
import { DeleteShow } from "./DeleteShow"
import { DisplayDuration } from "./DisplayDuration"
import { DynamicValues } from "./DynamicValues"
import { EditChart } from "./EditChart"
import { EditEvent } from "./EditEvent"
import { Emitters } from "./Emitters"
import { EffectItems } from "./EffectItems"
import { Export } from "./Export"
import { FindReplace } from "./FindReplace"
import { History } from "./History"
import { Import } from "./Import"
import { ImportCalendar } from "./ImportCalendar"
import { ImportScripture } from "./ImportScripture"
import { Initialize } from "./Initialize"
import { InteractionInput } from "./InteractionInput"
import { ManageColors } from "./ManageColors"
import { ManageDynamicValues } from "./ManageDynamicValues"
import { ManageFonts } from "./ManageFonts"
import { ManageGroups } from "./ManageGroups"
import { ManageIcons } from "./ManageIcons"
import { ManageMetadata } from "./ManageMetadata"
import { ManageTags } from "./ManageTags"
import { KitDemoReact } from "./KitDemoReact"
import { LooksWindow } from "./LooksWindow"
import { AddShowsModal } from "../show/left/AddShowsModal"
import { PlaylistOptionsModal } from "../show/left/PlaylistOptionsModal"
import { MediaFit } from "./MediaFit"
import { MetadataDisplay } from "./MetadataDisplay"
import { NewUpdate } from "./NewUpdate"
import { NextTimer } from "./NextTimer"
import { NodeOptions } from "./NodeOptions"
import { NowPlaying } from "./NowPlaying"
import { OutputSelector } from "./OutputSelector"
import { OutputSetup } from "./OutputSetup"
import { RegexManager } from "./RegexManager"
import { Rename } from "./Rename"
import { ResetAll } from "./ResetAll"
import { Restore } from "./Restore"
import { SelectLook } from "./SelectLook"
import { SelectOverlay } from "./SelectOverlay"
import { SelectShow } from "./SelectShow"
import { SelectStageLayout } from "./SelectStageLayout"
import { SelectStyle } from "./SelectStyle"
import { SelectTemplate } from "./SelectTemplate"
import { SetTime } from "./SetTime"
import { Shortcuts } from "./Shortcuts"
import { SlideMidi } from "./SlideMidi"
import { SlideShortcut } from "./SlideShortcut"
import { TemplateInfo } from "./TemplateInfo"
import { TemplateStyleOverrides } from "./TemplateStyleOverrides"
import { Timecode } from "./Timecode"
import { TimelineSettings } from "./TimelineSettings"
import { Timer } from "./Timer"
import { Transition } from "./Transition"
import { Unsaved } from "./Unsaved"
import { UpdateManager } from "./UpdateManager"
import { Variable } from "./Variable"
import { Translate } from "./Translate"
import { ScreenConfig } from "../screens/ScreenConfig"

// Registro único de popups React: los últimos cuatro salieron de components/main/popupComponents.ts.
export const reactPopups: Partial<Record<Popups, ElementType>> = {
    about: About,
    add_shows: AddShowsModal,
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
    choose_media_input: ChooseMediaInput,
    choose_output_input: ChooseOutput,
    choose_style: ChooseStyle,
    sync_categories: ChurchAppsSyncCategories,
    cleaning_utility: CleaningUtility,
    cloud_method: CloudMethod,
    cloud_sync: CloudSync,
    cloud_update: CloudUpdate,
    color: Color,
    color_gradient: ColorGradient,
    conditions: Conditions,
    confirm: Confirm,
    connect: Connect,
    create_collection: CreateCollection,
    player: CreatePlayer,
    show: CreateShow,
    custom_action: CustomAction,
    custom_text: CustomText,
    delete_duplicated_shows: DeleteDuplicatedShows,
    delete_show: DeleteShow,
    display_duration: DisplayDuration,
    dynamic_values: DynamicValues,
    edit_chart: EditChart,
    edit_event: EditEvent,
    effect_items: EffectItems,
    manage_emitters: Emitters,
    export: Export,
    find_replace: FindReplace,
    history: History,
    import: Import,
    import_calendar: ImportCalendar,
    import_scripture: ImportScripture,
    initialize: Initialize,
    interaction_input: InteractionInput,
    manage_colors: ManageColors,
    manage_dynamic_values: ManageDynamicValues,
    manage_fonts: ManageFonts,
    manage_groups: ManageGroups,
    manage_icons: ManageIcons,
    manage_metadata: ManageMetadata,
    manage_tags: ManageTags,
    playlist_options: PlaylistOptionsModal,
    kit_demo: KitDemoReact,
    kit_demo_react: KitDemoReact,
    looks: LooksWindow,
    screen_config: ScreenConfig,
    media_fit: MediaFit,
    metadata_display: MetadataDisplay,
    new_update: NewUpdate,
    next_timer: NextTimer,
    node_options: NodeOptions,
    now_playing: NowPlaying,
    output_selector: OutputSelector,
    choose_output_type: OutputSetup,
    regex_manager: RegexManager,
    rename: Rename,
    reset_all: ResetAll,
    restore: Restore,
    select_look: SelectLook,
    select_overlay: SelectOverlay,
    select_show: SelectShow,
    select_stage_layout: SelectStageLayout,
    select_style: SelectStyle,
    select_template: SelectTemplate,
    set_time: SetTime,
    assign_shortcut: SlideShortcut,
    translate: Translate,
    shortcuts: Shortcuts,
    unsaved: Unsaved,
    slide_midi: SlideMidi,
    timeline: TimelineSettings,
    timecode: Timecode,
    template_info: TemplateInfo,
    template_style_overrides: TemplateStyleOverrides,
    timer: Timer,
    transition: Transition,
    update_manager: UpdateManager,
    variable: Variable
}
