#!/bin/zsh
set -e

cd "$(dirname "$0")/.."

PNPM="/Users/Apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"

if [ ! -x "$PNPM" ]; then
  echo "pnpm introuvable: $PNPM"
  echo "Installe pnpm ou adapte le chemin dans scripts/start-web.command."
  read -r "?Appuie sur Entree pour fermer..."
  exit 1
fi

echo "Demarrage de Digital CIP sur http://localhost:3000"
echo "Garde cette fenetre ouverte pendant l'utilisation de l'application."
echo

"$PNPM" --filter @digital-cip/web dev --hostname 127.0.0.1 --port 3000
