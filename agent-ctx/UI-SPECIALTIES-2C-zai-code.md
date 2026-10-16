# UI-SPECIALTIES-2C — Z.ai Code

Task: Redesign de la vue admin « Spécialités » (`src/components/admin/specialties-view.tsx`) selon la maquette PO (`upload/pasted_image_1792162791249.png`), langage visuel validé UI-MISSIONS-1 / UI-PATIENTS-1.

## Fichiers modifiés (périmètre strict)

- `src/components/admin/specialties-view.tsx` (507 → ~880 lignes) — SEUL fichier touché.
- `worklog.md` — entrée UI-SPECIALTIES-2C ajoutée en fin de fichier (comme exigé par la tâche).

## Rendu implémenté

1. **Cartes de synthèse** (grid-cols-3 gap-2, boutons aria-pressed, toggle pattern Missions) :
   - Total : Rows3, `border-primary/30 bg-primary/10`, texte primary ;
   - Actives : CircleCheck, success (`text-success-foreground dark:text-success`) ;
   - Inactives : Pause, muted (`border-border bg-muted/40`, texte muted-foreground).
   - Compteurs calculés sur la liste chargée (hors recherche — pattern Patients).
2. **Encart d'ajout** : label uppercase `text-[10px] font-bold uppercase tracking-wide` « Ajouter une spécialité au catalogue » ; form flex gap-2 ; Input pill `h-11 rounded-full bg-card pl-10` + Stethoscope absolu gauche, placeholder « Ex. : Dermatologie, Neurologie… » ; bouton primary `h-11 rounded-full px-4 text-sm font-bold` (Loader2 si adding). NAME_MAX=80 + validation min 2 + toasts POST conservés.
3. **Recherche pillée** (pattern patients-view) : filtre CLIENT `name.toLowerCase().includes(query)`, bouton X d'effacement, placeholder « Filtrer par titre de spécialité… ».
4. **Chips + tri** : chips scrollables `-mx-4 … [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, role=group aria-label « Filtrer par état », chip actif `bg-foreground text-background`, compteur pill `rounded-full px-1.5 py-px text-[10px] font-bold` (bg-background/20 sinon bg-muted) ; Select pill à droite (ArrowDownUp, `h-8 w-auto rounded-full border-primary/20 bg-primary/10 text-[11px] font-bold text-primary`) : « Ordre d'affichage » = sortOrder croissant (défaut) / « Nom (A-Z) » = localeCompare fr.
5. **Items** (li `rounded-2xl border bg-card p-4 shadow-sm`) : grip GripVertical décoratif ; pastille RONDE `size-10 rounded-full text-white` teinte déterministe (copie AVATAR_CLASSES/avatarClass de patients-view) + Stethoscope blanc ; nom gras min-w-0 wrap (PAS de truncate, anti-débordement UI-PATIENTS-1) ; badge « Active » (success/15 dark:text-success) / « Inactive » (muted) ; **Switch shadcn** (`src/components/ui/switch.tsx` EXISTE — vérifié) → PATCH isActive, disabled si busy, aria-label « Désactiver/Activer {nom} » ; sous-ligne « Ordre d'affichage : {sortOrder} » ; actions bas `border-t pt-3 mt-3 flex flex-wrap gap-1.5` : Renommer (Pencil, inline conservé à l'identique), Désactiver/Activer (Power, même handler PATCH que le Switch — la maquette affiche les deux), Supprimer (Trash2 destructive → AlertDialog existant).
6. **États** : skeletons (2 cartes synthèse + 3 items), erreur + Réessayer, catalogue vide (bloc Stethoscope existant conservé), filtre sans résultat (« Aucune spécialité ne correspond à ce filtre. » en dashed muted/40). Pas de titre dans la vue (shell « Spécialités / … »).

## Logique préservée (intégralement)

- `loadAll` (GET /api/admin/specialties), `handleAdd` (POST 201), `patchSpecialty` (PATCH /:id — name | isActive), `handleDelete` (DELETE 204), AlertDialog de confirmation (409 RDV rattachés → toast), tous les toasts et garde-fous (NAME_MAX, longueur min 2).

## Notes / décisions

- La capture PNG n'était pas affichable dans le contexte sous-agent → rendu construit sur la spécification écrite PO (élément par élément) + patterns missions/patients.
- **Pas de drag & drop** : le grip est décoratif — aucune API de réordonnancement n'existe (PATCH n'accepte que name/isActive).
- **Compteur « soignants » non affiché** : aucun modèle de rattachement soignant↔spécialité en base — ne pas inventer de données.
- Root `flex flex-col gap-4`, style 4 espaces / sans point-virgules / double quotes.

## Vérifications

- `bun run lint` → 0 erreur / 0 warning.
- `bunx tsc --noEmit` → 0 erreur sur specialties-view.tsx (erreurs préexistantes ailleurs : examples/, scripts/, src/lib/tokens.ts, src/lib/admin-users.ts — hors périmètre).
- dev.log : aucune erreur de compilation liée à la vue.

## Suggestions pour l'orchestrateur

1. Vérif visuelle à relancer (clair/sombre + mobile 390 px + états vide/erreur/filtre) — dev-server/captures interdits dans ce périmètre.
2. Si le PO veut le drag & drop : prévoir un endpoint de réordonnancement + sortOrder éditable côté API.
3. Si le PO veut le compteur « soignants » : étendre le contrat GET admin avec un agrégat (nécessite un modèle de rattachement en base).
