"use client";

// Vue « Profil » patient — maquette PO 2026-10-03 (pastedImage 1790992312025.png) :
// héro avatar + nom + pastille zone, « Informations Personnelles » (naissance /
// mobile actif / secteur), « Sécurité & Accès » (mot de passe + bandeau RGPD loi
// ivoirienne 2013-430), « Préférences & Alertes » (rappels RDV, alertes locales,
// langue), « Urgences Médicales Abidjan » (SAMU 185 / Pompiers 180, liens tel:)
// et « Centre d'aide & Assistance ».
// Task 22 : le nom et la date de naissance sont ÉDITABLES (dialog → PATCH
// /api/auth/profile, mise à jour du store auth) et les préférences « Rappels
// de rendez-vous » / « Alertes de santé locales » sont PERSISTÉES (maj
// optimiste + revert en cas d'échec).
// Task 23 : le secteur d'habitation devient éditable « sur le même modèle »
// (dialog dédié → PATCH zone → store) ; les rappels RDV sont précisés PO :
// UNIQUEMENT avant les RDV, canal SMS — passerelle en attente de la décision
// A10 (envoi bientôt actif, préférence déjà effective). Restent en état
// « Bientôt » honnête : mot de passe (code SMS), centre d'aide.
import { useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FlagCI } from "@/components/auth/ci-flag";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, type AppUser } from "@/stores/auth-store";
import {
  updateProfileSchema,
  zodIssuesToFieldErrors,
  ZONES,
  ZONE_LABELS,
} from "@/lib/auth-schemas";
import { formatDateUTC, relativePublishedLabel } from "@/lib/datetime";
import { formatPhoneDisplay } from "@/lib/phone";
import { getInitials } from "@/lib/utils";

type Props = {
  user: AppUser;
  onLogout: () => void;
};

const SOON = {
  title: "Bientôt disponible",
};

function soonToast(what: string) {
  toast({
    title: SOON.title,
    description: `${what} arrive dans une prochaine version de Mon doc Pro.`,
  });
}

// Ligne d'information : icône en pastille, libellé + valeur, action à droite.
function InfoRow({
  icon: Icon,
  label,
  value,
  valueMuted,
  accessory,
  onClick,
  actionLabel,
}: {
  icon: typeof Cake;
  label: string;
  value: React.ReactNode;
  valueMuted?: boolean;
  accessory: React.ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span
          className={`mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold ${valueMuted ? "font-medium text-muted-foreground" : ""}`}
        >
          {value}
        </span>
      </span>
      {accessory}
    </>
  );
  if (!onClick) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel ?? label}
      className="flex w-full items-center gap-3 rounded-xl bg-muted/60 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </button>
  );
}

// Ligne de préférence : interrupteur fonctionnel — la valeur vient du user
// (store auth) et le basculement est persisté via PATCH /api/auth/profile
// (maj optimiste côté ProfileView, revert + toast si l'appel échoue).
function PreferenceRow({
  icon: Icon,
  title,
  description,
  switchLabel,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof BellRing;
  title: string;
  description: string;
  switchLabel: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={switchLabel}
      />
    </div>
  );
}

export function ProfileView({ user, onLogout }: Props) {
  const setUser = useAuthStore((s) => s.setUser);

  // — Édition des informations (nom + date de naissance) — dialog dédié.
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [birthDate, setBirthDate] = useState(user.birthDate?.slice(0, 10) ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // — Édition du secteur d'habitation (Task 23) — même modèle : dialog →
  // PATCH { zone } → store. Brouillon réinitialisé à chaque ouverture.
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState<AppUser["zone"]>(user.zone);
  const [zoneError, setZoneError] = useState<string | undefined>(undefined);
  const [zoneSaving, setZoneSaving] = useState(false);

  // — Préférences (rappels RDV / alertes locales) — maj optimiste persistée.
  const [prefSaving, setPrefSaving] = useState<
    "appointmentReminders" | "healthAlerts" | null
  >(null);

  const memberSince = `Membre · ${relativePublishedLabel(user.createdAt)}`;

  function openEdit() {
    // Réinitialise le brouillon depuis l'état courant à chaque ouverture
    // (annulation = aucune trace, erreurs effacées).
    setFullName(user.fullName);
    setBirthDate(user.birthDate?.slice(0, 10) ?? "");
    setFieldErrors({});
    setEditOpen(true);
  }

  function openZoneEdit() {
    setZoneDraft(user.zone);
    setZoneError(undefined);
    setZoneOpen(true);
  }

  async function handleZoneSave(event: React.FormEvent) {
    event.preventDefault();
    // Même schéma Zod que le serveur (source unique des règles) — la liste
    // fermée des zones est celle de l'inscription.
    const parsed = updateProfileSchema.safeParse({ zone: zoneDraft });
    if (!parsed.success) {
      setZoneError(zodIssuesToFieldErrors(parsed.error).zone ?? "Zone invalide");
      return;
    }
    setZoneError(undefined);
    setZoneSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        const data = (await res.json()) as { user: AppUser };
        setUser(data.user); // héro + ligne secteur se re-rendent avec la zone
        toast({
          title: "Secteur mis à jour",
          description: `Votre secteur d'habitation est désormais ${ZONE_LABELS[data.user.zone]}.`,
        });
        setZoneOpen(false);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description: body.error ?? "Veuillez réessayer.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setZoneSaving(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    // Même schéma Zod que le serveur (source unique des règles) : nom 2-80,
    // naissance AAAA-MM-JJ passée — vide = effacer la valeur.
    const parsed = updateProfileSchema.safeParse({
      fullName: fullName.trim(),
      birthDate: birthDate === "" ? null : birthDate,
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        const data = (await res.json()) as { user: AppUser };
        setUser(data.user); // héro + lignes se re-rendent avec les nouvelles valeurs
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont bien été enregistrées.",
        });
        setEditOpen(false);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };
      const errors: Record<string, string> = {};
      for (const detail of body.details ?? []) {
        if (
          detail?.field &&
          detail?.message &&
          !(detail.field in errors)
        ) {
          errors[detail.field] = detail.message;
        }
      }
      setFieldErrors(errors);
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          body.error ?? "Veuillez corriger les champs signalés puis réessayez.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function updatePreference(
    key: "appointmentReminders" | "healthAlerts",
    value: boolean,
  ) {
    const previous = user[key];
    const label =
      key === "appointmentReminders"
        ? "Rappels de rendez-vous"
        : "Alertes de santé locales";
    setPrefSaving(key);
    setUser({ ...user, [key]: value }); // retour immédiat (interrupteur)
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(`PATCH ${key} → ${res.status}`);
      const data = (await res.json()) as { user: AppUser };
      setUser(data.user); // réaligne sur la vérité serveur
      toast({
        title: value ? `${label} activés` : `${label} désactivés`,
        description: value
          ? "Vous recevrez les notifications correspondantes."
          : "Vous ne recevrez plus ces notifications.",
      });
    } catch {
      setUser({ ...user, [key]: previous }); // revert visuel
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
      {/* Héro : avatar + nom + pastille zone (maquette, centré) */}
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
          <h2 className="text-lg font-bold tracking-tight">{user.fullName}</h2>
          {/* Zone + ancienneté : l'ancienneté dépend de l'horloge du device
              (relatif) → suppressHydrationWarning comme ailleurs dans l'app. */}
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" />
            {ZONE_LABELS[user.zone]}
            <span aria-hidden="true">·</span>
            <span suppressHydrationWarning>{memberSince}</span>
          </p>
        </div>
      </div>

      {/* Informations Personnelles — nom + naissance éditables (dialog) */}
      <section aria-labelledby="profil-infos">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3
            id="profil-infos"
            className="text-[15px] font-bold tracking-tight"
          >
            Informations Personnelles
          </h3>
          <button
            type="button"
            onClick={openEdit}
            aria-label="Modifier mes informations personnelles"
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Modifier
          </button>
        </div>
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
            onClick={openEdit}
            actionLabel="Modifier mes informations personnelles (nom et date de naissance)"
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
              <Pencil
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={openZoneEdit}
            actionLabel="Modifier le secteur d'habitation"
          />
        </div>
      </section>

      {/* Sécurité & Accès */}
      <section aria-labelledby="profil-securite">
        <h3 id="profil-securite" className="mb-2.5 text-[15px] font-bold tracking-tight">
          Sécurité &amp; Accès
        </h3>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            icon={LockKeyhole}
            label="Modifier le mot de passe"
            value="Par code SMS — à venir"
            valueMuted
            accessory={
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            }
            onClick={() => soonToast("Le changement de mot de passe")}
            actionLabel="Modifier le mot de passe (bientôt disponible)"
          />
          {/* Bandeau conformité — loi ivoirienne sur les données personnelles */}
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
                Vos données médicales sont protégées selon la loi ivoirienne
                n°&nbsp;2013-430 du 14 mai 2013 relative à la protection des
                données à caractère personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Préférences & Alertes */}
      <section aria-labelledby="profil-preferences">
        <h3
          id="profil-preferences"
          className="mb-2.5 text-[15px] font-bold tracking-tight"
        >
          Préférences &amp; Alertes
        </h3>
        <div className="flex flex-col gap-2.5">
          <PreferenceRow
            icon={BellRing}
            title="Rappels de rendez-vous"
            description="Un SMS de rappel 24 h avant chacun de vos rendez-vous — envoi bientôt actif."
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
        aria-labelledby="profil-urgences"
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="profil-urgences" className="text-sm font-bold text-destructive">
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

      {/* Dialog d'édition — nom complet + date de naissance (PATCH profil) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier mes informations</DialogTitle>
            <DialogDescription>
              Votre nom et votre date de naissance complètent votre dossier
              patient.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSave}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-fullname">Nom complet</Label>
              <Input
                id="profile-fullname"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={fieldErrors.fullName ? true : undefined}
                maxLength={80}
                required
              />
              {fieldErrors.fullName ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-birthdate">Date de naissance</Label>
              <Input
                id="profile-birthdate"
                name="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                aria-invalid={fieldErrors.birthDate ? true : undefined}
              />
              {fieldErrors.birthDate ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {fieldErrors.birthDate}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Facultative — laissez vide si vous préférez ne pas la
                renseigner.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition du secteur d'habitation (Task 23 — même modèle que
          nom/naissance : Zod partagé → PATCH { zone } → store) */}
      <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier mon secteur</DialogTitle>
            <DialogDescription>
              Votre secteur d&apos;habitation détermine les équipes soignantes
              et les alertes qui vous sont proposées.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleZoneSave}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-zone">Secteur d&apos;habitation</Label>
              <Select
                value={zoneDraft}
                onValueChange={(value) => setZoneDraft(value as AppUser["zone"])}
              >
                <SelectTrigger
                  id="profile-zone"
                  aria-invalid={zoneError ? true : undefined}
                  className="w-full"
                >
                  <SelectValue placeholder="Choisir un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {ZONE_LABELS[zone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {zoneError ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {zoneError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setZoneOpen(false)}
                disabled={zoneSaving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={zoneSaving} className="gap-2">
                {zoneSaving ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
