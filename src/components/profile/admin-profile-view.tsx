"use client";

// Vue « Profil » du Médecin Chef (ADMIN) — Task 35.
// Même langage visuel que les vues profil patient (maquette PO 2026-10-03) et
// infirmier (Task 34) : héro avatar + nom + badge rôle, sections en InfoRow,
// bandeau conformité, urgences Abidjan. Spécifique Médecin Chef :
//   - carte « Activité de supervision » : statistiques RÉELLES issues de
//     /api/admin/recharges (file de validation) et /api/admin/missions
//     (dispatch + suivi) — carte masquée si les API échouent ;
//   - « Informations du compte » : nom, date de naissance (dialog partagé
//     ProfileIdentityDialog), mobile vérifié, secteur d'habitation (dialog
//     partagé ProfileZoneDialog) — le téléphone n'est JAMAIS éditable
//     (identifiant de connexion, invariant FEATURE-PROFIL Task 22/23) ;
//   - « Sécurité & Accès » : changement de mot de passe FONCTIONNEL
//     (POST /api/auth/change-password — rôle-agnostique Task 34, socle
//     PasswordChangeDialog réutilisé tel quel) ;
//   - confidentialité médicale renforcée : accès supervisé aux dossiers
//     patients (loi n° 2013-430).
import { useEffect, useState } from "react";
import {
  Ambulance,
  Cake,
  ChevronRight,
  CircleCheck,
  Coins,
  ExternalLink,
  Flame,
  Globe,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  Megaphone,
  Pencil,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlagCI } from "@/components/auth/ci-flag";
import { PasswordChangeDialog } from "@/components/auth/password-change-dialog";
import { ProfileIdentityDialog, ProfileZoneDialog } from "@/components/profile/profile-edit-dialogs";
import {
  InfoRow,
  PreferenceRow,
  ProfileSectionTitle,
  soonToast,
} from "@/components/profile/profile-primitives";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, type AppUser } from "@/stores/auth-store";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { formatDateUTC, relativePublishedLabel } from "@/lib/datetime";
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

export function AdminProfileView({ user, onLogout }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const stats = useAdminStats();

  const [editOpen, setEditOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [prefSaving, setPrefSaving] = useState<"healthAlerts" | null>(null);

  const memberSince = `Membre · ${relativePublishedLabel(user.createdAt)}`;

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
      {/* Héro : avatar + nom + badge rôle + pastille zone (style patient) */}
      <div className="flex flex-col items-center gap-2.5 pt-1 text-center">
        <div className="relative">
          <span
            aria-hidden="true"
            className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-primary-foreground shadow-md shadow-primary/20"
          >
            {getInitials(user.fullName)}
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-success ring-2 ring-card"
          >
            <CircleCheck className="size-4 text-success-foreground" />
          </span>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              {user.fullName}
            </h2>
            <Badge
              className="bg-warning text-warning-foreground"
              aria-label="Rôle : Médecin Chef"
            >
              <ShieldCheck className="size-3" aria-hidden="true" />
              Médecin Chef
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" />
            {ZONE_LABELS[user.zone]}
            <span aria-hidden="true">·</span>
            <span suppressHydrationWarning>{memberSince}</span>
          </p>
        </div>
      </div>

      {/* Activité de supervision — statistiques réelles (masquée si échec API) */}
      {stats ? (
        <section aria-labelledby="profil-activite-admin">
          <ProfileSectionTitle id="profil-activite-admin">
            Activité de supervision
          </ProfileSectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { value: stats.rechargesPending, label: "Recharges à valider" },
              { value: stats.toDispatch, label: "RDV à affecter" },
              { value: stats.activeMissions, label: "Missions actives" },
              { value: stats.rechargesProcessed, label: "Recharges traitées" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/60 p-4 text-center"
              >
                <span className="text-xl font-extrabold tracking-tight text-primary">
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

      {/* Informations du compte — nom + naissance éditables (dialogs partagés) */}
      <section aria-labelledby="profil-infos-admin">
        <ProfileSectionTitle
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
        </ProfileSectionTitle>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            icon={Cake}
            label="Date de naissance"
            value={
              user.birthDate ? formatDateUTC(user.birthDate) : "Non renseignée"
            }
            valueMuted={!user.birthDate}
            accessory={
              <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            }
            onClick={() => setEditOpen(true)}
            actionLabel="Modifier mes informations (nom et date de naissance)"
          />
          <InfoRow
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
          <InfoRow
            icon={MapPin}
            label="Secteur d'habitation"
            value={ZONE_LABELS[user.zone]}
            accessory={
              <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            }
            onClick={() => setZoneOpen(true)}
            actionLabel="Modifier le secteur d'habitation"
          />
          <InfoRow
            icon={Coins}
            label="Portefeuille central des recharges"
            value="Rapprochement des paiements patients"
            accessory={
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            }
            onClick={() => soonToast("Le raccourci portefeuille")}
            actionLabel="Rappel du circuit des recharges (à venir)"
          />
        </div>
      </section>

      {/* Sécurité & Accès — mot de passe FONCTIONNEL (contrat Task 34, rôle-agnostique) */}
      <section aria-labelledby="profil-securite-admin">
        <ProfileSectionTitle id="profil-securite-admin">
          Sécurité &amp; Accès
        </ProfileSectionTitle>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            icon={LockKeyhole}
            label="Modifier le mot de passe"
            value="Par vérification du mot de passe actuel"
            accessory={
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            }
            onClick={() => setPasswordOpen(true)}
            actionLabel="Modifier le mot de passe"
          />
          <div className="flex items-start gap-3 rounded-xl bg-success-light p-4">
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
        </div>
      </section>

      {/* Préférences & Alertes — interrupteur persisté (PATCH profil) */}
      <section aria-labelledby="profil-preferences-admin">
        <ProfileSectionTitle id="profil-preferences-admin">
          Préférences &amp; Alertes
        </ProfileSectionTitle>
        <div className="flex flex-col gap-2.5">
          <PreferenceRow
            icon={Megaphone}
            title="Alertes de santé locales"
            description="Campagnes de vaccination, gestes santé"
            switchLabel="Alertes de santé locales"
            checked={user.healthAlerts}
            disabled={prefSaving !== null}
            onCheckedChange={(checked) =>
              updatePreference("healthAlerts", checked)
            }
          />
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Globe className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                Langue de l&apos;interface
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Français (Côte d&apos;Ivoire)
              </span>
            </span>
            <Badge className="shrink-0" aria-label="Langue : français">
              FR
            </Badge>
          </div>
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
            className="text-sm font-bold text-destructive"
          >
            Urgences Médicales Abidjan
          </h3>
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            24h/24 • 7j/7
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a
            href="tel:185"
            className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ambulance className="size-4 text-destructive" aria-hidden="true" />
            <span className="text-sm font-semibold">SAMU :</span>
            <span className="text-sm font-extrabold text-destructive">185</span>
          </a>
          <a
            href="tel:180"
            className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Flame className="size-4 text-destructive" aria-hidden="true" />
            <span className="text-sm font-semibold">Pompiers :</span>
            <span className="text-sm font-extrabold text-destructive">180</span>
          </a>
        </div>
      </section>

      {/* Centre d'aide & Assistance */}
      <InfoRow
        icon={LifeBuoy}
        label="Centre d'aide & Assistance Mondoc"
        value="FAQ, contact et signalements"
        accessory={
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        }
        onClick={() => soonToast("Le centre d'aide")}
        actionLabel="Centre d'aide et assistance (bientôt disponible)"
      />

      <Button
        variant="outline"
        onClick={onLogout}
        className="mt-1 h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
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
      />
      <PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
