"use client"

// Vue « Équipes » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN.
// Remplace les deux cartes Supervision et Dispatch de l'accueil, qui pointaient
// toutes deux vers la vue Missions et n'offraient donc aucun pilotage
// d'effectif. Cette vue répond à deux questions distinctes :
//   1. Supervision — où en est chaque équipe ? charge par zone, missions en
//      attente d'acceptation, visites terminées dans le mois ;
//   2. Dispatch — qui est disponible pour les RDV à domicile qui attendent ?
//      La file est triée par urgence (RDV le plus proche) et l'affectation se
//      fait depuis cette vue, sans quitter l'écran.
//
// GET /api/admin/teams pour la vue complète (charge + file + répartition par
// zone). Le dispatch passe par POST /api/admin/missions — le même point
// d'entrée que la vue Missions, donc les mêmes notifications à l'infirmier.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Users,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ListSkeleton, LoadError, ZoneBadge, useAdminResource } from "@/components/admin/admin-directory-shared";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatCardSlotUTC, formatDateUTC } from "@/lib/datetime";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import type { DispatchQueueItem } from "@/lib/nurse-schemas";
import type { NurseLoadItem, TeamBoard } from "@/lib/admin-users-schemas";

type TeamResponse = { teams: TeamBoard };

const EMPTY_BOARD: TeamBoard = {
  nurses: [],
  queue: [],
  zoneLoad: [],
  totals: {
    activeNurses: 0,
    inactiveNurses: 0,
    activeMissions: 0,
    unassigned: 0,
    completedThisMonth: 0,
  },
};

/** Sélecteur d'infirmier — les soignants de la zone d'abord. */
function NurseSelect({
  nurses,
  value,
  onChange,
  error,
  id,
}: {
  nurses: NurseLoadItem[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  id: string;
}) {
  const zone = nurses.find(n => n.id === value)?.zone;
  const sorted = [...nurses].sort((a, b) => {
    if (a.zone === zone && b.zone !== zone) return -1;
    if (a.zone !== zone && b.zone === zone) return 1;
    return a.activeMissions - b.activeMissions;
  });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-invalid={error ? true : undefined}
        className="w-full"
      >
        <SelectValue placeholder="Sélectionner un(e) infirmier(ère)" />
      </SelectTrigger>
      <SelectContent>
        {sorted.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Aucun(e) infirmier(ère) disponible.
          </div>
        ) : (
          sorted.map(nurse => (
            <SelectItem key={nurse.id} value={nurse.id}>
              {nurse.fullName}
              {nurse.activeMissions > 0 ? ` · ${nurse.activeMissions} en cours` : ""}
              {nurse.zone !== zone ? " (hors zone)" : ""}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/** Dispatch d'un RDV à domicile : confirmation puis POST /api/admin/missions. */
function DispatchDialog({
  item,
  nurses,
  onClose,
  onDone,
}: {
  item: DispatchQueueItem | null;
  nurses: NurseLoadItem[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [nurseId, setNurseId] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setNurseId("");
      setError(undefined);
      onClose();
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!item) return;
    if (!nurseId) {
      setError("Sélectionnez un infirmier à affecter");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: item.id, nurseId }),
      });
      if (res.ok) {
        const nurse = nurses.find(n => n.id === nurseId);
        toast({
          title: "Mission affectée",
          description: `${nurse?.fullName ?? "L'infirmier"} a été notifié(e).`,
        });
        handleOpenChange(false);
        await onDone();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Affectation impossible — réessayez.");
    } catch {
      setError(
        "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" aria-hidden="true" />
              Affecter la mission
            </DialogTitle>
            <DialogDescription>
              {item && (
                <>
                  {item.patientName} — {formatCardSlotUTC(item.scheduledAt)}
                  <br />
                  Zone {ZONE_LABELS[item.zone as keyof typeof ZONE_LABELS] ?? item.zone}
                  {item.specialtyName ? ` · ${item.specialtyName}` : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="teams-dispatch-nurse">Infirmier(ère)</Label>
            <NurseSelect
              id="teams-dispatch-nurse"
              nurses={nurses}
              value={nurseId}
              onChange={setNurseId}
              error={error}
            />
            {error && (
              <p role="alert" className="mt-1.5 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
              className="h-10 rounded-xl"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={busy} className="h-10 gap-2 rounded-xl font-semibold">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Affecter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminTeamsView() {
  const { data, loading, error, reload } = useAdminResource<TeamResponse>(
    "/api/admin/teams",
  );
  const [dispatchTarget, setDispatchTarget] = useState<DispatchQueueItem | null>(
    null,
  );
  const [zoneFilter, setZoneFilter] = useState("all");

  const teams = data?.teams ?? EMPTY_BOARD;

  // Soignants suspendus : ils ne peuvent pas recevoir de mission, on les
  // exclut du sélecteur plutôt que de laisser une affectation échouer.
  const dispatchable = teams.nurses.filter(n => n.isActive);

  const queue = useMemo(
    () =>
      zoneFilter === "all"
        ? teams.queue
        : teams.queue.filter(item => item.zone === zoneFilter),
    [teams.queue, zoneFilter],
  );

  const nurses = useMemo(
    () =>
      zoneFilter === "all"
        ? teams.nurses
        : teams.nurses.filter(n => n.zone === zoneFilter),
    [teams.nurses, zoneFilter],
  );

  if (error && data === null) {
    return <LoadError onRetry={() => void reload()} />;
  }

  if (loading && data === null) {
    return <ListSkeleton rows={4} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void reload()}
          aria-label="Rafraîchir la supervision"
          className="size-9 shrink-0 rounded-full"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* ——— Supervision : l'état de l'effectif en un coup d'œil ——— */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            label: "Infirmiers actifs",
            value: teams.totals.activeNurses,
            tone: "text-foreground",
          },
          {
            label: "Missions en cours",
            value: teams.totals.activeMissions,
            tone: "text-foreground",
          },
          {
            label: "À affecter",
            value: teams.totals.unassigned,
            tone:
              teams.totals.unassigned > 0
                ? "text-destructive"
                : "text-foreground",
          },
          {
            label: "Terminées ce mois",
            value: teams.totals.completedThisMonth,
            tone: "text-foreground",
          },
        ].map(stat => (
          <li key={stat.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${stat.tone}`}>
              {stat.value}
            </p>
          </li>
        ))}
      </ul>

      {/* Alerte : file d'attente non vide = un patient à domicile attend un
          intervenant. C'est le seul état qui justifie une action immédiate,
          donc le seul à être signalé en couleur d'alerte. */}
      {teams.totals.unassigned > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {teams.totals.unassigned} domicile(s) en attente d&apos;un
            intervenant — affectez-les pour ne pas laisser ces patients sans
            suivi.
          </span>
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Répartition par zone</h2>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger
            className="h-9 w-44 rounded-xl"
            aria-label="Filtrer la supervision par zone"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {Object.entries(ZONE_LABELS).map(([zone, label]) => (
              <SelectItem key={zone} value={zone}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ——— Dispatch : la file qui attend un intervenant ——— */}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4" aria-hidden="true" />
          File d&apos;affectation
          {queue.length > 0 && (
            <Badge variant="destructive" className="tabular-nums">
              {queue.length}
            </Badge>
          )}
        </h2>

        {queue.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            Aucun domicile en attente d&apos;affectation.
          </p>
        ) : (
          <ul className="grid gap-3">
            {queue.map(item => (
              <li
                key={item.id}
                className="rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCardSlotUTC(item.scheduledAt)}
                      {item.specialtyName ? ` · ${item.specialtyName}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatPhoneDisplay(item.patientPhone)}
                    </p>
                  </div>
                  <ZoneBadge zone={item.zone} />
                </div>

                {item.reason && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Motif : </span>
                    {item.reason}
                  </p>
                )}

                <Button
                  onClick={() => setDispatchTarget(item)}
                  disabled={dispatchable.length === 0}
                  className="mt-4 h-9 w-full gap-2 rounded-xl text-sm font-semibold"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Affecter un infirmier
                </Button>
              </li>
            ))}
          </ul>
        )}

        {dispatchable.length === 0 && teams.nurses.length > 0 && (
          <p className="rounded-xl bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
            Aucun infirmier actif — réactivez un compte avant d&apos;affecter.
          </p>
        )}
      </section>

      {/* ——— Supervision par zone ——— */}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4" aria-hidden="true" />
          Charge par zone
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.zoneLoad
            .filter(zone => zoneFilter === "all" || zone.zone === zoneFilter)
            .map(zone => {
              // Ratio de tension : des visites à faire avec personne ou presque.
              const pressure = zone.unassigned > 0;
              return (
                <li
                  key={zone.zone}
                  className="rounded-2xl border bg-card p-4 shadow-sm"
                >
                  <p className="flex items-center gap-2 font-semibold">
                    {zone.label}
                    {zone.activeNurses === 0 && (
                      <Badge variant="destructive" className="font-normal">
                        Aucun soignant
                      </Badge>
                    )}
                  </p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Soignants</dt>
                      <dd className="font-semibold tabular-nums">
                        {zone.activeNurses}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">En cours</dt>
                      <dd className="font-semibold tabular-nums">
                        {zone.activeMissions}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">À affecter</dt>
                      <dd
                        className={`font-semibold tabular-nums ${pressure ? "text-destructive" : ""}`}
                      >
                        {zone.unassigned}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
        </ul>
      </section>

      {/* ——— Charge individuelle ——— */}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4" aria-hidden="true" />
          Charge par infirmier
        </h2>

        {nurses.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            Aucun infirmier dans cette zone.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...nurses]
              .sort((a, b) => b.activeMissions - a.activeMissions)
              .map(nurse => (
                <li
                  key={nurse.id}
                  className="rounded-2xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold">{nurse.fullName}</p>
                    <ZoneBadge zone={nurse.zone} />
                  </div>

                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
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
                        {nurse.lastMissionAt
                          ? formatDateUTC(nurse.lastMissionAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {nurse.pendingAcceptance > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      {nurse.pendingAcceptance} en attente d&apos;acceptation
                    </p>
                  )}

                  {!nurse.isActive && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Compte suspendu — excluded du dispatch.
                    </p>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Sanity check : si des missions actives existent sans file d'attente,
          le dispatch n'a rien à faire. On ne l'affiche pas. */}
      {teams.totals.activeMissions > 0 && teams.totals.unassigned === 0 && (
        <p className="flex items-center gap-2 rounded-2xl border bg-success/10 p-3 text-sm text-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Tous les domiciles en attente ont un intervenant.
        </p>
      )}

      <DispatchDialog
        item={dispatchTarget}
        nurses={dispatchable}
        onClose={() => setDispatchTarget(null)}
        onDone={reload}
      />
    </div>
  );
}