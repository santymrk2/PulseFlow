# Propuesta: reducir los idiomas de `public/lang/` a español e inglés

> **Estado: propuesta, no ejecutada.** Es una decisión de producto pendiente. Este
> documento **no borra ni modifica ningún idioma**: sólo inventaria el estado actual,
> mide el impacto y recomienda un rumbo.
>
> Fecha: 2026-11-17 · Base: commit local `7644d6fe` (rama `agent/limpieza-docs`).

## Resumen ejecutivo

- `public/lang/` tiene **31 archivos JSON, 51.944 líneas y 2.230.715 bytes (~2,18 MiB)**.
  Vite los copia enteros al bundle (`publicDir: "public"` en `vite.config.mjs`): no hay
  carga diferida por idioma.
- `en.json` es la fuente de verdad (**1.808 claves**). `es.json` cubre **1.807** y tiene
  **1.746 cadenas traducidas (96,6 %)**. Es el único idioma además del inglés que se
  mantiene al día: las tareas F12/F14/F20/F23/F24 agregan claves nuevas **sólo a `en` y
  `es`** (convención explícita en `PLAN-F12.md`, `docs/informes/` y la guía de
  ejecutores).
- Los otros **29 idiomas llevan congelados desde F6.2 (2026-10-19)**; en esa tarea se
  les agregó la clave `themes.PulseFlow` a los 31 (`docs/archivo/VERIFICAR-F6.md`) y
  desde entonces no se tocó ninguno. Varios están muy incompletos: `sr` tiene 983
  claves faltantes, `ua` 985, `vi` 905, `ar` 603.
- `setLanguage()` **ya rellena con `en.json` las claves ausentes o vacías** de cualquier
  idioma (`language.ts:45-58`). Esos 29 archivos son, en la práctica, "traducciones
  parciales + fallback inglés". Dos de ellos (`en_GB`, `en_ZM`) sólo difieren del
  inglés en 38 cadenas ortográficas (*colour*, *capitalise*) y cuestan ~68 KiB cada
  uno.
- **Recomendación:** reducir a `en` + `es` en una tarea futura, separada y aprobada por
  producto. El ahorro sería de **48.005 líneas y 2.067.496 bytes (~2,02 MiB)**, con
  cambio funcional nulo para quien use esos dos idiomas.

## Cómo funciona hoy el sistema de idiomas

| Pieza | Función |
| --- | --- |
| `src/frontend/utils/languageData.ts` | Tres tablas: `languages` (31 nombres, alimenta el selector), `replace` (mapea `navigator.language` → identificador) y `languageFlags` (banderas). |
| `src/frontend/utils/language.ts::setLanguage` | Sin locale explícito usa `navigator.language`; aplica `replace`; si el locale no está en `replace`, cae a `en`; calcula RTL (`ar`, `fa`, `he`, `ur`); hace `fetch("./lang/<locale>.json")` y completa con `en.json`. |
| `getLanguageList()` | Construye las opciones del `SelectField` desde `Object.keys(languages)`. Se usa en `react/settings/General.tsx` y `react/popups/Initialize.tsx`. |
| `startup.ts` | Al arrancar llama a `setLanguage("", true)` y escribe `lang`/`dir` en `<html>`. |
| `updateSettings.ts` | Aplica el valor de `language` guardado en los settings del usuario. |
| `createData.ts:87` | Caso especial: si `language === "no"` precarga biblias noruegas. |
| `react/popups/ImportScripture.tsx:82` | Usa `replace` para emparejar el idioma de las biblias de API.Bible con el idioma de la UI. Acoplamiento no obvio. |
| `language.ts:99-102` | Paréntesis anchos (`（）`) para `zh`, `ja`, `ko`. |
| `vite.config.mjs` | `publicDir: "public"` → los 31 JSON se copian tal cual a `dist/lang/`. |

`translateText()` lee el store `dictionary`, que `setLanguage()` llena con el JSON
elegido más los fallbacks del inglés. No hay dependencia de un paquete i18n externo.

## Metodología del conteo

Cada JSON se aplanó a claves `sección.clave`; se cuenta como **presente** si el valor no
está vacío, y como **traducida** si difiere del valor de `en.json`. **Faltan** =
`1808 − presentes`. El porcentaje es sobre las 1.808 claves de `en.json` (no sobre las
presentes). KiB = bytes / 1024, líneas = `wc -l`. Las cifras son reproducibles con un
script de `bun` que lee `public/lang/`; no se modificó ningún archivo.

## Tabla de impacto

| Código | Archivo | Líneas | KiB | Claves (de 1808) | Faltan | Cadenas traducidas | % trad. | Estado |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `es` | `es.json` | 1969 | 85 | 1807 | 1 | 1746 | 96.6% | **conservar** |
| `en` | `en.json` | 1970 | 75 | 1808 | 0 | 0 | 0.0% | **conservar** |
| `ru` | `ru.json` | 1758 | 100 | 1584 | 224 | 1576 | 87.2% | candidato |
| `fr_FR` | `fr_FR.json` | 1854 | 82 | 1698 | 110 | 1579 | 87.3% | candidato |
| `hu` | `hu.json` | 1795 | 79 | 1630 | 178 | 1616 | 89.4% | candidato |
| `cs_CZ` | `cs_CZ.json` | 1854 | 77 | 1698 | 110 | 1611 | 89.1% | candidato |
| `sl` | `sl.json` | 1854 | 76 | 1697 | 111 | 1679 | 92.9% | candidato |
| `ro` | `ro.json` | 1795 | 76 | 1630 | 178 | 1481 | 81.9% | candidato |
| `tr` | `tr.json` | 1795 | 75 | 1630 | 178 | 1598 | 88.4% | candidato |
| `pl` | `pl.json` | 1795 | 75 | 1630 | 178 | 1595 | 88.2% | candidato |
| `ja` | `ja.json` | 1631 | 74 | 1420 | 388 | 1401 | 77.5% | candidato |
| `pt_BR` | `pt_BR.json` | 1795 | 74 | 1630 | 178 | 1543 | 85.3% | candidato |
| `no` | `no.json` | 1854 | 74 | 1698 | 110 | 1619 | 89.5% | candidato |
| `ko` | `ko.json` | 1724 | 74 | 1543 | 265 | 1533 | 84.8% | candidato |
| `pt_PT` | `pt_PT.json` | 1758 | 73 | 1584 | 224 | 1471 | 81.4% | candidato |
| `nl` | `nl.json` | 1781 | 73 | 1611 | 197 | 1458 | 80.6% | candidato |
| `it` | `it.json` | 1678 | 71 | 1497 | 311 | 1411 | 78.0% | candidato |
| `ar` | `ar.json` | 1427 | 70 | 1205 | 603 | 1201 | 66.4% | candidato |
| `de` | `de.json` | 1678 | 70 | 1497 | 311 | 1379 | 76.3% | candidato |
| `fi` | `fi.json` | 1678 | 69 | 1497 | 311 | 1474 | 81.5% | candidato |
| `zh_CN` | `zh_CN.json` | 1795 | 68 | 1630 | 178 | 1624 | 89.8% | candidato |
| `id_ID` | `id_ID.json` | 1678 | 68 | 1497 | 311 | 1383 | 76.5% | candidato |
| `en_GB` | `en_GB.json` | 1781 | 68 | 1611 | 197 | 38 | 2.1% | candidato |
| `en_ZM` | `en_ZM.json` | 1781 | 68 | 1611 | 197 | 38 | 2.1% | candidato |
| `sv` | `sv.json` | 1678 | 67 | 1496 | 312 | 1413 | 78.2% | candidato |
| `lt` | `lt.json` | 1559 | 64 | 1340 | 468 | 891 | 49.3% | candidato |
| `zh_TW` | `zh_TW.json` | 1659 | 64 | 1477 | 331 | 1470 | 81.3% | candidato |
| `sk` | `sk.json` | 1476 | 61 | 1261 | 547 | 1188 | 65.7% | candidato |
| `ua` | `ua.json` | 1006 | 48 | 823 | 985 | 814 | 45.0% | candidato |
| `vi` | `vi.json` | 1082 | 45 | 903 | 905 | 890 | 49.2% | candidato |
| `sr` | `sr.json` | 1006 | 36 | 825 | 983 | 707 | 39.1% | candidato |
| **Total (31)** | | **51944** | **2178** | | | | | |

Lecturas de la tabla:

- El idioma más completo después del inglés es el español: una sola clave ausente de
  1.808. Es el candidato natural a conservar.
- `ru.json` es el archivo más grande (100 KiB) pero no el más completo: le faltan 224
  claves que hoy se muestran en inglés.
- `en_GB`/`en_ZM` son el peor costo/beneficio: 136 KiB entre ambos por 38 diferencias
  ortográficas (*color → colour*, *capitalize → capitalise*, *center → centre*…).
- `sr`, `ua`, `vi`, `lt` y `sk` tienen entre 468 y 985 claves vacías: más de la mitad de
  la interfaz ya se les muestra en inglés.

## Impacto en código si se decide ejecutar

| Archivo | Cambio necesario | Riesgo |
| --- | --- | --- |
| `public/lang/` (29 JSON) | Borrar los 29 archivos. −48.005 líneas, −2.067.496 bytes. | Ninguno en `en`/`es`. |
| `utils/languageData.ts` | Quitar las 29 entradas de `languages`, `replace` y `languageFlags`. El dropdown pasa de 31 a 2 opciones. | **Obligatorio en el mismo commit que el borrado** (ver riesgos). |
| `utils/language.ts` | `rtlLanguages` y `fullWidth` quedan sin idiomas que los activan. Recomiendo **conservarlos**: son 4 líneas inofensivas y evitan reintroducirlos si vuelve un idioma RTL/CJK. | Nulo. |
| `utils/updateSettings.ts:322` | Migrar el `language` persistido (`fr_FR`, `pt_BR`, …) a `en`/`es` al cargar settings. | Cambio visible para usuarios con esos idiomas guardados; debe hacerse explícito, no silencioso. |
| `utils/createData.ts:87` | El branch `language === "no"` queda inalcanzable. Quitar en la misma tarea o dejar documentado como código muerto. | Si se deja, aparece código muerto nuevo (prohibido por `AGENTS.md`). |
| `react/popups/ImportScripture.tsx:82` | `replace` se usa para recomendar biblias por idioma. Al podarlo, esos idiomas dejan de recomendarse. | Acoplamiento funcional no obvio: decided si se conserva un mapa ISO separado del selector de UI. |
| Tests | `Initialize.test.tsx` y `General.test.tsx` mockean `getLanguageList`; no dependen del número de idiomas. No hay tests de `languageData.ts`. | No deberían romperse; correr `test:unit`/`test:react` igualmente. |
| `docs/archivo/VERIFICAR-F6.md` | Menciona la clave `themes.PulseFlow` agregada a los 31 idiomas. | Documentación histórica: **no modificar**, queda como registro. |

## Riesgos

1. **Fetch sin `.catch()`.** `setLanguage()` hace `fetch(url).then(response.json())`. Si
   se borran los JSON pero se dejan las entradas de `replace` en `languageData.ts`, un
   idioma guardado intentaría cargar un archivo inexistente: la promesa rechaza y
   `dictionary` nunca se setea (la UI queda sin textos traducidos). El borrado de
   archivos y la poda de las tres tablas **deben ser un mismo commit**.
2. **Settings de usuario.** `language` se persiste. Si el valor eliminado no se migra,
   `setLanguage()` caerá a `en` (por la validación contra `replace`) sin avisar. Es un
   cambio de idioma visible para ese usuario.
3. **Pérdida real de traducciones.** Los 29 idiomas tienen cientos de cadenas
   traducidas (1.576 en ruso, 1.616 en húngaro, 707 en serbio). El argumento para
   quitarlos no es que estén vacíos, sino que **no se pueden mantener** con la
   convención actual y que el fallback ya tapa sus huecos. Es una decisión de producto.
4. **RTL y CJK.** Al irse `ar`, `zh_*`, `ja` y `ko` del selector no queda ningún idioma
   que active `localeDirection = "rtl"` ni los paréntesis anchos. Los componentes que
   leen `localeDirection` (`Icon`, `Resizeable`, `ContextMenu`) seguirían funcionando
   con `ltr`; conservar el soporte cuesta casi nada.
5. **`src/server/`.** Fuera de alcance por instrucción explícita ("No tocar"). Si los
   clientes web viejos tienen sus propios catálogos, se revisan en otra tarea.

## Recomendación

**Reducir a `en` + `es`, pero no ahora.** Esta propuesta sólo deja registrado el
inventario y el criterio; la ejecución queda sujeta a aprobación de producto.

Razones:

1. El proyecto **ya funciona así en la práctica**: toda clave nueva se agrega sólo a
   `en.json` y `es.json`; los otros 29 no se actualizan desde F6.2.
2. `es.json` está al 96,6 % de cobertura: no hay ninguna otra lengua con esa
   completitud ni alguien que la mantenga.
3. El fallback a inglés ya está implementado y probado en el runtime, así que quitar
   archivos incompletos **no cambia lo que ve el usuario** en esos idiomas… salvo que
   el usuario pierde la opción de elegirlos (por eso es decisión de producto).
4. Ahorro de ~2,02 MiB en el bundle y 48.005 líneas de datos sin dueño; menos superficie
   para la migración F24 y para futuras claves.
5. `en_GB` y `en_ZM` son casos evidentes: 136 KiB por 38 palabras con ortografía
   británica/zambiana.

### Pasos sugeridos cuando se apruebe (tarea futura, no ejecutar aquí)

1. Podar `languages`, `replace` y `languageFlags` en `languageData.ts` **y** borrar los
   29 JSON en el mismo commit.
2. Migrar en `updateSettings.ts` cualquier valor de `language` guardado que ya no
   exista → `en` (o `es` si el producto prefiere español por defecto).
3. Decidir explícitamente qué se hace con el branch noruego de `createData.ts` y con el
   uso de `replace` en `ImportScripture.tsx` (quitarlos o conservar un mapa ISO aparte).
4. Correr la línea base completa (`test:unit`, `test:react`, `test:svelte`, `build`,
   chequeos Rust) y verificar en la app que el selector muestra **English / Español**,
   que cambiar entre ellos funciona y que la dirección del documento queda `ltr`.
5. Commit en español con id de tarea del roadmap, sin tocar `ROADMAP.md` ni los planes
   de F23/F24.

## Deuda registrada

- No hay validación automática de que cada clave de `en.json` exista en `es.json`
  (hoy falta 1). Sería útil un test de paridad, pero es tarea aparte.
- `setLanguage()` no maneja errores de `fetch`; con los 31 archivos presentes eso no
  se ve, pero es el riesgo 1 de arriba. Un `.catch()` con fallback a `en.json` sería
  una mejora independiente de esta propuesta.
- Si finalmente se eliminan idiomas, actualizar el inventario de esta tabla con el
  resultado real (y dejar constancia de la fecha de aprobación del producto).
