# Verificar F12 — revisión visual (lo que queda para el usuario en su Mac)

Capturas en `docs/capturas/f12/` (1280×800, Linux de sesión en la nube, sin
monitores reales). Estado por pantalla (F12.10):

| Captura | Estado |
| --- | --- |
| `antes-show.png`, `antes-pantallas.png`, `antes-look-menu.png` | línea base (commit 9b911223) |
| `f12.1-pantallas-1280.png` | ok: modal de pantallas con una sola cabecera; Esc cierra; clic afuera no cierra |
| `f12.2-kit.png` | ok en tema oscuro. **Pendiente**: captura en tema claro (`f12.2-kit-claro.png`) |
| `f12.3-pantallas-1280.png`, `f12.3-envio-1280.png` | ok a 1280; los monitores escalan al panel. **Pendiente**: 1920×1080 |
| `f12.4-looks-1280.png` | ok: lista, grilla, pie con Renombrar/Duplicar/Borrar/Make Live; Esc cierra. La grilla (LookGrid) sigue con controles Material |
| `f12.5-top-1280.png`, `f12.5-look-menu.png` | ok: una sola apariencia en la barra; Look ▾ con "Editar looks…". **Pendiente**: 1920 |
| `f12.6-izquierda.png` | ok: títulos traducidos, un solo PLAYLIST, filas del kit |
| `f12.9-inicio.png` | ok: logo + nombre; accesos con el kit |
| `f12.10-show-1280.png`, `f12.10-settings-1280.png` | ok a grandes rasgos. Settings: "Configure screens…" con el kit |
| F12.7 (panel derecho) | **pendiente**, ver `docs/informes/f12.md` |

## Qué probar en el Mac

1. **Modal de pantallas** a 1280×800 y a 1920×1080: que entre todo, los monitores no
   se salgan del panel, las pestañas Hardware / Cropping / Sending se vean completas.
2. **Esc** en el modal de pantallas y en el de Looks, con la audiencia encendida:
   cierra el modal y **no** limpia la salida.
3. **Clic afuera** del modal: no lo cierra.
4. **Arrastrar la ventana** desde los espacios vacíos de la barra superior.
5. **Look ▾** en la barra: cambia de look al hacer clic y "Editar looks…" abre el modal.
6. **Textos en inglés y en español**: en Settings, la barra y los menús no deben quedar
   con texto del otro idioma (quedan fuera las pantallas que no se tocaron en F12).
7. **Kit demo** (en dev): `activePopup.set("kit_demo")` desde la consola, en tema
   claro y oscuro.
