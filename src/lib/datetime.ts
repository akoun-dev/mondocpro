// Utilitaires de formatage date/heure — espace patient (FEATURE-PATIENT UI).
// Fuseau Afrique/Abidjan : UTC+0 toute l'année, sans heure d'été (cf. FEATURE-RDV)
// → l'heure locale EST l'heure UTC. Tous les rendus passent explicitement par
// les composantes UTC (ou timeZone: "UTC" pour Intl) afin d'être stables
// quel que soit le fuseau de l'appareil du patient.
const FR = "fr-FR";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// « Jeudi 24 octobre 2025 • UTC+0 » — date du jour côté Abidjan.
export function formatWelcomeDate(now: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat(FR, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  return `${capitalize(formatted)} • UTC+0`;
}

// « Samedi 3 oct • UTC+0 » — date compacte de la barre d'en-tête (maquette PO
// 2026-10 v2) : mois abrégé sans point, sans année.
export function formatHeaderDate(now: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat(FR, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(now);
  return `${capitalize(formatted.replace(/\./g, ""))} • UTC+0`;
}

// « 09:30 »
export function formatTimeUTC(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

// Écart en jours calendaires UTC entre le créneau et maintenant (négatif = passé).
export function calendarDayDiffUTC(iso: string, now: Date = new Date()): number {
  const date = new Date(iso);
  const slotDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((slotDay - nowDay) / 86_400_000);
}

// « sam. 7 nov. »
function formatShortDateUTC(iso: string): string {
  return new Intl.DateTimeFormat(FR, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// « Aujourd'hui à 09:30 » · « Demain à 09:30 » · « Sam 7 nov. à 09:30 »
export function relativeSlotLabel(iso: string, now: Date = new Date()): string {
  const diff = calendarDayDiffUTC(iso, now);
  const time = formatTimeUTC(iso);
  if (diff === 0) return `Aujourd'hui à ${time}`;
  if (diff === 1) return `Demain à ${time}`;
  return `${capitalize(formatShortDateUTC(iso))} à ${time}`;
}

// « Jeudi 24 octobre 2025 à 09:30 (heure d'Abidjan) » — détail complet.
export function formatFullSlotUTC(iso: string): string {
  const formatted = new Intl.DateTimeFormat(FR, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${capitalize(formatted)} (heure d'Abidjan)`;
}

// « Vendredi 25 oct. 2025 à 09:30 » — format des cartes RDV (maquette PO).
// Intl fr-FR insère « , » avant l'heure → remplacé par « à » (maquette).
export function formatCardSlotUTC(iso: string): string {
  const formatted = new Intl.DateTimeFormat(FR, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
  return capitalize(formatted).replace(", ", " à ");
}

// « 24 oct. 2025 » — dates sans heure (création de compte, demande de RDV…).
export function formatDateUTC(iso: string): string {
  return new Intl.DateTimeFormat(FR, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// « Il y a 3 h » · « Il y a 2 j » · « 24 oct. » — publications (compact, maquette PO).
export function relativePublishedLabel(
  iso: string,
  now: Date = new Date(),
): string {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "À l'instant";
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return capitalize(
    new Intl.DateTimeFormat(FR, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(iso)),
  );
}

// Référence courte affichable d'un rendez-vous : « #MDP-4F2A ».
export function appointmentRef(id: string): string {
  return `#MDP-${id.slice(-4).toUpperCase()}`;
}

// Durée d'écoute estimée d'un texte (lecture vocale ≈ 150 mots/min), min 1 min.
export function estimatedListenMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 150));
}
