# VERIFICAR-BETA — Guía única de prueba en hardware

Esta guía junta todo lo que los agentes no pudieron comprobar porque no ven la pantalla: dos monitores, video real,
cierre de la app, Windows. Se recorre una vez en la Mac y otra vez en la PC con Windows. Cada paso dice de dónde sale
(entre paréntesis): una tarea del `docs/ROADMAP.md`, el plan F23 o `docs/VERIFICAR.md`.

## Equipo necesario

- Una Mac Apple Silicon y una PC con Windows 10/11.
- **2 monitores** en cada equipo.
- Un `.mp4` 4K H.264.
- Un `.mp4` 1080p para dejar en loop.
- Un show con fondos de imagen y de video.
- 50 imágenes 4K distintas.
- Una biblia con palabras de Jesús en rojo.
- Para la Mac: un terminal. Para Windows: el Administrador de tareas.
- Levantar la app con `bun run dev:tauri` (una sola instancia, puerto 1420), salvo donde diga "build de release".

## Cómo usarla

- **Hacé primero el punto 9.1 (CSP).** Es **BLOQUEANTE**: hasta que no pase, no uses la app en vivo.
- Después seguí el orden de las secciones. Marcá `Mac [x]` o `Windows [x]` cuando el **Esperado** se cumpla. Si no se
  cumple, dejá la casilla vacía y anotá qué pasó en **Notas**. Cada falla se convierte en una tarea en F23.25.
- `[n/a]` quiere decir que el punto no aplica a ese sistema.
- Si un punto necesita ver errores de consola, abrí las DevTools del webview de la ventana de control.

## Índice

1. Salida en 2 monitores
2. Video
3. Memoria
4. Texto
5. Cierre y guardado
6. Stage con layout propio, reloj y transiciones
7. Dos pantallas, Looks y encuadre
8. Columna izquierda, correcciones de F22 y avisos
9. Seguridad
10. Decisiones pendientes (no son pasos de prueba)

---

## 1. Salida en 2 monitores

Recorrido completo de F2.8, con los detalles de F2.2 a F2.6 y F10.0c a F10.0e de `docs/VERIFICAR.md`.

### 1.1 Identificar pantallas (F2.5, F2.8 paso 1)
- **Pasos:** Settings → Outputs → "Elegir pantalla" → botón de lupa. Repetirlo desde el popup de selección de salida.
  Pulsar la lupa dos veces seguidas.
- **Esperado:** cada monitor muestra una ventana negra con su número grande y "PulseFlow — Pantalla N" durante 3 s y se
  cierra sola. El número coincide con el de la previsualización de esa pantalla. Con la doble pulsación no queda
  ninguna ventana abierta. Esas ventanas no cuentan como salidas ni cambian el botón de salida.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.5 pasos 1–5.

### 1.2 Mapa de monitores (F10.0c, F10.0e)
- **Pasos:** en "Elegir pantalla" mirar el mapa. Con el monitor externo a otra escala que el integrado, y con el
  externo a la izquierda o arriba del principal si se puede. Elegir el monitor externo y ponerla en vivo. Desconectar
  y reconectar el externo (o cambiar el orden de monitores en el sistema) y reabrir la salida.
- **Esperado:** los monitores aparecen alineados y sin solaparse, con número, nombre y resolución; el principal lleva
  una estrella y el asignado se resalta. La salida se abre en el externo. Tras reconectar vuelve al mismo monitor
  físico.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F10.0c pasos 1–4 y F10.0e pasos 1–5.

### 1.3 Poner en vivo en el monitor secundario y cubrirlo (F2.8 pasos 2–3, F2.2, F10.0d)
- **Pasos:** elegir el monitor secundario como salida de audiencia y ponerla en vivo. Después asignar la salida al
  monitor de la ventana de control y ponerla en vivo. Probar una salida con bounds más chicos que el monitor.
- **Esperado:** el secundario queda cubierto por completo (sin bordes, sin barra de menú ni Dock) y se ve la slide con
  el estilo elegido, sin la UI. La ventana de control sigue usable. Asignada al mismo monitor de la app, también cubre
  ese monitor. Con bounds más chicos, los respeta.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.2 y F10.0d pasos 1, 2 y 4. En Windows la ventana se posiciona al tamaño exacto del
  monitor (no hay `set_simple_fullscreen`).

### 1.4 Un solo monitor o sin monitor asignado (F2.2 paso 6, F10.0d paso 3)
- **Pasos:** con 1 monitor (o con una salida sin monitor asignado), poner la salida en vivo.
- **Esperado:** se abre como ventana flotante 16:9 y no tapa la UI de control.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.2 paso 6 y F10.0d paso 3.

### 1.5 Reubicar la salida (F2.2 pasos 3–5)
- **Pasos:** cambiar el monitor asignado; mover o redimensionar los bounds desde "Elegir pantalla"; activar
  `alwaysOnTop`.
- **Esperado:** la salida se reubica cada vez. Con `alwaysOnTop` queda visible sobre otras ventanas.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.2.

### 1.6 Estado de la salida y botón (F2.3, F2.8 paso 8)
- **Pasos:** abrir una salida, cerrarla con el mismo botón, abrirla otra vez y cerrarla desde la propia ventana.
- **Esperado:** el botón de salida pasa a rojo al abrir y vuelve a inactivo al cerrar, de cualquiera de las dos
  formas; la ventana desaparece.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.3 pasos 1–4.

### 1.7 Estilos distintos por pantalla y que stage no se mezcle (F2.4 pasos 1–3, F2.8 paso 7)
- **Pasos:** con dos salidas de audiencia con estilos distintos, abrir ambas. Sumar una salida stage con layout
  asignado y cambiar de slide. Cambiar en el layout de stage la "salida fuente".
- **Esperado:** cada monitor muestra su propio estilo (tipografía, color, alineación). El stage muestra el texto
  actual, el siguiente ("SIGUIENTE: …") y el reloj; las pantallas de audiencia no muestran nada de stage. El stage
  pasa a reflejar la otra salida elegida.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.4. Con layouts propios de stage se mira también el punto 6.1 y el 6.2.

### 1.8 Pasar slides de una canción y consola limpia (F2.8 paso 4, F2.6, F2.4 paso 5)
- **Pasos:** abrir una canción y pasar varias slides, con y sin fondos. Mirar la consola.
- **Esperado:** cada slide se proyecta. Cero errores `Command … not found` / `invoke(...) failed`. En desarrollo puede
  aparecer una sola vez por nombre un aviso `[tauri] canal OUTPUT: comando "X" descartado …`: no es un error. Llegan
  varios `RENDER_SCENE` (uno por salida).
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.6 pasos 1–5.

### 1.9 Fondos de imagen y de video, y limpiar (F2.8 pasos 5–6, F2.4 paso 4)
- **Pasos:** poner una imagen de fondo en una slide y después pasar a una con video de fondo. Limpiar la salida.
- **Esperado:** la imagen se ve en el monitor. El video se reproduce solo en esa pantalla y el anterior se detiene al
  cambiar. Al limpiar, vuelve a negro (sin texto ni fondo).
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F2.8.

### 1.10 Imagen dentro de la slide (F4.5)
- **Pasos:** arrastrar una imagen desde el media bin a la slide, ponerla en vivo, cambiar su `fit` y poner un texto
  encima.
- **Esperado:** la imagen aparece dentro de su caja con el encaje elegido (`cover`/`contain`/`fill`); con `contain` lo
  que sobra se ve transparente (fondo), no negro. Cambiar el `fit` la redibuja. El texto se ve sobre la imagen.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F4.5 pasos 1–4. El video como ítem de slide se prueba en 2.5.

### 1.11 Resultado de la sección
- Mac: ______________________   Windows: ______________________
- **Notas:** F2.8 pide anotar por sistema qué funcionó y qué no (fondos, stage, ubicación, alwaysOnTop, cierre).

---

## 2. Video

Nativo en macOS (AVFoundation), Media Foundation en Windows. Los pasos de F8.3, F13.4 y F18.6 vienen del ROADMAP.

### 2.1 Medir CPU, RAM y GPU con un 1080p en loop 30 min (F8.3)
- **Pasos:** poner el 1080p en loop como fondo, en vivo, y dejarlo 30 minutos. Anotar CPU, RAM y GPU al principio, a
  los 15 min y al final (Monitor de Actividad / Administrador de tareas).
- **Esperado:** valores estables, sin crecimiento sostenido de memoria. Con los números se decide si hace falta otra
  estrategia de video.
- Mac [ ] Windows [ ]
- **Notas:** F8.3 pide anotar el resultado en `PLAN.md`. Es la parte "loop de horas sin tirones": mientras corre,
  mirar que no haya tirones al dar la vuelta ni cada segundo (F23.14).

### 2.2 `.mp4` 4K en la audiencia (F13.4, F18.6 a–d)
- **Pasos:** reproducir el `.mp4` 4K H.264 en la salida de audiencia.
- **Esperado:** (a) se ve. (b) En los logs no aparece "decodificador nativo no disponible" (si aparece, cayó a ffmpeg
  y el motivo está ahí). (c) CPU y frame-time medidos con el benchmark de `docs/informes/f18.md`. (d) 60 s sin
  artefactos al rotar el anillo de texturas.
- Mac [ ] Windows [ ]
- **Notas:** F18.6 (a–d) está en el texto de F13.4. En Windows es la primera vez que corre Media Foundation + D3D12:
  anotar cualquier caída a ffmpeg. En la Mac, (a), (b) y (d) comprueban el decodificador nativo.

### 2.3 Pausa, play y salto (F23.14 Step 5)
- **Pasos:** un video de fondo con sonido en vivo. Pausa, play, mover la línea de tiempo (también en pausa) y dejar
  correr 5 minutos.
- **Esperado:** en pausa la imagen se congela al instante; con play sigue; al mover la línea de tiempo la imagen salta
  al mismo lugar; tras 5 minutos audio e imagen siguen juntos. No hay saltos ni tirones cada segundo ni parpadeos al
  llegar la posición. Un video que arranca en pausa muestra su primer frame.
- Mac [ ] Windows [ ]
- **Notas:** F23.14 Step 5 y reporte de F23.14. F23.13 reemplazó `-re` de ffmpeg por un pacer propio: conviene
  revisarlo con un video real. Con dos salidas reproduciendo el mismo archivo, manda la última que sincroniza.

### 2.4 Video dentro de una slide (F23.20 Step 5)
- **Pasos:** una slide con un ítem de video que ocupe un cuarto de la pantalla, en vivo. Pasar a otra slide. Probar
  `fit` contain/cover/fill, opacidad, y el mismo archivo como fondo y como ítem a la vez. Pausar y mover la línea de
  tiempo.
- **Esperado:** el video se reproduce en el proyector dentro de su caja y, al pasar de slide, se detiene. Pausa y
  posición siguen al reproductor de la UI, sin parpadeos cada segundo.
- Mac [ ] Windows [ ]
- **Notas:** F23.20 Step 5 y reporte. Un video dentro de un overlay todavía no se dibuja (deuda conocida).

### 2.5 Abrir una salida con una slide con video ya activa (reporte F23.20, ronda 1)
- **Pasos:** con la salida cerrada, dejar activa una slide con un ítem de video; recién entonces abrir la salida.
- **Esperado:** el video del ítem se ve y se reproduce desde que la salida abre, sin esperar a cambiar de slide.
- Mac [ ] Windows [ ]
- **Notas:** `open_screen` ahora sincroniza los videos de la escena actual (reporte F23.20).

### 2.6 Laptop suspendida con la salida abierta (pérdida del device)
- **Pasos:** con una salida abierta en el monitor externo y un video corriendo, suspender el equipo, esperar unos
  segundos y despertarlo.
- **Esperado:** la app no se cierra. La salida se recupera o, si no, queda anotado qué pasó. Los errores de GPU y los
  pánicos del render ya no cierran la app: la salida afectada se apaga, avisa el estado y se puede reabrir.
- Mac [ ] Windows [ ]
- **Notas:** este punto sale de la lista del brief de F23.24 y de F23.3 (reporte: "forzar un pánico y ver que la salida
  se apaga, emite `OUTPUT_STATE` y se puede reabrir"); no tiene pasos escritos en ninguna tarea. Anotar el
  comportamiento real.

---

## 3. Memoria

### 3.1 Pasar 50 imágenes 4K en vivo (F23.7)
- **Pasos:** anotar la memoria de video y la del proceso de PulseFlow al principio (Monitor de Actividad en la Mac;
  Administrador de tareas en Windows, pestañas Procesos y Rendimiento → GPU). Poner las 50 imágenes 4K como fondo de
  50 slides y pasarlas todas en vivo, rápido y a ritmo normal, y volver a anotar al final. Volver a pasar las primeras.
- **Esperado:** la memoria de video se estabiliza en lugar de crecer sin parar (el tope es de 1 GiB de texturas; se
  descartan primero las menos usadas). Las imágenes se ven completas y con su proporción, aunque se reduzcan a 4096 px
  de lado. Al volver a una imagen descartada, se vuelve a cargar sin error.
- Mac [ ] Windows [ ]
- **Notas:** F23.7 (tope de 4096 px y presupuesto de memoria). Anotar los dos números (inicio y final) en cada
  sistema. No tiene "paso en la app" en el plan: la medición viene del brief de F23.24.
- Memoria al inicio / al final: Mac ______ / ______   Windows ______ / ______

---

## 4. Texto

### 4.1 Overlay largo sobre slide corta con la ✕ visible (F23.4 Step 5)
- **Pasos:** un show con texto corto ("Amén") y un overlay con texto largo encendido. Pasar el mouse sobre la pantalla
  de salida para que aparezca la ✕.
- **Esperado:** se ven los tres textos (slide, overlay y ✕) y la app no se cierra.
- Mac [ ] Windows [ ]
- **Notas:** F23.4 Step 5.

### 4.2 Cuadros con fondo, borde y esquinas (F23.16 Step 5)
- **Pasos:** un cuadro con fondo semitransparente, borde y esquinas redondeadas (probar también opacidad y padding).
  Compararlo en la vista previa y en el proyector.
- **Esperado:** se ve igual en los dos. Mirar el grosor del borde (va hacia adentro), el padding y los colores.
- Mac [ ] Windows [ ]
- **Notas:** F23.16 Step 5. El proyector mezcla el fondo semitransparente en espacio lineal y la vista previa en
  sRGB: un fondo semitransparente puede verse un poco distinto. Si molesta, anotarlo para una tarea.

### 4.3 Espaciado entre letras, subrayado y tachado (F23.18)
- **Pasos:** texto con espaciado entre letras, un tramo subrayado y otro tachado, también dentro de un cuadro con
  padding y opacidad. Mirarlo en el proyector.
- **Esperado:** las letras se separan, el subrayado y el tachado se dibujan con el color del texto (atenuado si hay
  opacidad) y siguen el padding del cuadro.
- Mac [ ] Windows [ ]
- **Notas:** F23.18 no tiene paso "En la app"; el reporte sugiere esta verificación visual en un proyector real.

### 4.4 Contador de slides, eventos y variables en el proyector (F23.17 Step 5)
- **Pasos:** un contador de slides, un ítem de eventos (con hora, lugar y notas) y una variable de texto y otra de
  número. Compararlos en la vista previa y en el proyector. Avanzar de slide, cambiar el valor de la variable y usar
  una variable con `{time_}`. Deshabilitar una variable.
- **Esperado:** en la vista previa se ven igual que antes y ahora también en el proyector. El contador cambia al
  avanzar sin un crossfade extra y el número actual lleva el color de acento. En los eventos la hora va en negrita y el
  lugar en cursiva; los terminados desaparecen y no parpadean. Una variable con `{time_}` avanza cada segundo. Una
  variable deshabilitada se ve tenue.
- Mac [ ] Windows [ ]
- **Notas:** F23.17 Step 5 y reporte (acento, negrita/cursiva de eventos, variables deshabilitadas tenues).

### 4.5 Valor de tiempo en un texto común sobre un video de fondo (revisión final F23)
- **Pasos:** una slide con el texto "Empezamos en {video_countdown}" sobre un video de fondo, en vivo. Mirar 20 s.
- **Esperado:** el texto avanza cada segundo y la salida no hace crossfade cada segundo.
- Mac [ ] Windows [ ]
- **Notas:** revisión final F23 (los textos con `{time_…}`, `{timer_…}`, `{video_…}` o `{audio_…}` se tratan como `live`).

---

## 5. Cierre y guardado

### 5.1 Renombrar y cerrar enseguida con el botón rojo (F23.8 Step 5)
- **Pasos:** renombrar un show y cerrar **enseguida** con el botón rojo. Reabrir.
- **Esperado:** el nombre nuevo está.
- Mac [ ] Windows [n/a]
- **Notas:** F23.8 Step 5.

### 5.2 "Salir" desde el Dock (F23.8 Step 5, reporte)
- **Pasos:** renombrar un show y salir con "Salir" del Dock. Reabrir. Después, con una salida de video abierta, volver
  a salir y correr `pgrep -l ffmpeg`.
- **Esperado:** hay una limitación conocida: "Salir" desde el Dock **no** pasa por el guardado, así que el cambio puede
  perderse. Lo mínimo que tiene que pasar es que `pgrep -l ffmpeg` no muestre procesos (las salidas y los ffmpeg se
  cierran al salir).
- Mac [ ] Windows [n/a]
- **Notas:** F23.8 Step 5 y reporte; deuda registrada en el ROADMAP (tao 0.37 no implementa
  `applicationShouldTerminate`). Anotar si se perdió el nombre.

### 5.3 Sin procesos de video al cerrar (F23.8 Step 5)
- **Pasos:** con una salida de video abierta, cerrar la app con el botón rojo. Correr `pgrep -l ffmpeg`.
- **Esperado:** no hay procesos.
- Mac [ ] Windows [n/a]
- **Notas:** F23.8 Step 5. En Windows está en el punto 5.6.

### 5.4 Aviso de cambios sin guardar (F23.8 Step 6)
- **Pasos:** activar `special.showClosePopup` y cerrar con el botón rojo. Elegir "Cancelar".
- **Esperado:** aparece el popup y "Cancelar" deja la app abierta. Un nuevo clic en el botón rojo vuelve a preguntar
  (ver 5.7). Sin cancelar (el popup sigue abierto): dentro de los 10 segundos no hace nada; entre 10 y 60 segundos
  sale sin guardar; después de 60 segundos vuelve a preguntar.
- Mac [ ] Windows [ ]
- **Notas:** F23.8 Step 6 y reporte (decisión de los tres estados de cierre). Se asume que `app.exit(0)` no re-entra
  al pedido de cierre: a verificar.

### 5.5 Doble clic en el botón rojo durante el guardado (reporte F23.8)
- **Pasos:** con cambios sin guardar, hacer doble clic en el botón rojo.
- **Esperado:** no corta el guardado a la mitad; el archivo queda completo.
- Mac [ ] Windows [ ]
- **Notas:** reporte de F23.8, "Pendiente de verificar".

### 5.6 Windows: la ✕ de la ventana (F23.8 Step 7)
- **Pasos:** repetir el 5.1 con la ✕ de la ventana. Con una salida de video abierta, cerrar y mirar el Administrador de
  tareas.
- **Esperado:** el nombre nuevo está al reabrir y no queda ningún `ffmpeg.exe`.
- Mac [n/a] Windows [ ]
- **Notas:** F23.8 Step 7.

### 5.7 Cancelar el aviso y volver a cerrar (revisión final F23, R8)
- **Pasos:** activar `special.showClosePopup`. ✕ (botón rojo) → popup "sin guardar" → "Cancelar" → esperar entre 10 y
  60 segundos → volver a cerrar. Repetir cerrando el aviso con Esc y con un clic afuera (además de "Cancelar").
- **Esperado:** en los tres casos vuelve a mostrar el popup (no sale sin guardar ni sin preguntar).
- Mac [ ] Windows [ ]
- **Notas:** revisión final F23. Antes, el segundo cierre en esa ventana de tiempo salía directo.

---

## 6. Stage con layout propio, reloj y transiciones

### 6.1 Stage con el layout del usuario (F23.19 Step 5)
- **Pasos:** armar un layout de stage con slide actual, siguiente (`slideOffset` 1), reloj y notas, asignarlo a una
  salida stage y ponerla en vivo. Probar también un layout viejo sin `type`.
- **Esperado:** el monitor de stage muestra ese diseño: posiciones y tamaños, la última slide no muestra la siguiente,
  las etiquetas activas se ven, el texto autoajustado se parece al de la vista previa y el reloj avanza cada segundo
  sin parpadeo de transición. Un layout viejo también se dibuja.
- Mac [ ] Windows [ ]
- **Notas:** F23.19 Step 5 y reporte. El reloj analógico todavía no se dibuja (deuda registrada).

### 6.2 La salida fuente del layout de stage ahora se respeta (R19, F23.19)
- **Pasos:** en un layout de stage elegir una "salida fuente" distinta de la primera y mirar el stage. Si alguien ya
  tenía una salida configurada ahí, mirar qué muestra ahora.
- **Esperado:** el stage muestra la salida que se eligió. Antes se ignoraba siempre esa opción, así que quien tenía
  otra salida configurada va a ver un cambio en lo que muestra el stage.
- Mac [ ] Windows [ ]
- **Notas:** R19 (F23.19). Confirmar que este cambio es lo deseado.

### 6.3 El reloj avanza (F23.15 Step 3)
- **Pasos:** una slide con un reloj digital, sin timers, en vivo. Esperar 70 s. Repetir con segundos activados, con un
  timer corriendo y con un video en la escena.
- **Esperado:** el minuto cambia en el proyector y el reloj avanza sin fundidos cada segundo. La UI y el proyector
  siguen fluidos.
- Mac [ ] Windows [ ]
- **Notas:** F23.15 Steps 1 y 3. El Step 1 pedía mirar antes del arreglo; como el arreglo ya está, se verifica el
  Step 3. Con un reloj en escena se reenvía la escena de todas las salidas cada segundo: mirar que no se pierda
  fluidez.

### 6.4 Transiciones de escala y desenfoque (F23.21)
- **Pasos:** poner la transición de la salida en `scale` y después en `blur` y pasar de slide.
- **Esperado:** `scale`: la slide nueva crece desde un poco más chica, sin estirar los bordes. `blur`: se desenfoca a
  mitad de la transición y termina nítida. Ninguna deja parpadeos ni fotogramas negros.
- Mac [ ] Windows [ ]
- **Notas:** F23.21 no tiene paso "En la app"; el reporte avisa que el aspecto visual no se vio. `spin` sigue siendo
  un crossfade (deuda registrada).

### 6.5 Stage abierto con un reloj o cuenta regresiva en la audiencia (revisión final F23)
- **Pasos:** monitor de stage abierto y, en la slide de audiencia, un reloj o una cuenta regresiva (timer o evento).
  Esperar 30 s.
- **Esperado:** el stage NO hace fundidos cada segundo; el reloj de la audiencia y el del stage avanzan sin parpadeo.
  Con la slide "Empezamos en {video_countdown}" y el stage abierto, el stage NO muestra "{video_countdown}" literal.
- Mac [ ] Windows [ ]
- **Notas:** revisión final F23 (el texto plano del stage ahora excluye los ítems `live`).

---

## 7. Dos pantallas, Looks y encuadre

### 7.1 Crossfade y corte entre slides (F4.4)
- **Pasos:** dar un estilo de audiencia a la salida "Primary" y ponerla en vivo; pasar slides con la transición en
  crossfade (duración mayor a 0 ms) y después en corte. Cambiar algo ajeno a la salida (un ajuste de la UI o abrir una
  segunda salida).
- **Esperado:** el crossfade es un fundido suave, sin parpadeo ni fotogramas negros, a la frecuencia del monitor. El
  corte es instantáneo. Lo ajeno a la salida no produce un fundido.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F4.4 pasos 1–5.

### 7.2 Dos pantallas abiertas con crossfade (F17.3)
- **Pasos:** abrir dos pantallas de audiencia en sus monitores, con crossfade, y pasar slides.
- **Esperado:** las dos hacen el fundido sin errores, cada una con su contenido.
- Mac [ ] Windows [ ]
- **Notas:** F17.3 (pantallas sobre el Device compartido), "sin verificar en la app real".

### 7.3 Duplicar y eliminar pantallas (F17.5)
- **Pasos:** en el detalle de una pantalla, Duplicar y Eliminar. Eliminar una pantalla que está en vivo. Probar
  Eliminar en la última audiencia.
- **Esperado:** Duplicar crea una copia; Eliminar cierra la ventana y olvida la escena. Eliminar está deshabilitado en
  la última audiencia. Renombrar (input del nombre) sigue funcionando.
- Mac [ ] Windows [ ]
- **Notas:** F17.5, "sin verificar en la app real".

### 7.4 Relación de aspecto y encuadre (F21.1, F21.2)
- **Pasos:** en una Pantalla elegir una relación de aspecto distinta de la del monitor (por ejemplo 4:3 en un monitor
  16:9) y probar la alineación (centro, inicio, final). Después probar "Original". Mirar el tamaño de las slides en la
  vista previa.
- **Esperado:** las slides de la UI toman la relación de la Pantalla (ya no caen siempre en 16:9). En el proyector el
  contenido se escala hasta entrar entero, se alinea según el valor elegido y el resto queda negro. Con "Original"
  llena la ventana. El stage no se encuadra (usa toda la ventana).
- Mac [ ] Windows [ ]
- **Notas:** F21.1 y F21.2, "sin verificar en la app real".

### 7.5 Crear pantallas y looks (F10.10)
- **Pasos:** desde la ventana, crear 2 pantallas de audiencia y 1 stage, y 3 looks. Mirar Settings → Outputs.
- **Esperado:** Settings → Outputs muestra dos grupos, "Audiencia" y "Stage"; "Crear pantalla de escenario" pide el
  layout de stage; cada salida muestra su monitor y si está abierta o cerrada.
- Mac [ ] Windows [ ]
- **Notas:** F10.10 y `docs/VERIFICAR.md` F5 paso 9.

### 7.6 Cambiar de look en vivo (F10.10)
- **Pasos:** cambiar de look desde el menú (clic derecho en la salida → "Cambiar look"), la barra, el panel de salida
  (el selector aparece con más de un look) y una acción de slide "Aplicar look". Probar el espejo. Probar la grilla de
  Settings → Looks y "Make Live".
- **Esperado:** cada vía aplica el look elegido. La acción de slide lo cambia al activarse (también con la opción
  "antes de la salida" cuando el estilo no incluye el fondo). En la grilla, cada pantalla de audiencia es una columna
  con su dropdown de estilo y los toggles de capas.
- Mac [ ] Windows [ ]
- **Notas:** F10.10 y `docs/VERIFICAR.md` F5 pasos 3, 5, 6, 7 y 8.

### 7.7 Historial, stage y duplicar estilo (F5.2, F5.3)
- **Pasos:** aplicar un look y deshacer con el historial. Crear un look con una salida stage presente. Con dos looks
  que comparten un estilo, togglear una capa en uno de ellos.
- **Esperado:** el deshacer devuelve los estilos y el look activo. El stage no se guarda dentro del look y aplicar el
  look no toca el stage. Al togglear la capa pregunta si duplicar el estilo: aceptar lo duplica sin afectar al otro
  look; cancelar no cambia nada.
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F5 pasos 1, 2 y 4.

### 7.8 Persistencia (F10.10)
- **Pasos:** cerrar y reabrir la app.
- **Esperado:** pantallas, looks y el look activo siguen como estaban.
- Mac [ ] Windows [ ]
- **Notas:** F10.10.

---

## 8. Columna izquierda, correcciones de F22 y avisos

### 8.1 Bibliotecas y playlists (F20.8)
- **Pasos:** elegir biblioteca y playlist, buscar, abrir el modal "Agregar shows", arrastrar shows.
- **Esperado:** todo responde y no hay errores en consola.
- Mac [ ] Windows [ ]
- **Notas:** F20.8 (no se pudo mirar la pantalla en F20).

### 8.2 Divisores, renombrar y menú contextual (F20.8)
- **Pasos:** mover los divisores, renombrar una biblioteca y abrir su menú contextual.
- **Esperado:** los divisores se mueven, el renombrado se guarda y el menú contextual funciona.
- Mac [ ] Windows [ ]
- **Notas:** F20.8.

### 8.3 Pestañas del cajón y perfil restringido (F20.8)
- **Pasos:** achicar el cajón hasta tener poco ancho. Entrar con un perfil con acceso restringido.
- **Esperado:** las pestañas del cajón se pueden recorrer (la tira se desplaza). El perfil restringido ve sólo lo que
  le corresponde.
- Mac [ ] Windows [ ]
- **Notas:** F20.8. ÍTEMS no tiene "⋯ más" (decisión de F20).

### 8.4 La ✕ en la pantalla de audiencia y de stage (F22.13)
- **Pasos:** pasar el mouse sobre la salida de audiencia y sobre la de stage y usar la ✕.
- **Esperado:** la ✕ aparece y cierra esa salida.
- Mac [ ] Windows [ ]
- **Notas:** F22.13.

### 8.5 Menú superior en Windows (F22.13)
- **Pasos:** usar el menú superior de la ventana de control.
- **Esperado:** funciona como en la Mac.
- Mac [n/a] Windows [ ]
- **Notas:** F22.13.

### 8.6 Agregar carpeta y medios (F22.13)
- **Pasos:** agregar una carpeta y agregar medios.
- **Esperado:** aparecen en el cajón y se pueden usar.
- Mac [ ] Windows [ ]
- **Notas:** F22.13.

### 8.7 Barra de video y cabecera del show (F22.13)
- **Pasos:** reproducir un video y usar su barra; mirar la cabecera del show.
- **Esperado:** la barra de video funciona y la cabecera del show se ve bien.
- Mac [ ] Windows [ ]
- **Notas:** F22.13.

### 8.8 Botones con borde blanco (F22.13)
- **Pasos:** recorrer la UI buscando botones con borde blanco.
- **Esperado:** no queda ninguno. Anotar los que queden.
- Mac [ ] Windows [ ]
- **Notas:** F22.13.

### 8.9 Barra superior (F10.0a, F10.0b)
- **Pasos:** mirar la esquina superior izquierda, arrastrar la ventana por una zona vacía de la barra, hacer doble clic
  ahí, hacer clic en los botones de la barra. Con cambios sin guardar, mirar junto al botón de Settings.
- **Esperado:** no hay texto "PulseFlow" ni barra roja; en macOS los botones del semáforo no se solapan con nada. El
  arrastre mueve la ventana, el doble clic la maximiza o restaura y los botones siguen recibiendo clic sin arrastrar.
  Los cambios sin guardar se marcan con un punto rojo pequeño con el tooltip "Cambios sin guardar".
- Mac [ ] Windows [ ]
- **Notas:** `docs/VERIFICAR.md` F10.0a y F10.0b. La reserva de 80 px del semáforo es sólo de macOS.

### 8.10 Funciones que todavía no existen avisan (F23.22 Step 5)
- **Pasos:** (1) Configuración → sincronización en la nube. (2) Buscar letras o tocar otra función pospuesta de la
  lista, dos veces. (3) Tocar el botón manual de sincronización. (4) Arrancar la app con la sincronización en la nube
  activada.
- **Esperado:** (1) la sincronización ya no se ofrece como disponible. (2) Aparece el aviso "Esta función todavía no
  está disponible en PulseFlow." una sola vez por función y por sesión. (3) El botón manual muestra ese aviso. (4) Al
  arrancar no aparece ningún aviso.
- Mac [ ] Windows [ ]
- **Notas:** F23.22 Step 5, reporte y decisión sobre el botón manual (`setupCloudSync`). Aparte: `es.json` no tiene
  `toast.save_error` (anterior a F23).

---

## 9. Seguridad

### 9.1 CSP — BLOQUEANTE, hacerlo primero (F23.12 Step 2)
- **Pasos:** `bun run dev:tauri` con las DevTools abiertas y la consola filtrada por `Content Security Policy`.
  Recorrer en este orden (de más a menos riesgo) y anotar cada violación:
  1. Cajón → Medios → Online → YouTube: pegar un video y reproducirlo. Probar también Vimeo. Mirar violaciones
     `script-src` / `frame-src` sobre `youtube.com`. **En el build de Windows** mirar si hay una violación de
     `script-src` sobre otro host (por ejemplo `s.ytimg.com` o `www.youtube.com/s/player/…` por http): si aparece,
     anotar ese origen exacto para sumarlo.
  2. Conexión a OBS (ajustes de OBS, host `localhost` o una IP de la LAN): `ws://localhost:4455`. No debe haber
     violación `connect-src`.
  3. Una acción REST a una IP local (`http://192.168…`). No debe haber violación `connect-src`.
  4. Un ítem Web con una URL `http://` y otra `https://`. Mirar si se renderiza y si hay violación `frame-src`.
  5. Un show con fondo de imagen y otro con video, en vista previa y en salida (`img-src`/`media-src` sobre
     `asset:`/`blob:`).
  6. Miniaturas del cajón de medios, y búsqueda en Pixabay o Unsplash (ver miniaturas, descargar).
  7. Importar un PDF con imágenes y mostrarlo en salida (`worker-src` y, si aparece, `wasm-unsafe-eval`).
  8. Audio: efectos (noise gate, stereo shaper), pitch y timecode LTC (`script-src` sobre los worklets).
  9. Descargar una biblia y mostrar un versículo; una fuente personalizada (`font-src`); RSS, texto dinámico,
     calendario y clima con una URL `http://`.
  10. Banderas en el selector de idioma, sin violación `font-src` sobre `cdn.jsdelivr.net`.
  11. Audio e imagen por una URL `http://`, sin violación `media-src` / `img-src`.
  12. Que no aparezcan `freeshow-protected://` ni `localhost:5001`.
- **Esperado:** todo carga y **no hay violaciones**. Si un uso legítimo choca, se suma el origen mínimo a la directiva
  y se anota en el commit. **Nunca** `unsafe-inline` ni `unsafe-eval` en `script-src`.
- Mac [ ] Windows [ ]
- **Notas:** F23.12 Step 2, checklist del reporte de F23.12 (con las rondas 1 y 2). Las rondas ya permitieron
  `connect-src http: ws:`, `font-src https://cdn.jsdelivr.net`, `script-src http://www.youtube.com` y `img-src` /
  `media-src http:`. Lo que sigue sin resolver es el ítem Web `http://` (`frame-src` sólo `https:`).

### 9.2 CSP en el build de release (F23.12 Step 3)
- **Pasos:** `bun run build`, abrir el build de release y repetir 2 o 3 puntos del 9.1 (por ejemplo 1, 5 y 7).
- **Esperado:** sin violaciones. En release el origen cambia: `tauri://localhost` en macOS y `http://tauri.localhost`
  en Windows.
- Mac [ ] Windows [ ]
- **Notas:** F23.12 Step 3. También cubre F23.23: la app de producción arranca sin el módulo de Sentry.

### 9.3 Puertos de red cerrados (F23.9 Step 5)
- **Pasos:** con la app abierta, en la Mac: `lsof -nP -iTCP -sTCP:LISTEN | rg ":551[0-3]"`. En Windows:
  `netstat -ano | findstr ":551"`. Mirar `pulseflow.log`.
- **Esperado:** nada escuchando. En `pulseflow.log` hay dos líneas `[server] remote: sin cliente web…` y
  `[server] stage: …`. En desarrollo, `controller` y `output_stream` no loguean (están deshabilitados por defecto).
- Mac [ ] Windows [ ]
- **Notas:** F23.9 Step 5 y reporte.

### 9.4 Ningún pedido a `sentry.io` (F23.23 Step 5)
- **Pasos:** DevTools → Red. Provocar un error (por ejemplo, abrir un medio que no existe).
- **Esperado:** ningún pedido a `sentry.io`, y la línea del error en `pulseflow.log`.
- Mac [ ] Windows [ ]
- **Notas:** F23.23 Step 5.

### 9.5 Biblia con palabras en rojo (F23.10 Step 5)
- **Pasos:** en Scripture abrir la biblia con palabras en rojo (también una con rojo anidado dentro de otras
  etiquetas). Crear una slide desde un versículo.
- **Esperado:** el rojo se ve y el texto de la slide está. Si el rojo se pierde en una biblia real, anotar la etiqueta
  exacta que usa.
- Mac [ ] Windows [ ]
- **Notas:** F23.10 Step 5 y reporte (el filtro sólo deja pasar etiquetas conocidas; una variante de rojo distinta se
  descarta hasta agregarla). Si no hay una biblia así, anotarlo.

### 9.6 Cálculos en campos numéricos (F23.11 Step 6)
- **Pasos:** en un campo numérico con stepper, escribir `1920/2` + Enter; después `abc` + Enter. Si querés, una acción
  de API `change_variable` con `1920/2` y otra con `2+`, y un timer con un texto inválido.
- **Esperado:** `1920/2` queda en `960`. `abc` vuelve al valor anterior. La acción con `1920/2` actualiza la variable a
  960; con `2+` falla sin actualizarla; el timer inválido cae a 0.
- Mac [ ] Windows [ ]
- **Notas:** F23.11 Step 6. Las pruebas de API y timer son recomendaciones del reporte, no del plan.

### 9.7 Fuente de Google (revisión final F23)
- **Pasos:** en los ajustes de fuentes, agregar una fuente de Google y usarla en una slide; mirar la consola.
- **Esperado:** la fuente se carga (sin errores de CSP hacia `fonts.googleapis.com` / `fonts.gstatic.com`) y se ve en
  la vista previa.
- Mac [ ] Windows [ ]
- **Notas:** revisión final F23 (la CSP ahora permite esos dos orígenes en `style-src` y `font-src`).

---

## 10. Decisiones pendientes (no son pasos de prueba)

1. **Versión mínima de macOS.** `src-tauri/tauri.conf.json` declara `minimumSystemVersion: "11.0"`, pero la app usa
   `color-mix()` (Safari 16.2, o sea macOS 13.1). Hay que subir el mínimo o reemplazar `color-mix`.
2. **CI intermitente en tests de video/media.** Si el CI falla de forma intermitente en tests de video o media,
   sospechar primero de los que miden tiempo (ya se corrigió `ffmpeg::position_avanza_en_tiempo_real`).
3. **"Salir" desde el Dock en macOS no guarda** (límite de tao 0.37, deuda registrada en el ROADMAP). Decidir si vale
   la pena un `applicationShouldTerminate` propio (ver 5.2).
4. **Cuentas que dejaron de funcionar (F23.11).** Por pedido del brief, `**` (potencia), `1/0` (antes `Infinity`) y
   textos como `"true"` ya no se evalúan en el stepper, el number-field, el timer y la acción de API. Decidir si se
   quiere la gramática más amplia.
5. **Fondo semitransparente (F23.16).** Si en 4.2 se ve distinto entre proyector y vista previa, decidir cuál es la
   referencia.
6. **Ítem Web `http://` (F23.12).** Sigue bloqueado por `frame-src`; decidir si se permite `http:` (ver 9.1, paso 4).
