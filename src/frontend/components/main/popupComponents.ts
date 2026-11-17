import type { ComponentType } from "svelte"
import type { Popups } from "../../../types/Main"

import EffectItems from "./popups/EffectItems.svelte"
import LooksWindow from "../looks/LooksWindow.svelte"
import KitDemo from "./popups/KitDemo.svelte"
import ScreenConfig from "../screens/ScreenConfig.svelte"
import AddShowsModal from "../show/left/AddShowsModal.svelte"
import PlaylistOptionsModal from "../show/left/PlaylistOptionsModal.svelte"

export const popups: Partial<{ [key in Popups]: ComponentType }> = {


    effect_items: EffectItems,
    looks: LooksWindow,
    screen_config: ScreenConfig,
    add_shows: AddShowsModal,
    playlist_options: PlaylistOptionsModal,
    kit_demo: KitDemo
}
