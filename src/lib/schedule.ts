// Règles de créneaux FEATURE-RDV — module CLIENT-SAFE (aucun import serveur).
// Source partagée par le service métier (src/lib/appointments.ts, côté API) et
// le formulaire de réservation (côté client) : une seule définition des règles,
// zéro divergence front/back. Arbitrages MVP documentés dans la spec
// FEATURE-PATIENT (A1/A2/A6), modifiables sans migration :
//   · Lundi → vendredi, 08:00 – 17:00 (dernier créneau 16:30)
//   · Grille de 30 minutes
//   · Réservation ≥ 2 h à l'avance, jusqu'à 60 jours
//   · Fuseau Afrique/Abidjan = UTC+0 sans heure d'été : l'heure locale EST
//     l'heure UTC (A6) — toutes les composantes sont lues en UTC.
export const SLOT_MINUTES = 30;
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 17;
export const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // getUTCDay : 0 = dimanche
export const MIN_LEAD_MINUTES = 120;
export const MAX_DAYS_AHEAD = 60;

// Erreur métier transportant le statut HTTP de la réponse API.
export class AppointmentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// Grille des créneaux d'une journée (« 08:00 » … « 16:30 »).
export function listDaySlots(): string[] {
  const slots: string[] = [];
  for (
    let minutes = OPENING_HOUR * 60;
    minutes < CLOSING_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

export function slotToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

// Validation des règles de créneau — messages en français affichés au patient.
export function validateSlot(scheduledAt: Date, now = new Date()): void {
  const day = scheduledAt.getUTCDay();
  const minutes = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();

  if (scheduledAt.getUTCSeconds() !== 0 || minutes % SLOT_MINUTES !== 0) {
    throw new AppointmentError(
      `Le créneau doit être aligné sur la grille de ${SLOT_MINUTES} minutes`,
      400,
    );
  }
  if (!BUSINESS_DAYS.includes(day)) {
    throw new AppointmentError(
      "Les rendez-vous sont proposés du lundi au vendredi",
      400,
    );
  }
  if (minutes < OPENING_HOUR * 60 || minutes >= CLOSING_HOUR * 60) {
    throw new AppointmentError(
      `Les créneaux vont de ${String(OPENING_HOUR).padStart(2, "0")}:00 à ${CLOSING_HOUR - 1}:30`,
      400,
    );
  }
  const minTime = now.getTime() + MIN_LEAD_MINUTES * 60 * 1000;
  if (scheduledAt.getTime() < minTime) {
    throw new AppointmentError(
      `Le rendez-vous doit être pris au moins ${MIN_LEAD_MINUTES / 60} heures à l'avance`,
      400,
    );
  }
  const maxTime = now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  if (scheduledAt.getTime() > maxTime) {
    throw new AppointmentError(
      `Le rendez-vous ne peut pas être pris à plus de ${MAX_DAYS_AHEAD} jours`,
      400,
    );
  }
}

// Date UTC « 2025-10-25 » (clé de jour côté Abidjan : l'heure locale est UTC).
export function utcDateKey(now: Date = new Date()): string {
  return `${String(now.getUTCFullYear()).padStart(4, "0")}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

export type BookableDay = {
  /** Clé ISO « 2025-10-25 » — valeur envoyée à l'API. */
  key: string;
  /** Date calendaire UTC 00:00 du jour (rendu / comparaisons). */
  date: Date;
  /** Jour chômé présent dans la liste pour affichage grisé ? Toujours false ici. */
  isBusiness: true;
};

// Jours ouvrés réservables à partir d'aujourd'hui (inclus), jusqu'à
// MAX_DAYS_AHEAD. Aujourd'hui reste proposé : ses créneaux passés sont
// désactivés dans la grille (délai ≥ 2 h) — le serveur revalide toujours.
export function listBookableDays(now: Date = new Date()): BookableDay[] {
  const days: BookableDay[] = [];
  const startMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  for (let offset = 0; offset <= MAX_DAYS_AHEAD; offset += 1) {
    const date = new Date(startMs + offset * 86_400_000);
    if (BUSINESS_DAYS.includes(date.getUTCDay())) {
      days.push({
        key: utcDateKey(date),
        date,
        isBusiness: true,
      });
    }
  }
  return days;
}

// Un créneau précis est-il réservable maintenant ? (délai ≥ 2 h, ≤ 60 jours)
export function isSlotBookableNow(
  date: string,
  time: string,
  now: Date = new Date(),
): boolean {
  const scheduledAt = slotToDate(date, time);
  return (
    scheduledAt.getTime() >= now.getTime() + MIN_LEAD_MINUTES * 60 * 1000 &&
    scheduledAt.getTime() <=
      now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000
  );
}
