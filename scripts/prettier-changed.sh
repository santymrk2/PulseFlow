#!/usr/bin/env bash
# F13.1: chequea Prettier sólo en los archivos de `src/` que cambian respecto de la base.
# El backlog de formato heredado no bloquea; lo que se toca tiene que quedar formateado.
#
# Uso: scripts/prettier-changed.sh <commit-base>
#   - PR:   github.event.pull_request.base.sha
#   - push: github.event.before
# Sin base (o con una base de ceros, push inicial de una rama) usa `origin/main`.
set -euo pipefail

BASE="${1:-}"
if [ -z "$BASE" ] || [[ "$BASE" =~ ^0+$ ]]; then
    BASE="origin/main"
fi
# punto de partida común: lo que cambió esta rama, no lo que cambió la base
# (un `before` inalcanzable —force push— cae a origin/main)
FORK_POINT="$(git merge-base "$BASE" HEAD 2>/dev/null || git merge-base origin/main HEAD)"

FILES="$(git diff --name-only --diff-filter=ACMR "$FORK_POINT" -- src | grep -E '\.(ts|js|svelte|css|json)$' || true)"
if [ -z "$FILES" ]; then
    echo "Prettier: no hay archivos de src/ cambiados."
    exit 0
fi

echo "Prettier sobre $(echo "$FILES" | wc -l | tr -d ' ') archivo(s) cambiado(s):"
echo "$FILES"
# shellcheck disable=SC2086
bunx prettier --config config/formatting/.prettierrc.yaml --check $FILES
