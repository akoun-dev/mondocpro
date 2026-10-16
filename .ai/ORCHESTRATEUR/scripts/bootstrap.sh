#!/usr/bin/env bash
# bootstrap.sh — installe le squelette de gouvernance multi-agents dans un repo.
#
# Usage :
#   bash bootstrap.sh [répertoire-cible]        # défaut : répertoire courant
#
# Idempotent : ne crée que les fichiers absents, n'écrase jamais l'existant.
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${1:-$(pwd)}"
AI="$ROOT/.ai"
TPL="$KIT_DIR/templates"

echo "▶ Orchestrateur — installation dans : $ROOT"

if [ ! -d "$ROOT" ]; then
  echo "✗ Le répertoire cible n'existe pas : $ROOT" >&2
  exit 1
fi

# ——— Dossiers de gouvernance ———
mkdir -p "$AI/SPECS" "$AI/ADR" "$AI/HANDOFF" "$AI/AUDITS"
touch "$AI/SPECS/.gitkeep" "$AI/ADR/.gitkeep" "$AI/HANDOFF/.gitkeep" "$AI/AUDITS/.gitkeep"

# ——— Protocole + contexte projet ———
[ -f "$AI/PROMPT-ORCHESTRATEUR.md" ] || cp "$KIT_DIR/PROMPT-ORCHESTRATEUR.md" "$AI/PROMPT-ORCHESTRATEUR.md"
[ -f "$AI/PROJECT_CONTEXT.md" ] || cp "$TPL/PROJECT_CONTEXT.template.md" "$AI/PROJECT_CONTEXT.md"
[ -f "$AI/README.md" ] || cp "$TPL/README.ai.template.md" "$AI/README.md"
[ -f "$AI/WORKFLOWS.md" ] || cp "$TPL/WORKFLOWS.template.md" "$AI/WORKFLOWS.md"

# ——— Registres qualité (gabarit commun, préfixes dédiés) ———
gen_registre() { # $1 = nom de fichier, $2 = préfixe ID, $3 = titre
  local file="$AI/$1"
  [ -f "$file" ] && return 0
  sed -e "s|{{PREFIXE}}|$2|g" -e "s|{{Titre du problème}}|$3|g" "$TPL/registre.template.md" > "$file"
}
gen_registre "BUGS.md"        "BUG"  "Bugs fonctionnels"
gen_registre "SEC_BUGS.md"    "SEC"  "Vulnérabilités sécurité"
gen_registre "A11Y_BUGS.md"   "A11Y" "Non-conformités accessibilité (WCAG 2.1 AA)"
gen_registre "PERF_ISSUES.md" "PERF" "Dépassements de budget performance"
gen_registre "REGRESSIONS.md" "REG"  "Régressions détectées / corrigées"

# ——— Registres simples (en-tête minimal) ———
simple() { # $1 = fichier, $2 = titre, $3 = consigne
  local file="$AI/$1"
  [ -f "$file" ] && return 0
  printf '# %s\n\n> %s\n\n| Date | Entrée | Détail |\n|---|---|---|\n| _—_ | _Rien à signaler_ | _—_ |\n' "$2" "$3" > "$file"
}
simple "INCIDENTS.md"       "INCIDENTS — Incidents projet / intégrité" "Un incident = un événement ayant failli (ou réussi) casser l'intégrité du projet."
simple "DEBT_REPORT.md"     "DEBT REPORT — Dette technique"            "Chaque dette est chiffrée (effort estimé) et datée ; on ne stocke pas de dette en mémoire seule."
simple "LESSONS_LEARNED.md" "LESSONS LEARNED — Leçons durables"        "Une leçon = un piège environnemental ou procédural qu'on ne veut plus reproduire."

# ——— Documents de pilotage (en-têtes minimaux, à enrichir par le projet) ———
doc() { # $1 = fichier, $2 = titre, $3 = rôle
  local file="$AI/$1"
  [ -f "$file" ] && return 0
  printf '# %s\n\n> %s\n\n_(À compléter par le projet — le protocole complet est dans PROMPT-ORCHESTRATEUR.md.)_\n' "$2" "$3" > "$file"
}
doc "TASKS.md"             "TASKS — Suivi central des tâches"    "Tableau des tâches : ID, titre, agent, statut, preuve de complétion."
doc "API_CONTRACTS.md"     "API CONTRACTS — Contrats Front ↔ Back" "SOURCE DE VÉRITÉ : le frontend ne démarre pas tant que le contrat n'est pas écrit ici."
doc "DESIGN_SYSTEM.md"     "DESIGN SYSTEM — Langage UI"          "Tokens, composants réutilisables, patterns (cards, chips, badges, états)."
doc "ARCHITECTURE.md"      "ARCHITECTURE — Vue cible & patterns" "Couches, flux de données, conventions de dossiers."
doc "ACCESSIBILITY_GUIDE.md" "ACCESSIBILITY — Règles WCAG 2.1 AA" "Contrastes, clavier, ARIA, lecteurs d'écran."
doc "PERFORMANCE_BUDGET.md"  "PERFORMANCE — Budgets"              "Budgets chiffrés (temps de réponse, poids, re-renders) — tout dépassement va dans PERF_ISSUES.md."
doc "REQUIREMENTS.md"      "REQUIREMENTS — Exigences produit"    "Exigences fonctionnelles et non fonctionnelles de haut niveau."
doc "CHANGELOG.md"         "CHANGELOG — Historique des versions" "Une entrée par livraison validée."
doc "TEAM_STATUS.md"       "TEAM STATUS — État de l'équipe"      "Qui fait quoi maintenant ; mise à jour à chaque DÉLÉGUER / VALIDER."

# ——— Worklog (racine du repo) ———
if [ ! -f "$ROOT/worklog.md" ]; then
  cp "$TPL/worklog.template.md" "$ROOT/worklog.md"
fi

echo "✔ Squelette installé."
echo ""
echo "Prochaines étapes :"
echo "  1. Remplir .ai/PROJECT_CONTEXT.md (stack, commandes, comptes de test, pièges)."
echo "  2. Pointer l'agent sur le protocole :"
echo "     « Lis et applique .ai/PROMPT-ORCHESTRATEUR.md comme protocole de travail. »"
echo "     (ou installer .ai/PROMPT-ORCHESTRATEUR.md + SKILL.md comme skill dans votre outil)"
echo "  3. Committer : git add .ai worklog.md && git commit -m \"chore(ai): gouvernance multi-agents\""
