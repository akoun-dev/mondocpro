-- Feature « Annuaire admin » — activation / désactivation de comptes.
-- Le modèle User n'avait aucun champ d'état : le Médecin Chef ne pouvait ni
-- sortir un infirmier de l'effectif ni suspendre un dossier patient.
--
-- `isActive` porte la décision (pas un `disabledAt` : on veut savoir QUEL
-- compte est désactivé, pas seulement depuis quand il ne l'est plus).
--
-- Vrai par défaut : tous les comptes déjà en base restent actifs, la migration
-- ne verrouille personne.

alter table public.users
    add column "isActive" boolean not null default true;

comment on column public.users."isActive" is
    'Compte actif. false = compte suspendu par le Médecin Chef : connexion et sessions refusees par src/lib/auth.ts.';

-- Index partiel : les seules lignes que les vues admin consultent en priorité
-- sont les comptes actifs, et les tris de l'annuaire les filtrent par rôle.
create index "users_role_is_active_idx"
    on public.users ("role", "isActive");