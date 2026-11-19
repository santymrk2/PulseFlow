import { describe, expect, it } from "vitest"
import { pickerEvent } from "./pickerEvents"

describe("pickerEvent", () => {
    it("convierte la carpeta elegida en el evento OPEN_FOLDER2 con el canal del pedido", () => {
        expect(pickerEvent("OPEN_FOLDER", { channel: "MEDIA" }, "/Users/a/Videos")).toEqual({ channel: "OPEN_FOLDER2", data: { channel: "MEDIA", path: "/Users/a/Videos" } })
    })

    it("no emite nada si se cancela el diálogo de carpeta", () => {
        expect(pickerEvent("OPEN_FOLDER", { channel: "MEDIA" }, null)).toBeNull()
    })

    it("convierte los archivos elegidos en OPEN_FILE2 con el id del pedido", () => {
        const result = { files: ["/a.png", "/b.png"], content: {} }
        expect(pickerEvent("OPEN_FILE", { channel: "MEDIA", id: "x1" }, result)).toEqual({ channel: "OPEN_FILE2", data: { channel: "MEDIA", id: "x1", files: ["/a.png", "/b.png"], content: {} } })
    })

    it("no emite nada si no se eligió ningún archivo", () => {
        expect(pickerEvent("OPEN_FILE", { channel: "MEDIA", id: "x1" }, { files: [], content: {} })).toBeNull()
    })

    it("ignora los demás comandos", () => {
        expect(pickerEvent("SAVE", {}, "algo")).toBeNull()
    })
})
