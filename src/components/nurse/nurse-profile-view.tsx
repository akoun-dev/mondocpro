"use client";

// Vue « Profil » infirmier — FEATURE-NURSE-PROFIL (Task 34, dialogs mutualisés
// Task 35). Même langage visuel que la vue profil patient (maquette PO
// 2026-10-03) : héro avatar + nom + pastille zone, sections en lignes InfoRow,
// bandeau RGPD, urgences Abidjan. Spécifique infirmier :
//   - carte « Activité » : statistiques RÉELLES issues de /api/nurse/missions
//     (missions actives, terminées, comptes rendus rédigés) ;
//   - « Informations professionnelles » : nom, mobile actif, secteur
//     d'intervention (zone), date de naissance — éditables (dialogs partagés
//     ProfileIdentityDialog / ProfileZoneDialog, PATCH profil) ;
//   - « Sécurité & Accès » : changement de mot de passe FONCTIONNEL
//     (POST /api/auth/change-password — dialogue PasswordChangeDialog), la
//     voie par code SMS restant l'option de secours hors session (ADR-006).
// Préférences : interrupteurs persistés (maj optimiste + revert), comme côté
// patient (Task 22/23) — primitives partagées components/profile/.
import { useEffect, useState } from "react";
import {
  Ambulance,
  BellRing,
  Cake,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Flame,
  Globe,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  MapPin,
  Megaphone,
  Pencil,
  ShieldCheck,
  Smartphone,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlagCI } from "@/components/auth/ci-flag";
import { PasswordChangeDialog } from "@/components/auth/password-change-dialog";
import { ThemeChoice } from "@/components/theme/theme-choice";
import {
  ProfileIdentityDialog,
  ProfileZoneDialog,
} from "@/components/profile/profile-edit-dialogs";
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

// Statistiques d'activité — contrats repris de NurseMissionsView (FEATURE-
// NURSE) : statut COMPLETED ⇔ mission terminée, report présent ⇔ compte
// rendu rédigé. Échec de chargement = carte masquée (le profil reste utilisable).
type MissionLite = {
  status:
    | "ASSIGNED"
    | "ACCEPTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  report?: { observations?: string } | null;
};

type MissionStats = {
  total: number;
  active: number;
  completed: number;
  reports: number;
};

function useMissionStats(enabled: boolean): MissionStats | null {
  const [stats, setStats] = useState<MissionStats | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nurse/missions", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as
          | { missions?: MissionLite[] }
          | MissionLite[];
        const missions = Array.isArray(payload)
          ? payload
          : payload.missions ?? [];
        if (cancelled) return;
        setStats({
          total: missions.length,
          active: missions.filter((m) =>
            ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(m.status)
          ).length,
          completed: missions.filter((m) => m.status === "COMPLETED").length,
          reports: missions.filter((m) => m.report).length,
        });
      } catch {
        // silencieux : la carte activité n'est pas critique
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return stats;
}

export function NurseProfileView({ user, onLogout }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const stats = useMissionStats(true);

  // — Édition des informations (nom + date de naissance) et du secteur —
  // dialogs PARTAGÉS patient/infirmier/admin (components/profile/
  // profile-edit-dialogs) : brouillon, Zod, PATCH et toasts sont portés par
  // le dialog lui-même ; la vue ne gère que l'ouverture.
  const [editOpen, setEditOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);

  // — Mot de passe (fonctionnel, Task 34).
  const [passwordOpen, setPasswordOpen] = useState(false);

  // — Préférences — maj optimiste persistée.
  const [prefSaving, setPrefSaving] = useState<
    "appointmentReminders" | "healthAlerts" | null
  >(null);

  const memberSince = `Membre · ${relativePublishedLabel(user.createdAt)}`;

  async function updatePreference(
    key: "appointmentReminders" | "healthAlerts",
    value: boolean
  ) {
    const previous = user[key];
    const label =
      key === "appointmentReminders"
        ? "Rappels de rendez-vous"
        : "Alertes de santé locales";
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
        title: value ? `${label} activés` : `${label} désactivés`,
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
              className="bg-success text-success-foreground"
              aria-label="Rôle : Infirmier"
            >
              <Stethoscope className="size-3" aria-hidden="true" />
              Infirmier
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

      {/* Activité — statistiques réelles des missions (masquée si échec API) */}
      {stats ? (
        <section aria-labelledby="profil-activite">
          <ProfileSectionTitle id="profil-activite">
            Activité de terrain
          </ProfileSectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { value: stats.total, label: "Missions reçues" },
              { value: stats.active, label: "En cours" },
              { value: stats.completed, label: "Terminées" },
              { value: stats.reports, label: "Comptes rendus" },
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

      {/* Informations professionnelles — nom + naissance éditables (dialog) */}
      <section aria-labelledby="profil-infos-nurse">
        <ProfileSectionTitle
          id="profil-infos-nurse"
          action={
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Modifier mes informations professionnelles"
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Modifier
            </button>
          }
        >
          Informations professionnelles
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
              <Pencil
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={() => setEditOpen(true)}
            actionLabel="Modifier mes informations professionnelles (nom et date de naissance)"
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
            label="Secteur d'intervention"
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
        </div>
      </section>

      {/* Sécurité & Accès — mot de passe FONCTIONNEL (Task 34) */}
      <section aria-labelledby="profil-securite-nurse">
        <ProfileSectionTitle id="profil-securite-nurse">
          Sécurité &amp; Accès
        </ProfileSectionTitle>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            icon={LockKeyhole}
            label="Modifier le mot de passe"
            value="Par vérification du mot de passe actuel"
            accessory={
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
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
                Conformité de bout en bout
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Les données patients confiées lors de vos missions sont
                protégées selon la loi ivoirienne n°&nbsp;2013-430 du 14 mai
                2013 relative à la protection des données à caractère
                personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Apparence — FEATURE-DARK-MODE (Task 37) : thème par utilisateur */}
      <section aria-labelledby="profil-apparence-nurse">
        <ProfileSectionTitle id="profil-apparence-nurse">
          Apparence
        </ProfileSectionTitle>
        <div className="rounded-xl bg-muted/60 p-4">
          <ThemeChoice />
        </div>
      </section>

      {/* Préférences & Alertes — interrupteurs persistés (PATCH profil) */}
      <section aria-labelledby="profil-preferences-nurse">
        <ProfileSectionTitle id="profil-preferences-nurse">
          Préférences &amp; Alertes
        </ProfileSectionTitle>
        <div className="flex flex-col gap-2.5">
          <PreferenceRow
            icon={BellRing}
            title="Rappels de rendez-vous"
            description="Un rappel avant chacune de vos missions affectées — notification dans l'app ; SMS dès le choix de la passerelle."
            switchLabel="Rappels de rendez-vous"
            checked={user.appointmentReminders}
            disabled={prefSaving !== null}
            onCheckedChange={(checked) =>
              updatePreference("appointmentReminders", checked)
            }
          />
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
        aria-labelledby="profil-urgences-nurse"
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3
            id="profil-urgences-nurse"
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
          <ExternalLink
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
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

      {/* Dialogs d'édition — socle partagé patient/infirmier/admin (Task 35) :
          brouillon + Zod + PATCH + toasts portés par les dialogs eux-mêmes */}
      <ProfileIdentityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
      />
      <ProfileZoneDialog
        open={zoneOpen}
        onOpenChange={setZoneOpen}
        user={user}
        description="Votre secteur d'intervention détermine les missions qui vous sont affectées."
        fieldLabel="Secteur d'intervention"
        successTitle="Secteur mis à jour"
        successDescription={(zone) => `Votre secteur d'intervention est désormais ${ZONE_LABELS[zone]}.`}
      />

      {/* Dialog de changement de mot de passe (POST /api/auth/change-password,
          preuve par le mot de passe actuel — Task 34) */}
      <PasswordChangeDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </div>
  );
}
