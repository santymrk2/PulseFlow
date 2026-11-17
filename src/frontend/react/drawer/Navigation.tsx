import { cn } from "../../lib/utils"
import type { DrawerTabIds } from "../../../types/Tabs"
import { DropArea } from "../system/DropArea"
import { AudioTabs } from "./navigation/AudioTabs"
import { CalendarTabs } from "./navigation/CalendarTabs"
import { FunctionsTabs } from "./navigation/FunctionsTabs"
import { MediaTabs } from "./navigation/MediaTabs"
import { ScriptureTabs } from "./navigation/ScriptureTabs"
import { ShowsTabs } from "./navigation/ShowsTabs"
import styles from "./Navigation.module.css"

// Port de components/drawer/Navigation.svelte. Es un switchboard: scripture/calendar/functions van directo
// (sus versiones React ya existen en navigation/*); shows/media/audio siguen dentro del DropArea original.
export interface NavigationProps {
    id: DrawerTabIds
}

export function Navigation({ id }: NavigationProps) {
    const direct = id === "scripture" ? <ScriptureTabs /> : id === "calendar" ? <CalendarTabs /> : id === "functions" ? <FunctionsTabs /> : null

    return (
        <div className={styles.main}>
            <div className={cn(styles.categories, "context", `#category_${id}`)}>
                {direct ?? (
                    <DropArea id="navigation" selectChildren>
                        {id === "shows" ? <ShowsTabs /> : id === "media" ? <MediaTabs /> : id === "audio" ? <AudioTabs /> : null}
                    </DropArea>
                )}
            </div>
        </div>
    )
}
