// Helpers téléphone Côte d'Ivoire — partagés par les formulaires d'authentification.
// L'UI affiche un indicatif +225 fixe : l'utilisateur saisit le numéro local
// (10 chiffres), normalisé vers l'international avant validation et envoi
// (le schéma API accepte +?[0-9]{8,15}).

export function toInternationalPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // Tolère un collage incluant l'indicatif (+225 07 01 02 03 04 → 0701020304).
  if (digits.length > 10 && digits.startsWith("225")) digits = digits.slice(3);
  return `+225${digits}`;
}

// Affichage lisible : +225 07 01 02 03 04.
export function formatPhoneDisplay(phone: string): string {
  const match = phone.match(/^\+225(\d{1,15})$/);
  if (!match) return phone;
  return `+225 ${match[1].replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}
