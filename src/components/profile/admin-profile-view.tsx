"use client";

// Vue « Profil » du Médecin Chef (ADMIN) — Task 35, redesign maquette PO
// (« Mon profil » : héros en carte avec statut de supervision, informations
// du compte groupées dans une carte à rangées, apparence en contrôle
// segmenté, préférences, urgences). Même langage visuel que les vues admin
// redessinées (cartes rounded-2xl border bg-card shadow-sm, pastilles
// ambre, badges de rôle doux). Spécifique Médecin Chef :
//   - carte « Activité de supervision » : statistiques RÉELLES issues de
//     /api/admin/recharges (file de validation) et /api/admin/missions
//     (dispatch + suivi) — carte masquée si les API échouent ;
//   - « Informations du compte » : naissance (dialog partagé
//     ProfileIdentityDialog), mobile vérifié (JAMAIS éditable — identifiant
//     de connexion, invariant FEATURE-PROFIL Task 22/23), secteur
//     d'intervention (dialog partagé ProfileZoneDialog) et sécurité
//     (changement de mot de passe FONCTIONNEL, POST
//     /api/auth/change-password — socle PasswordChangeDialog réutilisé) ;
//   - confidentialité médicale renforcée : accès supervisé aux dossiers
//     patients (loi n° 2013-430).
import { useEffect, useState, type ReactNode } from "react";
import {
  Ambulance,
  Cake,
  ChevronRight,
  CircleCheck,
  Flame,
  LockKeyhole,
  MapPin,
  Megaphone,
  Pencil,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FlagCI } from "@/components/auth/ci-flag";
import { PasswordChangeDialog } from "@/components/auth/password-change-dialog";
import { ThemeChoice } from "@/components/theme/theme-choice";
import { ProfileIdentityDialog, ProfileZoneDialog } from "@/components/profile/profile-edit-dialogs";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, type AppUser } from "@/stores/auth-store";
import { ZONE_LABELS, ZONES } from "@/lib/auth-schemas";
import { formatDateUTC } from "@/lib/datetime";
import { formatPhoneDisplay } from "@/lib/phone";
import { getInitials } from "@/lib/utils";

type Props = {
  user: AppUser;
  onLogout: () => void;
};

// Statistiques de supervision — contrats GET /api/admin/recharges (pending /
// processed) et GET /api/admin/missions (dispatchQueue / missions, Task 35).
type AdminStats = {
  rechargesPending: number;
  rechargesProcessed: number;
  toDispatch: number;
  activeMissions: number;
  completedMissions: number;
};

function useAdminStats(): AdminStats | null {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rechargesRes, missionsRes] = await Promise.all([
          fetch("/api/admin/recharges", { cache: "no-store" }),
          fetch("/api/admin/missions", { cache: "no-store" }),
        ]);
        if (!rechargesRes.ok || !missionsRes.ok) return;
        const recharges = (await rechargesRes.json()) as {
          pending?: unknown[];
          processed?: unknown[];
        };
        const board = (await missionsRes.json()) as {
          dispatchQueue?: unknown[];
          missions?: Array<{ status: string }>;
        };
        if (cancelled) return;
        const missions = board.missions ?? [];
        setStats({
          rechargesPending: recharges.pending?.length ?? 0,
          rechargesProcessed: recharges.processed?.length ?? 0,
          toDispatch: board.dispatchQueue?.length ?? 0,
          activeMissions: missions.filter((m) =>
            ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(m.status),
          ).length,
          completedMissions: missions.filter((m) => m.status === "COMPLETED")
            .length,
        });
      } catch {
        // silencieux : la carte activité n'est pas critique
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

// ——— Primitives locales (maquette « Mon profil ») ———

// Titre de section : libellé court UPPERCASE (maquette « INFORMATIONS DU
// COMPTE », « APPARENCE »…) avec action facultative à droite.
function SectionLabel({
  id,
  children,
  action,
}: {
  id: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3
        id={id}
        className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        {children}
      </h3>
      {action}
    </div>
  );
}

// Rangée d'information DANS la carte groupée (divide-y) : icône en pastille
// carrée, libellé + valeur (+ sous-ligne facultative), accessoire à droite.
function InfoListRow({
  icon: Icon,
  label,
  value,
  sub,
  valueMuted,
  accessory,
  onClick,
  actionLabel,
}: {
  icon: typeof CircleCheck;
  label: string;
  value: ReactNode;
  sub?: string;
  valueMuted?: boolean;
  accessory: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span
          className={`mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold ${valueMuted ? "font-medium text-muted-foreground" : ""}`}
        >
          {value}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {accessory}
    </>
  );
  if (!onClick) {
    return <div className="flex items-center gap-3 p-4">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel ?? label}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {inner}
    </button>
  );
}

export function AdminProfileView({ user, onLogout }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const stats = useAdminStats();

  const [editOpen, setEditOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [prefSaving, setPrefSaving] = useState<"healthAlerts" | null>(null);

  const memberSince = `Membre depuis le ${formatDateUTC(user.createdAt)}`;
  const zoneCount = Object.values(ZONES).length;

  // Préférences — maj optimiste persistée (même modèle que patient/infirmier).
  // Seule « Alertes de santé locales » est proposée au Médecin Chef : les
  // rappels de RDV (appointmentReminders) ciblent les patients, un
  // interrupteur inerte serait trompeur ici.
  async function updatePreference(key: "healthAlerts", value: boolean) {
    const previous = user[key];
    const label = "Alertes de santé locales";
    setPrefSaving(key);
    setUser({ ...user, [key]: value });
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(`PATCH ${key} → ${res.status}`);
      const data = (await res.json()) as { user: AppUser };
      setUser(data.user);
      toast({
        title: value ? `${label} activées` : `${label} désactivées`,
        description: value
          ? "Vous recevrez les notifications correspondantes."
          : "Vous ne recevrez plus ces notifications.",
      });
    } catch {
      setUser({ ...user, [key]: previous });
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description: "La préférence n'a pas pu être enregistrée — réessayez.",
      });
    } finally {
      setPrefSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Héro en carte : avatar, nom + badge rôle, secteur, statut de
          supervision (maquette : grande pastille DK + rangée d'état) */}
      <section
        aria-labelledby="profil-hero-admin"
        className="rounded-2xl border bg-card p-6 shadow-sm"
      >
        <h2 id="profil-hero-admin" className="sr-only">
          Mon profil
        </h2>
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="relative">
            <span
              aria-hidden="true"
              className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary-dark text-3xl font-bold text-primary-foreground shadow-md shadow-primary/20"
            >
              {getInitials(user.fullName)}
            </span>
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-success ring-2 ring-card"
            >
              <CircleCheck className="size-4.5 text-success-foreground" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xl font-bold tracking-tight">
                {user.fullName}
              </span>
              <span
                className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-bold text-warning-foreground dark:text-warning"
                aria-label="Rôle : Médecin Chef"
              >
                <ShieldCheck className="size-3" aria-hidden="true" />
                Médecin Chef
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {ZONE_LABELS[user.zone]}, Abidjan
              <span aria-hidden="true">·</span>
              <span suppressHydrationWarning>{memberSince}</span>
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold">
            <span
              className="size-2 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            Supervision active
          </span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-primary">
            Coordination · {zoneCount} zones
          </span>
        </div>
      </section>

      {/* Activité de supervision — statistiques réelles (masquée si échec API) */}
      {stats ? (
        <section aria-labelledby="profil-activite-admin">
          <SectionLabel id="profil-activite-admin">
            Activité de supervision
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { value: stats.rechargesPending, label: "Recharges à valider" },
              { value: stats.toDispatch, label: "RDV à affecter" },
              { value: stats.activeMissions, label: "Missions actives" },
              { value: stats.rechargesProcessed, label: "Recharges traitées" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col items-center gap-0.5 rounded-2xl border bg-card p-4 text-center shadow-sm"
              >
                <span className="text-2xl font-extrabold tabular-nums tracking-tight text-primary">
                  {tile.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tile.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Informations du compte — carte groupée : naissance (dialog partagé),
          mobile vérifié (JAMAIS éditable), secteur, sécurité (maquette :
          4 rangées dans une même carte, action « Modifier » en tête) */}
      <section aria-labelledby="profil-infos-admin">
        <SectionLabel
          id="profil-infos-admin"
          action={
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Modifier mes informations"
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Modifier
            </button>
          }
        >
          Informations du compte
        </SectionLabel>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card shadow-sm">
          <InfoListRow
            icon={Cake}
            label="Date de naissance"
            value={
              user.birthDate ? (
                <span suppressHydrationWarning>
                  {formatDateUTC(user.birthDate)}
                </span>
              ) : (
                "Non renseignée"
              )
            }
            valueMuted={!user.birthDate}
            accessory={
              <Pencil
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={() => setEditOpen(true)}
            actionLabel="Modifier la date de naissance"
          />
          <InfoListRow
            icon={Smartphone}
            label="Numéro de mobile actif"
            value={
              <>
                <FlagCI />
                {formatPhoneDisplay(user.phone)}
              </>
            }
            accessory={
              <CircleCheck
                className="size-5 shrink-0 text-success"
                aria-label="Numéro vérifié"
              />
            }
          />
          <InfoListRow
            icon={MapPin}
            label="Secteur d'intervention & Rayon"
            value={ZONE_LABELS[user.zone]}
            accessory={
              <Pencil
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={() => setZoneOpen(true)}
            actionLabel="Modifier le secteur d'intervention"
          />
          <InfoListRow
            icon={LockKeyhole}
            label="Sécurité & Authentification"
            value="Mot de passe du compte"
            sub="Vérification active · Mot de passe actuel requis"
            accessory={
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={() => setPasswordOpen(true)}
            actionLabel="Modifier le mot de passe"
          />
        </div>
        {/* Confidentialité médicale — accès supervisé (loi ivoirienne) */}
        <div className="mt-2.5 flex items-start gap-3 rounded-2xl bg-success-light p-4">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-success-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-bold text-success-foreground">
              Confidentialité médicale
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              En tant que Médecin Chef, vous accédez aux dossiers et
              paiements des patients dans le seul intérêt de leur suivi.
              Cette accès est protégé selon la loi ivoirienne
              n°&nbsp;2013-430 du 14 mai 2013 relative à la protection des
              données à caractère personnel.
            </p>
          </div>
        </div>
      </section>

      {/* Apparence — FEATURE-DARK-MODE (Task 37) : contrôle segmenté
          Système / Clair / Sombre (maquette), persisté par utilisateur */}
      <section aria-labelledby="profil-apparence-admin">
        <SectionLabel id="profil-apparence-admin">Apparence</SectionLabel>
        <ThemeChoice />
      </section>

      {/* Préférences & Alertes — interrupteur persisté (PATCH profil) */}
      <section aria-labelledby="profil-preferences-admin">
        <SectionLabel id="profil-preferences-admin">
          Préférences &amp; Alertes
        </SectionLabel>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Megaphone className="size-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Alertes de santé locales
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              Vaccinations, épidémies, urgences INHP
            </span>
          </span>
          <Switch
            checked={user.healthAlerts}
            disabled={prefSaving !== null}
            onCheckedChange={(checked) =>
              updatePreference("healthAlerts", checked)
            }
            aria-label="Alertes de santé locales"
          />
        </div>
      </section>

      {/* Urgences Médicales Abidjan — numéros réels, appel direct */}
      <section
        aria-labelledby="profil-urgences-admin"
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3
            id="profil-urgences-admin"
            className="flex items-center gap-1.5 text-sm font-bold text-destructive"
          >
            <span
              className="size-2 rounded-full bg-destructive"
              aria-hidden="true"
            />
            Urgences Médicales Abidjan
          </h3>
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            24h/24 • 7j/7
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a
            href="tel:185"
            className="flex items-center justify-center gap-1.5 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ambulance className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span className="whitespace-nowrap text-[13px] font-semibold">SAMU :</span>
            <span className="text-sm font-extrabold text-destructive">185</span>
          </a>
          <a
            href="tel:180"
            className="flex items-center justify-center gap-1.5 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Flame className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span className="whitespace-nowrap text-[13px] font-semibold">Pompiers :</span>
            <span className="text-sm font-extrabold text-destructive">180</span>
          </a>
        </div>
      </section>

      <Button
        variant="outline"
        onClick={onLogout}
        className="mt-1 h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto sm:self-start"
      >
        Se déconnecter
      </Button>

      {/* Dialogs d'édition — socle partagé patient/infirmier/admin */}
      <ProfileIdentityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
      />
      <ProfileZoneDialog
        open={zoneOpen}
        onOpenChange={setZoneOpen}
        user={user}
        description="Sélectionnez votre secteur d'intervention dans la liste."
        fieldLabel="Secteur d'intervention"
        successDescription={(zone) =>
          `Votre secteur d'intervention est désormais ${ZONE_LABELS[zone]}.`
        }
      />
      <PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
