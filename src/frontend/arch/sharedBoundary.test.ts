// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { listSpecifiers, resolveSpecifier } from "../../../scripts/moveModules"

// `shared/` no importa de `features/` ni de `app/`. SHARED_EXCEPTIONS son los archivos de shared/ que hoy lo
// incumplen: la lista sólo puede achicarse (falla si aparece una violación nueva o si una excepción ya no viola).

const ROOT = join(__dirname, "../../..")
const SHARED_DIR = join(ROOT, "src/frontend/shared")
const FORBIDDEN = /^src\/frontend\/(features|app)\//

export const SHARED_EXCEPTIONS: string[] = [
    "src/frontend/shared/audio/audioChannelRecorder.ts",
    "src/frontend/shared/audio/audioFading.ts",
    "src/frontend/shared/audio/audioPlayer.ts",
    "src/frontend/shared/audio/audioPlaylist.ts",
    "src/frontend/shared/core/ipc/main.ts",
    "src/frontend/shared/core/stores.ts",
    "src/frontend/shared/test/islandMock.tsx",
    "src/frontend/shared/ui/context/ContextItem.test.tsx",
    "src/frontend/shared/ui/context/ContextItem.tsx",
    "src/frontend/shared/ui/context/ContextMenu.test.tsx",
    "src/frontend/shared/ui/context/ContextMenu.tsx",
    "src/frontend/shared/ui/context/SpellCheckMenu.test.tsx",
    "src/frontend/shared/ui/context/SpellCheckMenu.tsx",
    "src/frontend/shared/ui/context/logic/contextMenuSearch.ts",
    "src/frontend/shared/ui/context/logic/loadItems.ts",
    "src/frontend/shared/ui/context/logic/menuClick.ts",
    "src/frontend/shared/ui/form/FormInput.test.tsx",
    "src/frontend/shared/ui/form/FormInput.tsx",
    "src/frontend/shared/ui/kit/color-field/ColorField.test.tsx",
    "src/frontend/shared/ui/kit/color-field/ColorField.tsx",
    "src/frontend/shared/ui/kit/font-field/FontField.test.tsx",
    "src/frontend/shared/ui/kit/select-field/SelectField.test.tsx",
    "src/frontend/shared/ui/kit/select-field/SelectField.tsx",
    "src/frontend/shared/ui/kit/text-field/TextField.shortcuts.test.tsx",
    "src/frontend/shared/ui/system/Player.test.tsx",
    "src/frontend/shared/ui/system/Player.tsx",
    "src/frontend/shared/utils/common.ts",
    "src/frontend/shared/utils/drive.ts",
    "src/frontend/shared/utils/helpers/OutputHelper.ts",
    "src/frontend/shared/utils/helpers/clipboard.ts",
    "src/frontend/shared/utils/helpers/dropActions.ts",
    "src/frontend/shared/utils/helpers/get.ts",
    "src/frontend/shared/utils/helpers/historyActions.ts",
    "src/frontend/shared/utils/helpers/historyHelpers.ts",
    "src/frontend/shared/utils/helpers/looks.migration.test.ts",
    "src/frontend/shared/utils/helpers/looks.ts",
    "src/frontend/shared/utils/helpers/media.ts",
    "src/frontend/shared/utils/helpers/output.ts",
    "src/frontend/shared/utils/helpers/overlayOutput.ts",
    "src/frontend/shared/utils/helpers/sceneGraph.ts",
    "src/frontend/shared/utils/helpers/setShow.ts",
    "src/frontend/shared/utils/helpers/showActions.ts",
    "src/frontend/shared/utils/helpers/shows.ts",
    "src/frontend/shared/utils/helpers/tags.ts",
    "src/frontend/shared/utils/helpers/tick.ts",
    "src/frontend/shared/utils/helpers/timerTick.ts",
    "src/frontend/shared/utils/helpers/videoSync.ts",
    "src/frontend/shared/utils/profile.ts",
    "src/frontend/shared/utils/rss.ts",
    "src/frontend/shared/utils/search.test.ts",
    "src/frontend/shared/utils/search.ts",
    "src/frontend/shared/utils/templates.ts",
    "src/frontend/shared/utils/transitions.ts"
]

function listSources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return listSources(full)
        return /\.tsx?$/.test(entry.name) ? [full] : []
    })
}

const exists = (path: string) => {
    const full = join(ROOT, path)
    return existsSync(full) && statSync(full).isFile()
}

function findViolations(): string[] {
    return listSources(SHARED_DIR)
        .map((path) => relative(ROOT, path).replace(/\\/g, "/"))
        .filter((file) =>
            listSpecifiers(readFileSync(join(ROOT, file), "utf8")).some((spec) => {
                const target = resolveSpecifier(file, spec, exists)
                return target !== null && FORBIDDEN.test(target)
            })
        )
        .sort()
}

describe("frontera de shared/", () => {
    const violations = findViolations()

    it("shared/ no importa de features/ ni de app/ (salvo SHARED_EXCEPTIONS)", () => {
        expect(violations.filter((file) => !SHARED_EXCEPTIONS.includes(file))).toEqual([])
    })
    it("SHARED_EXCEPTIONS está ordenada y ninguna entrada dejó de violar", () => {
        expect([...SHARED_EXCEPTIONS].sort()).toEqual(SHARED_EXCEPTIONS)
        expect(SHARED_EXCEPTIONS.filter((file) => !violations.includes(file))).toEqual([])
    })
})
