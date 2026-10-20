#!/usr/bin/env bash
# ----- PulseFlow -----
# Corre un carril del plan de noche (docs/PLAN-NOCHE.md) con `opencode run` y lo
# relanza solo cuando el agente se corta (límite del modelo, error, fin de sesión),
# hasta que el informe del carril termine con una línea "TERMINADO".
#
# Cada intento es una sesión NUEVA que retoma desde git log + ROADMAP + informe
# (no se usa --continue: todas las carpetas de worktree son el mismo proyecto para
# opencode y "la última sesión" podría ser la de otro carril).
#
# Uso (desde cualquier carpeta):
#   scripts/carril.sh <carpeta> <informe> "<línea del carril>"
# Ejemplo:
#   scripts/carril.sh ../PulseFlow-ui docs/informes/ui.md "Carril D — Interfaz. Tareas en orden: ..."
#
# Variables opcionales:
#   MODELO=opencode/big-pickle  ESPERA=600 (segundos entre intentos)  MAX=60 (intentos)

set -u

DIR="${1:?carpeta del carril}"
INFORME="${2:?ruta del informe, relativa a la carpeta}"
CARRIL="${3:?línea del carril (ver docs/PLAN-NOCHE.md)}"
MODELO="${MODELO:-opencode/big-pickle}"
ESPERA="${ESPERA:-600}"
MAX="${MAX:-60}"

PROMPT="Leé completos: AGENTS.md, docs/ROADMAP.md (fases F10 y F11), docs/design/pantallas-y-looks.md y docs/PLAN-NOCHE.md. Vas a trabajar sin supervisión siguiendo las \"Reglas de la noche\" de PLAN-NOCHE.md. Estás en el carril indicado abajo: trabajás SOLO en esta carpeta y en tu rama actual, y sólo tocás los archivos que la tabla de carriles dice que son tuyos (más los compartidos con sus reglas). Para usar la app, respetá el lock de \"Compartir la app\". Puede que este carril ya se haya empezado en una sesión anterior que se cortó: antes de hacer nada, mirá git status, git log, los checkboxes de docs/ROADMAP.md y tu informe para saber qué ya está hecho, commiteá lo que haya quedado sin commitear si está bien, y retomá desde ahí. Cuando termines TODAS las tareas de tu carril, escribí el resumen final en tu informe, agregá al final una línea que diga exactamente TERMINADO, commiteá y pusheá. ${CARRIL}"

cd "$DIR" || { echo "No existe la carpeta $DIR"; exit 1; }

terminado() { tail -n 3 "$INFORME" 2>/dev/null | grep -q "^TERMINADO$"; }

for ((i = 1; i <= MAX; i++)); do
    if terminado; then
        echo "[carril] $(date '+%H:%M') terminado ($INFORME)"
        exit 0
    fi
    echo "[carril] $(date '+%H:%M') intento $i/$MAX en $DIR"
    opencode run --auto -m "$MODELO" --title "carril $(basename "$DIR") #$i" "$PROMPT"
    if terminado; then
        echo "[carril] $(date '+%H:%M') terminado ($INFORME)"
        exit 0
    fi
    echo "[carril] $(date '+%H:%M') se cortó sin TERMINADO; reintento en ${ESPERA}s"
    sleep "$ESPERA"
done

echo "[carril] se agotaron los $MAX intentos sin TERMINADO"
exit 1
