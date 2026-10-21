// Árbol de playlists (proyectos y carpetas) listo para `ProjectList`.
// Extraído de `Projects.svelte` sin cambiar el comportamiento, para poder testearlo
// y compartirlo con el panel PLAYLISTS.

import type { Project, Tree } from "../../../types/Projects"

type FolderLike = { name: string; parent: string; created?: number; deleted?: boolean }
type Profile = Record<string, string | undefined>

const byName = <T extends { name?: string }>(list: T[]) => list.filter((a) => typeof a.name === "string").sort((a, b) => a.name!.localeCompare(b.name!, undefined, { numeric: true, sensitivity: "base" }))

export function buildProjectTree(input: { folders: Record<string, FolderLike>; projects: Record<string, Project>; sortType: string; profile: Profile }): Tree[] {
    const { folders, projects, sortType, profile } = input

    const folderNodes = Object.entries(folders)
        .filter(([id, a]) => !a.deleted && profile[id] !== "none")
        .map(([id, folder]) => ({ ...folder, id, type: "folder" as const }))
    const projectNodes = Object.entries(projects)
        .filter(([, a]) => !a.deleted)
        .map(([id, project]) => ({ ...project, parent: folders[project.parent] ? project.parent : "/", id, shows: [] as any }))

    // se ordena por nombre aunque se pida otro orden: las carpetas <= 0.9.5 no tienen fecha de creación
    let sortedFolders: any[] = byName(folderNodes)
    let sortedProjects: any[] = byName(projectNodes)
    if (sortType === "created") {
        sortedFolders = sortedFolders.sort((a, b) => (b.created || 0) - (a.created || 0))
        sortedProjects = sortedProjects.sort((a, b) => (b.created || 0) - (a.created || 0))
    } else if (sortType === "modified") {
        sortedProjects = sortedProjects.sort((a, b) => (b.modified || 0) - (a.modified || 0))
    } else if (sortType === "name_des") {
        sortedFolders = sortedFolders.reverse()
        sortedProjects = sortedProjects.reverse()
    }

    // los archivados al final
    sortedProjects = sortedProjects.sort((a, b) => (!!a.archived === !!b.archived ? 0 : a.archived ? 1 : -1))

    // si falta la carpeta (o está borrada), el nodo cuelga de la raíz
    const flat: Tree[] = [...sortedFolders, ...sortedProjects].map((a) => ({ ...a, parent: !folders[a.parent] || folders[a.parent].deleted ? "/" : a.parent }))

    const result: Tree[] = []
    const walk = (parent: string, index: number, path: string) => {
        flat.filter((a) => a.parent === parent).forEach((node) => {
            const rootParentId = path.split("/")[0] || node.id
            if (profile[rootParentId] === "none") return

            const entry: Tree = { ...node, index, path, readOnly: profile[rootParentId] === "read" }
            result.push(entry)
            if (entry.type !== "folder") return

            walk(entry.id, index + 1, path + entry.id + "/")
        })
    }
    walk("/", 0, "")

    return result
}
