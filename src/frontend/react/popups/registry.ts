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
import { AddShowsModal } from "../show/left/AddShowsModal"
import { PlaylistOptionsModal } from "../show/left/PlaylistOptionsModal"

// Popups que ya viven en React. Al migrar uno, sale del mapa `popups` de components/main/popupComponents.ts y entra acá (nunca en los dos).
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
    kit_demo_react: KitDemoReact
}
