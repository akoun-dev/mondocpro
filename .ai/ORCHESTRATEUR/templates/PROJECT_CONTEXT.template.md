# PROJECT_CONTEXT — {{NOM_PROJET}}

> À remplir après bootstrap. L'orchestrateur lit ce fichier à chaque SCAN.
> Chaque champ élimine une question qu'il aurait fallu poser (ou deviner) plus tard.

## 1. Identité

- **Nom** : {{NOM_PROJET}}
- **Objectif produit** : {{UNE_PHRASE}}
- **Langue de l'interface / des commits** : {{FR|EN|…}}
- **Fuseau de référence** : {{TZ, ex. Africa/Abidjan}}

## 2. Stack

- **Framework** : {{Next.js 16 App Router / …}}
- **Langage** : {{TypeScript 5}}
- **UI** : {{Tailwind CSS 4 + shadcn/ui (New York) + lucide-react}}
- **Données** : {{Prisma + PostgreSQL/SQLite + hôte (Supabase…)}}
- **État** : {{Zustand (client) / TanStack Query (serveur)}}
- **Auth** : {{mécanisme + rôles}}
- **Autres** : {{Capacitor, recharts, framer-motion…}}

## 3. Commandes

| Usage | Commande |
|---|---|
| Dev server (background, port `{{3000}}`) | `{{bun run dev}}` |
| Lint | `{{bun run lint}}` |
| DB push (après modif schéma) | `{{bun run db:push}}` |
| Client DB | `{{import { db } from '@/lib/db'}}` |
| Emplacement schéma | `{{prisma/schema.prisma}}` |
| Snapshot / persistance (sandbox) | `{{tar -cf /chemin/repo.tar …}}` |
| Logs dev | `{{dev.log}}` |

## 4. Pièges d'environnement (leçons apprises)

- {{ex. : le script de démarrage écrase .env → utiliser scripts/dev-boot.sh}}
- {{ex. : les process de test doivent vivre dans une seule commande bash (session reaper)}}
- {{ex. : registry miroir → valider les versions de lock contre registry.npmjs.org}}

## 5. Comptes de test / fixtures

| Rôle | Identifiants | Notes |
|---|---|---|
| {{admin}} | `{{téléphone / email}}` | {{mot de passe dans scripts/reset-… ; jamais en clair dans un commit}} |
| {{utilisateur}} | `{{…}}` | {{…}} |

**Règle** : aucune écriture métier en base pendant la vérification navigateur.

## 6. Glossaire métier & entités

- {{Entité 1}} : {{définition, invariants}}
- {{Entité 2}} : {{…}}

## 7. Conventions spécifiques du projet

- {{ex. : badges par zone, avatars initiales à couleur hashée, format d'heure UTC}}
- {{ex. : design tokens des maquettes PO (cards rounded-2xl, chips rounded-full, variante ambre)}}
- {{…}}

## 8. Livraison

- **Branche principale** : `{{main}}`
- **Remote** : `{{origin URL}}`
- **Déploiement** : {{Vercel auto sur push / autre}}
- **Seuils** : lint 0 erreur ; audit global {{60/100}} ; budgets perf cf. `.ai/PERFORMANCE_BUDGET.md`
