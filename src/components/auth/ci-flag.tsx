// Drapeau Côte d'Ivoire en CSS pur — évite les emojis drapeaux, absents
// sous Windows. Partagé par les formulaires Connexion / Inscription.
export function FlagCI() {
  return (
    <span
      className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10"
      aria-hidden="true"
    >
      <span className="h-full w-1/3 bg-[#F77F00]" />
      <span className="h-full w-1/3 bg-white" />
      <span className="h-full w-1/3 bg-[#009E60]" />
    </span>
  );
}
