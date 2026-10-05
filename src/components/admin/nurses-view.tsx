"use client"

// Vue « Infirmiers » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN.
// Annuaire des soignants avec leur charge courante (missions en cours, en
// attente d'acceptation, terminées dans le mois), puis fiche individuelle
// détaillant l'historique de missions et de comptes rendus.
//
// Trois appels : GET /api/admin/nurses pour la liste,
// GET /api/admin/nurses/:id à l'ouverture d'une fiche et — demande PO
// 2026-10 — POST /api/admin/nurses pour le workflow complet d'onboarding
// (création d'un compte actif, mot de passe choisi ou généré).

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  CircleCheck,
  FileText,
  Loader2,
  RefreshCw,
  UserRoundPlus,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountFilterSelect,
  AccountIdentity,
  CountBadge,
  DateOrDash,
  FilterField,
  ListSkeleton,
  LoadError,
  SearchField,
  SuspendAccountDialog,
  ZoneBadge,
  ZoneFilter,
  adminQuery,
  useAccountSuspension,
  useAdminResource,
} from "@/components/admin/admin-directory-shared";
import { formatDateUTC } from "@/lib/datetime";
import {
  MISSION_STATUS_CLASSES,
  MISSION_STATUS_LABELS,
} from "@/lib/nurse-schemas";
import { ZONES, ZONE_LABELS } from "@/lib/auth-schemas";
import { createNurseSchema, zodIssuesToFieldErrors } from "@/lib/auth-schemas";
import { formatPhoneDisplay } from "@/lib/phone";
import { toast } from "@/hooks/use-toast";
import { hapticSuccess } from "@/lib/native";
import type {
  AccountFilterValue,
  CreatedNurse,
  NurseDetail,
  NurseLoadItem,
} from "@/lib/admin-users-schemas";

type NurseListResponse = { nurses: NurseLoadItem[] };
type NurseDetailResponse = { nurse: NurseDetail };

const EMPTY_LIST: NurseListResponse = { nurses: [] };

/** Champs du formulaire de création — confirmPassword suit le mot de passe. */
type CreateNurseForm = {
  fullName: string;
  phone: string;
  zone: string;
  password: string;
  confirmPassword: string;
};

const EMPTY_FORM: CreateNurseForm = {
  fullName: "",
  phone: "",
  zone: "",
  password: "",
  confirmPassword: "",
};

/**
 * Sentinelle du Select de zone : Radix bascule en avertissement React
 * « uncontrolled → controlled » si la valeur passée de `undefined` à une
 * zone. Une entrée désactivée garde le composant TOUJOURS contrôlé et
 * affiche « Choisir une zone » tant que rien n'est sélectionné.
 */
const ZONE_UNSET = "__unset__";

/**
 * Workflow complet de création d'un infirmier (demande PO 2026-10) :
 * 1. le Médecin Chef saisit identité + téléphone + zone et choisit un mot de
 *    passe — ou le laisse générer (alphabet sans caractères ambigus) ;
 * 2. le compte NURSE est créé ACTIF : l'infirmier peut se connecter
 *    immédiatement avec son numéro (aucune étape d'activation) ;
 * 3. le mot de passe généré n'est affiché qu'une fois, prêt à communiquer ;
 *    l'annuaire se recharge en arrière-plan et l'infirmier est déjà affectable
 *    par le dispatch (vue Équipes / Missions).
 */
function CreateNurseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<CreateNurseForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    nurse: CreatedNurse;
    generatedPassword: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Réouverture = formulaire vierge : deux créations successives ne doivent
  // jamais se contaminer (nom résiduel, zone présélectionnée par erreur).
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setGlobalError(undefined);
      setSuccess(null);
      setCopied(false);
    }
  }, [open]);

  function setField<K extends keyof CreateNurseForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    // Efface l'erreur du champ dès la correction — pas de message périmé.
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setGlobalError(undefined);
    setFieldErrors({});
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        zone: form.zone,
        // Mot de passe vide = génération serveur ; confirmPassword ne suit
        // que si un mot de passe manuel est saisi.
        ...(form.password
          ? { password: form.password, confirmPassword: form.confirmPassword }
          : {}),
      };
      const parsed = createNurseSchema.safeParse(payload);
      if (!parsed.success) {
        setFieldErrors(zodIssuesToFieldErrors(parsed.error));
        return;
      }

      const res = await fetch("/api/admin/nurses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        nurse?: CreatedNurse;
        generatedPassword?: string | null;
        error?: string;
        details?: { field: string; message: string }[];
      };

      if (res.status === 201 && body.nurse) {
        setSuccess({
          nurse: body.nurse,
          generatedPassword: body.generatedPassword ?? null,
        });
        void hapticSuccess();
        toast({
          title: "Infirmier créé",
          description: `${body.nurse.fullName} peut se connecter dès maintenant.`,
        });
        // L'annuaire se recharge en arrière-plan : à la fermeture du dialog,
        // la nouvelle ligne est déjà là.
        await onCreated();
        return;
      }

      if (res.status === 400 && body.details) {
        const errors: Record<string, string> = {};
        for (const detail of body.details) {
          if (typeof detail.field === "string" && !(detail.field in errors)) {
            errors[detail.field] = detail.message;
          }
        }
        setFieldErrors(errors);
        return;
      }

      setGlobalError(
        body.error ?? "Création impossible — réessayez dans un instant.",
      );
    } catch {
      setGlobalError(
        "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!success?.generatedPassword) return;
    try {
      await navigator.clipboard.writeText(success.generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (permission refusée, WebView ancien) :
      // le mot de passe reste visible dans le bloc, rien ne bloque.
    }
  }

  const nurse = success?.nurse ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {nurse ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck
                  className="size-5 text-success"
                  aria-hidden="true"
                />
                Infirmier créé
              </DialogTitle>
              <DialogDescription>
                <strong>{nurse.fullName}</strong> peut se connecter dès
                maintenant avec ce numéro
                {success?.generatedPassword
                  ? " et le mot de passe temporaire ci-dessous."
                  : " et le mot de passe que vous avez défini."}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2 rounded-2xl border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Nom</dt>
                <dd className="font-semibold">{nurse.fullName}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd className="font-semibold">
                  {formatPhoneDisplay(nurse.phone)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Zone</dt>
                <dd className="font-semibold">
                  {ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ??
                    nurse.zone}
                </dd>
              </div>
            </dl>

            {success?.generatedPassword && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold">
                  Mot de passe temporaire
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 font-mono text-sm tracking-wider select-all">
                    {success.generatedPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyPassword()}
                    className="size-10 shrink-0 rounded-xl"
                    aria-label="Copier le mot de passe temporaire"
                  >
                    {copied ? (
                      <Check className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  À communiquer à l&apos;infirmier — il ne sera plus affiché.
                  Il pourra le modifier dans son profil (Mon profil →
                  Sécurité).
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSuccess(null);
                  setForm(EMPTY_FORM);
                }}
                className="h-10 rounded-xl font-semibold"
              >
                <UserRoundPlus className="size-4" aria-hidden="true" />
                Créer un autre
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl font-semibold"
              >
                Terminer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserRoundPlus
                  className="size-5 text-primary"
                  aria-hidden="true"
                />
                Ajouter un infirmier
              </DialogTitle>
              <DialogDescription>
                Le compte est créé actif : l&apos;infirmier rejoint
                immédiatement l&apos;annuaire, se connecte avec son numéro et
                peut recevoir des missions.
              </DialogDescription>
            </DialogHeader>

            {globalError && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {globalError}
              </p>
            )}

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="nurse-create-fullname">Nom complet</Label>
                <Input
                  id="nurse-create-fullname"
                  value={form.fullName}
                  onChange={(event) => setField("fullName", event.target.value)}
                  placeholder="Ex : Aya Konan"
                  autoComplete="off"
                  className="h-10 rounded-xl"
                  aria-invalid={fieldErrors.fullName ? true : undefined}
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="nurse-create-phone">Téléphone</Label>
                <Input
                  id="nurse-create-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  autoComplete="off"
                  className="h-10 rounded-xl"
                  aria-invalid={fieldErrors.phone ? true : undefined}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="nurse-create-zone">Zone d&apos;intervention</Label>
                <Select
                  value={form.zone || ZONE_UNSET}
                  onValueChange={(value) => setField("zone", value)}
                >
                  <SelectTrigger
                    id="nurse-create-zone"
                    className="h-10 w-full rounded-xl"
                    aria-invalid={fieldErrors.zone ? true : undefined}
                  >
                    <SelectValue placeholder="Choisir une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ZONE_UNSET} disabled>
                      Choisir une zone
                    </SelectItem>
                    {ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {ZONE_LABELS[zone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.zone && (
                  <p className="text-xs text-destructive">{fieldErrors.zone}</p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="nurse-create-password">
                  Mot de passe{" "}
                  <span className="font-normal text-muted-foreground">
                    (optionnel — généré si vide)
                  </span>
                </Label>
                <Input
                  id="nurse-create-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  autoComplete="new-password"
                  className="h-10 rounded-xl"
                  aria-invalid={fieldErrors.password ? true : undefined}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {form.password && (
                <div className="grid gap-1.5">
                  <Label htmlFor="nurse-create-confirm">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="nurse-create-confirm"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setField("confirmPassword", event.target.value)
                    }
                    autoComplete="new-password"
                    className="h-10 rounded-xl"
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 rounded-xl"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="h-10 gap-2 rounded-xl font-semibold"
              >
                {submitting && (
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {submitting ? "Création…" : "Créer l'infirmier"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Anti-rebond de la recherche — évite un appel par frappe clavier. */
function useSearch(value: string) {
  return useDebounced(value);
}

/**
 * Compteur de charge. La teinte suit l'occupation : un soignant avec 5
 * missions ouvertes n'est pas dans la même situation qu'un collègue à 0, et le
 * Médecin Chef doit le voir avant de décider d'affecter.
 */
function LoadBadge({ nurse }: { nurse: NurseLoadItem }) {
  const tone =
    nurse.activeMissions >= 4
      ? "bg-destructive/10 text-destructive"
      : nurse.activeMissions >= 2
        ? "bg-warning/20 text-warning-foreground"
        : "bg-success/15 text-success-foreground";
  return (
    <Badge className={`${tone} font-medium tabular-nums`}>
      {nurse.activeMissions === 0
        ? "Disponible"
        : `${nurse.activeMissions} mission${nurse.activeMissions > 1 ? "s" : ""}`}
    </Badge>
  );
}

/** Fiche infirmier : identité, compteurs de charge, historique de missions. */
function NurseSheet({
  nurseId,
  onClose,
}: {
  nurseId: string | null;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useAdminResource<NurseDetailResponse>(
    nurseId === null ? null : `/api/admin/nurses/${nurseId}`,
  );

  const nurse = data?.nurse.nurse;
  const missions = data?.nurse.missions ?? [];
  const [completedOnly, setCompletedOnly] = useState(false);

  // Une mission terminée n'est plus un sujet de supervision : on la masque par
  // défaut et on laisse un toggle pour l'historique.
  const visible = useMemo(
    () =>
      completedOnly
        ? missions
        : missions.filter(mission => mission.status !== "COMPLETED"),
    [missions, completedOnly],
  );

  return (
    <Dialog open={nurseId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="size-5 text-primary" aria-hidden="true" />
            {nurse ? nurse.fullName : "Fiche infirmier"}
          </DialogTitle>
          <DialogDescription>
            {nurse
              ? `${ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ?? nurse.zone} · ${nurse.phone}`
              : "Chargement de la fiche…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <LoadError onRetry={() => void reload()} />
        ) : loading && nurse === undefined ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-20 rounded-2xl" aria-hidden="true" />
            <Skeleton className="h-40 rounded-2xl" aria-hidden="true" />
          </div>
        ) : nurse ? (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Missions en cours", value: nurse.activeMissions },
                { label: "Sans acceptation", value: nurse.pendingAcceptance },
                { label: "Ce mois-ci", value: nurse.completedThisMonth },
                { label: "Total terminées", value: nurse.completedTotal },
              ].map(stat => (
                <li key={stat.label} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                </li>
              ))}
            </ul>

            {nurse.pendingAcceptance > 0 && (
              <p
                role="status"
                className="rounded-xl bg-warning/20 px-3 py-2 text-sm text-warning-foreground"
              >
                {nurse.pendingAcceptance} mission(s) attendent une acceptation —
                affectées mais pas encore prises en charge.
              </p>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Missions</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompletedOnly(!completedOnly)}
                className="h-9 gap-2 rounded-xl text-sm"
              >
                {completedOnly ? "Masquer" : "Afficher"} les terminées
              </Button>
            </div>

            {visible.length === 0 ? (
              <p className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {completedOnly
                  ? "Aucune mission enregistrée."
                  : "Aucune mission en cours — l'infirmier est disponible."}
              </p>
            ) : (
              <ul className="grid gap-3">
                {visible.map(mission => (
                  <li
                    key={mission.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {mission.patient.fullName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateUTC(mission.scheduledAt)}
                        </p>
                      </div>
                      <Badge
                        className={
                          MISSION_STATUS_CLASSES[mission.status] ??
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {MISSION_STATUS_LABELS[mission.status] ?? mission.status}
                      </Badge>
                    </div>

                    {mission.appointment.reason && (
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Motif : </span>
                        {mission.appointment.reason}
                      </p>
                    )}

                    {mission.report && (
                      <div className="mt-2 rounded-xl bg-muted/40 p-3 text-sm">
                        <p className="flex items-center gap-1 font-semibold">
                          <FileText className="size-3.5" aria-hidden="true" />
                          Compte rendu
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {mission.report.observations}
                        </p>
                        {mission.report.actionsTaken && (
                          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              Actions :{" "}
                            </span>
                            {mission.report.actionsTaken}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AdminNursesView() {
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("all");
  const [accountStatus, setAccountStatus] = useState<AccountFilterValue>("all");
  const [openNurse, setOpenNurse] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useSearch(search);

  const url = `/api/admin/nurses${adminQuery({
    search: debouncedSearch || undefined,
    zone: zone === "all" ? undefined : zone,
    status: accountStatus === "all" ? undefined : accountStatus,
  })}`;

  const { data, loading, error, reload } =
    useAdminResource<NurseListResponse>(url);
  const nurses = data?.nurses ?? EMPTY_LIST.nurses;

  // Tri par charge décroissante : c'est l'ordre de décision du dispatch.
  const sorted = useMemo(() => {
    if (debouncedSearch.trim()) return nurses;
    return [...nurses].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (b.activeMissions !== a.activeMissions) {
        return b.activeMissions - a.activeMissions;
      }
      return a.fullName.localeCompare(b.fullName);
    });
  }, [nurses, debouncedSearch]);

  const suspension = useAccountSuspension(reload);

  return (
    <div className="flex flex-col gap-5">
      {/* Action principale à gauche, rafraîchissement à droite : la création
          d'infirmier est le point d'entrée de l'onboarding, elle doit se voir
          avant le bouton secondaire. */}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-10 gap-2 rounded-xl font-semibold"
        >
          <UserRoundPlus className="size-4" aria-hidden="true" />
          Ajouter un infirmier
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void reload()}
          aria-label="Rafraîchir l'annuaire"
          className="size-9 shrink-0 rounded-full"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un infirmier (nom ou téléphone)"
          label="Rechercher un infirmier"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterField id="nurses-zone" label="Zone">
            <ZoneFilter value={zone} onChange={setZone} />
          </FilterField>
          <FilterField id="nurses-status" label="État du compte">
            <AccountFilterSelect
              value={accountStatus}
              onChange={setAccountStatus}
            />
          </FilterField>
        </div>
      </div>

      {!loading && nurses.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CountBadge value={nurses.length} />
          {nurses.length === 1 ? "infirmier trouvé" : "infirmiers trouvés"}
        </p>
      )}

      {error && data === null ? (
        <LoadError onRetry={() => void reload()} />
      ) : loading && data === null ? (
        <ListSkeleton rows={4} />
      ) : nurses.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <ClipboardList className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Aucun infirmier ne correspond.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Élargissez la recherche, changez de zone — ou ajoutez un nouvel
            infirmier avec le bouton « Ajouter un infirmier ».
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sorted.map(nurse => (
            <li key={nurse.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <AccountIdentity
                  fullName={nurse.fullName}
                  phone={nurse.phone}
                  suspended={!nurse.isActive}
                />
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ZoneBadge zone={nurse.zone} />
                  <LoadBadge nurse={nurse} />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">En cours</dt>
                  <dd className="font-semibold tabular-nums">
                    {nurse.activeMissions}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Ce mois</dt>
                  <dd className="font-semibold tabular-nums">
                    {nurse.completedThisMonth}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Dernière</dt>
                  <dd className="font-semibold">
                    <DateOrDash value={nurse.lastMissionAt} />
                  </dd>
                </div>
              </dl>

              {nurse.pendingAcceptance > 0 && (
                <p className="mt-2 text-xs text-warning-foreground">
                  {nurse.pendingAcceptance} en attente d&apos;acceptation
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenNurse(nurse.id)}
                  className="h-9 flex-1 gap-2 rounded-xl text-sm font-semibold"
                >
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Ouvrir la fiche
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant={nurse.isActive ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => suspension.open(nurse)}
                  className="h-9 gap-2 rounded-xl text-sm font-semibold"
                >
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {nurse.isActive ? "Suspendre" : "Réactiver"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NurseSheet nurseId={openNurse} onClose={() => setOpenNurse(null)} />

      <CreateNurseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => reload()}
      />

      <SuspendAccountDialog
        target={suspension.target}
        busy={suspension.busy}
        error={suspension.error}
        onOpenChange={suspension.setOpen}
        onSubmit={(isActive) => void suspension.submit(isActive)}
      />
    </div>
  );
}