// ----- FreeShow -----
// Plantillas: paquetes de estilo (fondo, color de texto, tipografía, alineado)
// reutilizables y aplicables a las diapositivas.

export type TemplateAlign = "left" | "center" | "right"

export interface Template {
    id: string
    name: string
    /** Fondo (color CSS o degradado) de la diapositiva. */
    background: string
    /** Imagen de fondo (ruta/ID) opcional. */
    backgroundImage: string
    textColor: string
    fontFamily: string
    fontSize: number
    align: TemplateAlign
}

export type Templates = Record<string, Template>

export const TEMPLATE_FONTS = ["Inter", "Roboto", "Montserrat", "Lato", "Georgia", "system-ui"]

export const DEFAULT_TEMPLATES: Templates = {
    escenario: {
        id: "escenario",
        name: "Escenario",
        background: "#000000",
        backgroundImage: "",
        textColor: "#ffffff",
        fontFamily: "system-ui",
        fontSize: 72,
        align: "center",
    },
    claro: {
        id: "claro",
        name: "Claro",
        background: "#f8fafc",
        backgroundImage: "",
        textColor: "#0f172a",
        fontFamily: "Georgia",
        fontSize: 64,
        align: "center",
    },
}
