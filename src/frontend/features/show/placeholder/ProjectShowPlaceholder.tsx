import { activePopup, activeProject, activeShow, popupData, projects } from "../../../shared/core/stores"
import { history } from "../../../shared/utils/helpers/history"
import { translateText } from "../../../shared/utils/language"
import { Button } from "../../../shared/ui/kit/button/Button"
import { Center } from "../../../shared/ui/system/Center"
import { DropArea } from "../../../shared/ui/system/DropArea"
import { useStore } from "../../../shared/ui/hooks/useStore"

// (F24.20a).
export function ProjectShowPlaceholder() {
    const projectId = useStore(activeProject) || ""
    const currentProjects = useStore(projects)
    const currentActiveShow = useStore(activeShow)
    const project = currentProjects[projectId]

    function replace() {
        popupData.set({
            action: "select_show",
            trigger: (showId: string) => {
                const showTemplateIndex = project.shows?.findIndex((show, index) => show.id === currentActiveShow?.id && ((currentActiveShow?.index ?? -1) > -1 ? index === currentActiveShow?.index : true))
                if (showTemplateIndex === undefined || showTemplateIndex < 0) return

                const newShows = [...(project?.shows || [])]
                newShows[showTemplateIndex] = { id: showId, type: "show" }

                history({
                    id: "UPDATE",
                    newData: { key: "shows", data: newShows },
                    oldData: { id: projectId },
                    location: { page: "show", id: "project_key" }
                })

                activeShow.set({ id: showId, type: "show", index: showTemplateIndex })
            }
        })
        activePopup.set("select_show")
    }

    return (
        <DropArea id="project" hoverTimeout={150}>
            <Center>
                {project ? (
                    <Button variant="default" icon="slide" style={{ fontSize: "1.1em" }} onClick={replace}>
                        {translateText("popup.select_show")}
                    </Button>
                ) : (
                    <p style={{ opacity: 0.6 }}>{translateText("empty.project_select")}</p>
                )}
            </Center>
        </DropArea>
    )
}
