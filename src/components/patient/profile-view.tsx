"use client";

// Vue « Profil » patient — maquette PO 2026-10-03 (pastedImage 1790992312025.png) :
// héro avatar + nom + pastille zone, « Informations Personnelles » (naissance /
// mobile actif / secteur), « Sécurité & Accès » (mot de passe + bandeau RGPD loi
// ivoirienne 2013-430), « Préférences & Alertes » (rappels RDV, alertes locales,
// langue), « Urgences Médicales Abidjan » (SAMU 185 / Pompiers 180, liens tel:)
// et « Centre d'aide & Assistance ».
// Honnêteté données↔maquette (pattern « Épargne ») : le modèle User ne porte
// ni date de naissance, ni date de modification du mot de passe, ni préférences —
// ces lignes affichent un état « Bientôt » explicite plutôt que des valeurs
// inventées ; les interrupteurs sont désactivés (aucune persistance côté API).
import {
  Ambulance,
  Cake,
  ChevronRight,
  CircleCheck,
  Clock,
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
import { Switch } from "@/components/ui/switch";
import { FlagCI } from "@/components/auth/ci-flag";
import { toast } from "@/hooks/use-toast";
import type { AppUser } from "@/stores/auth-store";
import { ZONE_LABELS } from "@/lib/auth-schemas";
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

// Ligne de préférence : interrupteur désactivé (pas de persistance API) + badge « Bientôt ».
function PreferenceRow({
  icon: Icon,
  title,
  description,
  switchLabel,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  switchLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">{title}</span>
          <Badge
            variant="secondary"
            className="gap-1 px-1.5 py-0 text-[10px]"
            aria-label={`${title} : bientôt disponible`}
          >
            <Clock className="size-3" aria-hidden="true" />
            Bientôt
          </Badge>
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked
        disabled
        aria-label={`${switchLabel} (bientôt disponible)`}
      />
    </div>
  );
}

export function ProfileView({ user, onLogout }: Props) {
  const memberSince = `Membre · ${relativePublishedLabel(user.createdAt)}`;

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
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" />
            {ZONE_LABELS[user.zone]}
          </p>
        </div>
      </div>

      {/* Informations Personnelles */}
      <section aria-labelledby="profil-infos">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3
            id="profil-infos"
            className="text-[15px] font-bold tracking-tight"
          >
            Informations Personnelles
          </h3>
          <span
            className="text-[11px] text-muted-foreground"
            suppressHydrationWarning
          >
            {memberSince}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            icon={Cake}
            label="Date de naissance"
            value="Non renseignée"
            valueMuted
            accessory={
              <Badge
                variant="secondary"
                className="shrink-0 gap-1"
                aria-label="Date de naissance : bientôt disponible"
              >
                <Clock className="size-3" aria-hidden="true" />
                Bientôt
              </Badge>
            }
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
              <>
                <Pencil
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </>
            }
            onClick={() => soonToast("La modification du secteur")}
            actionLabel="Modifier le secteur d'habitation (bientôt disponible)"
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
            icon={Megaphone}
            title="Rappels de rendez-vous"
            description="Notification SMS &amp; WhatsApp 24h avant"
            switchLabel="Rappels de rendez-vous"
          />
          <PreferenceRow
            icon={Bell}
            title="Alertes de santé locales"
            description="Campagnes de vaccination, gestes santé"
            switchLabel="Alertes de santé locales"
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
    </div>
  );
}
