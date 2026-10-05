"use client"

// Vue « Patients » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN.
// Annuaire des dossiers patients : recherche, filtre par zone et par état de
// compte, puis ouverture d'un dossier qui affiche l'historique des
// consultations (avec compte rendu de visite) filtrable par période et statut.
//
// Deux appels : GET /api/admin/patients pour la liste, puis
// GET /api/admin/patients/:id à l'ouverture d'un dossier (chargement différé —
// l'historique n'est utile que pour le dossier consulté).

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  FileText,
  HeartPulse,
  RefreshCw,
  Stethoscope,
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
  ACCOUNT_PERIOD,
  ACCOUNT_PERIOD_LABELS,
  HISTORY_STATUS_CLASSES,
  HISTORY_STATUS_LABELS,
  HISTORY_STATUS_SHORT,
  APPOINTMENT_TYPE_LABELS,
  type AccountFilterValue,
  type AccountPeriodValue,
  type HistoryStatusValue,
  type PatientConsultation,
  type PatientDetail,
  type PatientListItem,
} from "@/lib/admin-users-schemas";

type PatientListResponse = { patients: PatientListItem[] };
type PatientDetailResponse = { patient: PatientDetail };

const EMPTY_LIST: PatientListResponse = { patients: [] };

/** Anti-rebond de la recherche : évite un appel par frappe clavier. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Constantes du compte rendu de visite — l'ordre suit la saisie infirmier. */
const VITAL_SIGNS_LABELS: Record<string, string> = {
  temperature: "Température",
  systolic: "Systolique",
  diastolic: "Diastolique",
  pulse: "Pouls",
  respiratoryRate: "Fréquence respiratoire",
  spo2: "SpO₂",
  glucose: "Glycémie",
  weight: "Poids",
  height: "Taille",
};

function VitalSigns({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      {entries.map(([key, raw]) => (
        <div key={key} className="flex items-center gap-1">
          <dt className="text-muted-foreground">
            {VITAL_SIGNS_LABELS[key] ?? key}:
          </dt>
          <dd className="font-medium tabular-nums">{String(raw)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Une consultation de l'historique, compte rendu replié par défaut. */
function ConsultationCard({
  consultation,
}: {
  consultation: PatientConsultation;
}) {
  const [open, setOpen] = useState(false);
  const { report } = consultation;

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {consultation.specialtyName ?? "Consultation"}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDateUTC(consultation.scheduledAt)}
            {" · "}
            {APPOINTMENT_TYPE_LABELS[consultation.type] ?? consultation.type}
            {" · "}
            <ZoneBadge zone={consultation.zone} />
          </p>
        </div>
        <Badge
          className={
            HISTORY_STATUS_CLASSES[consultation.status] ??
            "bg-muted text-muted-foreground"
          }
        >
          {HISTORY_STATUS_SHORT[consultation.status] ?? consultation.status}
        </Badge>
      </div>

      {consultation.reason && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Motif : </span>
          {consultation.reason}
        </p>
      )}

      {consultation.nurse && (
        <p className="mt-1 text-sm text-muted-foreground">
          Intervenant(e) : {consultation.nurse.fullName}
        </p>
      )}

      {report && (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="h-9 gap-2 rounded-xl px-3 text-sm font-semibold"
            aria-expanded={open}
          >
            <FileText className="size-4" aria-hidden="true" />
            {open ? "Masquer le compte rendu" : "Lire le compte rendu"}
          </Button>

          {open && (
            <div className="mt-2 grid gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
              <div>
                <p className="font-semibold">Observations</p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {report.observations}
                </p>
              </div>
              {report.actionsTaken && (
                <div>
                  <p className="font-semibold">Actions menées</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {report.actionsTaken}
                  </p>
                </div>
              )}
              {report.recommendations && (
                <div>
                  <p className="font-semibold">Recommandations</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {report.recommendations}
                  </p>
                </div>
              )}
              <VitalSigns value={report.vitalSigns} />
              <p className="text-xs text-muted-foreground">
                Rédigé par {report.nurseName} le {formatDateUTC(report.createdAt)}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Dialog de dossier — l'historique se recharge à chaque changement de filtre. */
function PatientDossier({
  patientId,
  onClose,
}: {
  patientId: string | null;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<AccountPeriodValue>("all");
  const [status, setStatus] = useState<HistoryStatusValue>("all");

  const url =
    patientId === null
      ? null
      : `/api/admin/patients/${patientId}${adminQuery({
          period: period === "all" ? undefined : period,
          status: status === "all" ? undefined : status,
        })}`;

  const { data, loading, error, reload } =
    useAdminResource<PatientDetailResponse>(url);

  const record = data?.patient;
  const patient = record?.patient;

  return (
    <Dialog open={patientId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" aria-hidden="true" />
            {patient ? patient.fullName : "Dossier patient"}
          </DialogTitle>
          <DialogDescription>
            {patient
              ? `Créé le ${formatDateUTC(patient.createdAt)} · ${patient.phone}`
              : "Chargement du dossier…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <LoadError onRetry={() => void reload()} />
        ) : loading && patient === undefined ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-20 rounded-2xl" aria-hidden="true" />
            <Skeleton className="h-40 rounded-2xl" aria-hidden="true" />
          </div>
        ) : patient ? (
          <>
            {/* Compteurs globaux — indépendants des filtres : ils décrivent
                le dossier, pas la sélection courante. */}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Consultations", value: record?.summary.total },
                { label: "Terminées", value: record?.summary.done },
                { label: "À venir", value: record?.summary.upcoming },
                { label: "Domiciles", value: record?.summary.homeVisits },
              ].map(stat => (
                <li key={stat.label} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {stat.value ?? 0}
                  </p>
                </li>
              ))}
            </ul>

            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField id="history-period" label="Période">
                <Select
                  value={period}
                  onValueChange={(value) => setPeriod(value as AccountPeriodValue)}
                >
                  <SelectTrigger id="history-period" className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_PERIOD.map(option => (
                      <SelectItem key={option} value={option}>
                        {ACCOUNT_PERIOD_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField id="history-status" label="Statut">
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as HistoryStatusValue)}
                >
                  <SelectTrigger id="history-status" className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["all", "done", "upcoming", "cancelled"] as const).map(
                      option => (
                        <SelectItem key={option} value={option}>
                          {HISTORY_STATUS_LABELS[option]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FilterField>
            </div>

            {data?.patient.consultations.length === 0 ? (
              <p className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Aucune consultation ne correspond à ces filtres.
              </p>
            ) : (
              <ul className="grid gap-3">
                {record?.consultations.map(consultation => (
                  <ConsultationCard
                    key={consultation.id}
                    consultation={consultation}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AdminPatientsView() {
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("all");
  const [accountStatus, setAccountStatus] = useState<AccountFilterValue>("all");
  const [openPatient, setOpenPatient] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const url = `/api/admin/patients${adminQuery({
    search: debouncedSearch || undefined,
    zone: zone === "all" ? undefined : zone,
    status: accountStatus === "all" ? undefined : accountStatus,
  })}`;

  const { data, loading, error, reload } =
    useAdminResource<PatientListResponse>(url);
  const patients = data?.patients ?? EMPTY_LIST.patients;

  // Tri par dernière visite : à défaut de recherche, ce que le Médecin Chef
  // veut voir en premier, c'est le dossier qui n'a pas été vu récemment.
  const sorted = useMemo(() => {
    if (debouncedSearch.trim()) return patients;
    return [...patients].sort((a, b) => {
      // Dossiers jamais consultés en dernier, donc ils remontent en tête.
      if (!a.lastVisitAt && !b.lastVisitAt) return a.fullName.localeCompare(b.fullName);
      if (!a.lastVisitAt) return -1;
      if (!b.lastVisitAt) return 1;
      return (
        new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime()
      );
    });
  }, [patients, debouncedSearch]);

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
          placeholder="Rechercher un patient (nom ou téléphone)"
          label="Rechercher un patient"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterField id="patients-zone" label="Zone">
            <ZoneFilter value={zone} onChange={setZone} />
          </FilterField>
          <FilterField id="patients-status" label="État du compte">
            <AccountFilterSelect
              value={accountStatus}
              onChange={setAccountStatus}
            />
          </FilterField>
        </div>
      </div>

      {!loading && patients.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CountBadge value={patients.length} />
          {patients.length === 1 ? "patient trouvé" : "patients trouvés"}
        </p>
      )}

      {error && data === null ? (
        <LoadError onRetry={() => void reload()} />
      ) : loading && data === null ? (
        <ListSkeleton rows={4} />
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <HeartPulse className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Aucun patient ne correspond.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Élargissez la recherche ou changez de zone.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sorted.map(patient => (
            <li key={patient.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <AccountIdentity
                  fullName={patient.fullName}
                  phone={patient.phone}
                  suspended={!patient.isActive}
                />
                <ZoneBadge zone={patient.zone} />
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Consultations</dt>
                  <dd className="font-semibold tabular-nums">{patient.doneCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Dernière visite</dt>
                  <dd className="font-semibold">
                    <DateOrDash value={patient.lastVisitAt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prochain RDV</dt>
                  <dd className="font-semibold">
                    <DateOrDash value={patient.nextVisitAt} />
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenPatient(patient.id)}
                  className="h-9 flex-1 gap-2 rounded-xl text-sm font-semibold"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  Ouvrir le dossier
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant={patient.isActive ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => suspension.open(patient)}
                  className="h-9 gap-2 rounded-xl text-sm font-semibold"
                >
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {patient.isActive ? "Suspendre" : "Réactiver"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PatientDossier
        patientId={openPatient}
        onClose={() => setOpenPatient(null)}
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
