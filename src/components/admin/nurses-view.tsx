"use client"

// Vue « Infirmiers » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN.
// Annuaire des soignants avec leur charge courante (missions en cours, en
// attente d'acceptation, terminées dans le mois), puis fiche individuelle
// détaillant l'historique de missions et de comptes rendus.
//
// Deux appels : GET /api/admin/nurses pour la liste, puis
// GET /api/admin/nurses/:id à l'ouverture d'une fiche.

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ZONE_LABELS } from "@/lib/auth-schemas";
import type {
  AccountFilterValue,
  NurseDetail,
  NurseLoadItem,
} from "@/lib/admin-users-schemas";

type NurseListResponse = { nurses: NurseLoadItem[] };
type NurseDetailResponse = { nurse: NurseDetail };

const EMPTY_LIST: NurseListResponse = { nurses: [] };

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
      <div className="flex justify-end">
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
            Élargissez la recherche ou changez de zone.
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