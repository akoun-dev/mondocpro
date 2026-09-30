#!/usr/bin/env python3
"""Génère .ai/TASKS.xlsx — fichier central de suivi du système multi-agents.
Skill xlsx — scène create (LITE), design system via templates/base.py."""
import sys, os

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from base import (  # design tokens + style factories (single source of truth)
    font_title, font_caption, fill_data_row, setup_sheet,
    style_header_row, style_data_row, align_text, NEUTRAL_900,
)

OUT = "/home/z/my-project/.ai/TASKS.xlsx"

HEADERS = [
    "ID", "Epic", "Fonctionnalité", "Sous-tâche", "Description", "Rôle Assigné",
    "Statut", "Progression", "Priorité", "Dépendance Inter-Agents", "Fichiers concernés",
    "Tests", "Résultat test", "Bugs", "Commits liés", "Review Status",
    "Date début", "Date fin", "Commentaires",
]

ROWS = [
    [
        "SYS-T01", "Système", "Analyse initiale", "Scan complet du projet",
        "Analyse complète avant toute action (règle 2) : stack, architecture, configs, baseline qualité",
        "Audit + Tech Lead", "TERMINÉ", "100%", "P0", "—",
        "Tout le dépôt (lecture seule)", "bun run lint + dev.log", "Lint 0 erreur ; GET / 200",
        "0", "—", "n/a (pré-système)", "", "", "Preuves : worklog.md Task 1",
    ],
    [
        "SYS-T02", "Système", "Gouvernance", "Dossier de pilotage .ai/",
        "Création des 38 fichiers de gouvernance (registres, handoffs, ADR, specs, audits)",
        "Doc + Tech Lead", "TERMINÉ", "100%", "P1", "SYS-T01",
        ".ai/**", "Vérification LS", "38 fichiers présents", "0", "—", "n/a (pré-système)",
        "", "", "Inclut ADR-001 (stack conservée)",
    ],
    [
        "SYS-T03", "Système", "Gouvernance", "TASKS.xlsx",
        "Fichier central de suivi (20 colonnes, miroir TASKS.md)",
        "Doc", "TERMINÉ", "100%", "P1", "SYS-T01",
        ".ai/TASKS.xlsx", "xlsx.py inspect/validate", "OK", "0", "—", "n/a (pré-système)",
        "", "", "Ce fichier",
    ],
    [
        "DESIGN-T01", "Design", "Palette médicale", "Tokens + documentation",
        "Implémentation des 9 couleurs du PO en tokens Tailwind 4 (globals.css) ; règles d'usage sémantique ; contrastes WCAG AA ; ADR-002",
        "UX/UI + Frontend + Tech Lead", "TERMINÉ", "100%", "P1", "SYS-T01",
        "src/app/globals.css · .ai/DESIGN_SYSTEM.md §1 · .ai/ADR/ADR-002",
        "lint · CSS servi (grep hex) · agent-browser computed styles",
        "Lint 0 erreur · 8/8 hex servis · tokens calculés conformes", "0",
        "feat(design)", "APPROVED (revue interne Tech Lead)", "2026-09-30", "2026-09-30",
        "Contrastes : texte blanc interdit sur success/warning",
    ],
    [
        "BUG-T01", "Qualité", "BUG-001 hydratation", "Fix layout",
        "suppressHydrationWarning sur <body> (attributs injectés par l'environnement preview : bis_status, __processed_*)",
        "DEV Frontend + QA", "TERMINÉ", "100%", "P2", "DESIGN-T01",
        "src/app/layout.tsx · .ai/BUGS.md",
        "agent-browser reload (0 erreur, console propre) · lint",
        "Lint 0 erreur · 0 erreur page", "BUG-001 corrigé",
        "fix(ui) 13d8d92", "APPROVED (revue interne Tech Lead)", "2026-09-30", "2026-09-30",
        "Cause externe confirmée (absence bis_* en headless)",
    ],
    [
        "OPS-T01", "DevOps", "Push GitHub", "Synchronisation remote",
        "Push de main vers github.com/akoun-dev/mondocpro.git (token PO one-shot, non persisté) + retrait .env/db du suivi git",
        "DEVOPS + COMMIT + Security", "TERMINÉ", "100%", "P1", "BUG-T01",
        "remote origin · .gitignore · .env (untrack) · db/custom.db (untrack)",
        "git ls-remote post-push", "Hash remote 90786c8 = local", "0",
        "chore(securite) 90786c8", "n/a (ops)", "2026-09-30", "2026-09-30",
        "SEC-ADV-001 : rotation du token conseillée (action PO)",
    ],
    [
        "OPS-T02", "DevOps", "Résilience boot", "dev.sh custom",
        "/start.sh écrase .env (file:...) à chaque cold start → flux custom .zscripts/dev.sh (restaure .env Supabase depuis .zscripts/.env.supabase non versionné, bun install, db:push, dev) + relance serveur vérifiée cross-session",
        "DEVOPS/DATA", "TERMINÉ", "100%", "P0", "DB-T01",
        ".zscripts/dev.sh · .zscripts/.env.supabase (non versionné)",
        "curl 200 cross-session · Caddy :81 200 · test_db SELECT 1",
        "200 · 200 · OK", "0",
        "chore(devops)", "n/a (ops)", "2026-09-30", "2026-09-30",
        "Secrets protégés (.gitignore .env*) ; flux boot validé",
    ],
    [
        "DB-T01", "Data", "Supabase PostgreSQL", "Migration BDD",
        "Provider prisma sqlite→postgresql ; pooler Supavisor IPv4 (host direct IPv6-only) ; région aws-1-eu-west-1 découverte par auth réelle ; schéma User/Post synchronisé ; scripts db:* blindés ; secrets en .env non versionné",
        "DEVOPS/DATA + Tech Lead + Security", "TERMINÉ", "100%", "P1", "OPS-T01",
        "prisma/schema.prisma · .env · package.json · .ai/ADR/ADR-003",
        "Roundtrip Prisma SELECT 1 · REST /rest/v1/User · GET / post-restart",
        "Roundtrip OK · REST 200 [] · lint 0 erreur", "0",
        "feat(data)", "APPROVED (revue interne Tech Lead)", "2026-09-30", "2026-09-30",
        "ADR-003 · SEC-ADV-002 : rotation secrets Supabase conseillée · migrations versionnées avant PROD",
    ],
    [
        "OPS-T03", "DevOps", "Config locale reproductible", "Modèle .env.example",
        ".env.example versionné (placeholders uniquement, zéro secret — scan avant commit) + exception .gitignore !.env.example ; instructions pas-à-pas de configuration locale Supabase (cp .env.example .env → db:push → dev)",
        "DEVOPS + Doc + Security", "TERMINÉ", "100%", "P1", "DB-T01",
        ".env.example · .gitignore",
        "Scan anti-secret · git check-ignore (.env/.env.supabase toujours ignorés) · lint",
        "0 secret · tracking OK · lint 0 erreur", "0",
        "chore(env)", "n/a (ops)", "2026-09-30", "2026-09-30",
        "SEC-ADV-002 reste ouverte (rotation secrets = action PO)",
    ],
    [
        "—", "Backlog", "—", "En attente de demandes utilisateur",
        "Aucune feature métier demandée à ce jour ; le backlog sera alimenté par le PO (utilisateur)",
        "—", "À FAIRE", "0%", "—", "—", "—", "—", "—", "—", "—", "—", "", "",
        "Feature Lifecycle (WORKFLOWS.md) appliqué à chaque demande",
    ],
]

wb = Workbook()
ws = wb.active
ws.title = "TASKS"

last_col = 1 + len(HEADERS)  # données à partir de la colonne B (Canvas Origin B2)
setup_sheet(ws, title="Suivi central des tâches — Système Multi-Agents", last_col=last_col)

# En-têtes (ligne 4)
for i, h in enumerate(HEADERS, start=2):
    ws.cell(row=4, column=i, value=h)
style_header_row(ws, 4, 2, last_col)

# Données (ligne 5+)
for r, row in enumerate(ROWS, start=5):
    for c, val in enumerate(row, start=2):
        cell = ws.cell(row=r, column=c, value=val)
        cell.alignment = align_text()
    style_data_row(ws, r, 2, last_col, r - 5)

# Notes (2 lignes sous les données)
notes_row = 5 + len(ROWS) + 2
note = ws.cell(row=notes_row, column=2,
               value="Statuts : À FAIRE → EN COURS → EN REVUE → TEST QA → TERMINÉ (ou BLOQUÉ). "
                     "Intégrité : tout statut avancé exige une preuve (commit, revue, test, audit).")
note.font = font_caption()
note2 = ws.cell(row=notes_row + 1, column=2,
                value="Règles de blocage : Frontend bloqué sans contrat API validé · PROD bloquée "
                      "sans audit global ≥ 60/100 · FRONTEND TERMINÉ exige a11y + perf validés.")
note2.font = font_caption()

# Largeurs de colonnes (lisibles, ajustées au contenu type)
widths = [10, 14, 20, 24, 46, 18, 12, 12, 9, 24, 26, 22, 26, 8, 14, 18, 12, 12, 34]
ws.column_dimensions["A"].width = 2
for i, w in enumerate(widths, start=2):
    ws.column_dimensions[get_column_letter(i)].width = w

ws.freeze_panes = "C5"
ws.auto_filter.ref = f"B4:{get_column_letter(last_col)}{4 + len(ROWS)}"

wb.properties.creator = "Z.ai"
wb.save(OUT)
print("OK —", OUT)
