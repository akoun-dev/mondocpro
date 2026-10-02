// Seed éditorial FEATURE-SENSO — contenus de sensibilisation réalistes.
// Idempotent : purges puis réinsertion (contenu de référence géré par le seed,
// la rédaction ADMIN arrivera avec FEATURE-SENSO phase 2).
// Usage : bun .zscripts/seed_sensibilisations.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONTENUS = [
  {
    title: "Paludisme : protégez votre famille pendant la saison des pluies",
    body: "La saison des pluies augmente la présence de moustiques anophèles, vecteurs du paludisme. Pour vous protéger :\n\n1. Dormez chaque nuit sous une moustiquaire imprégnée d'insecticide.\n2. Éliminez les eaux stagnantes autour de la maison (pneus, canaris, gouttières).\n3. Couvrez les bras et les jambes au crépuscule.\n\nConsultez immédiatement en cas de fièvre supérieure à 38 °C avec frissons, maux de tête ou vomissements. Un test rapide (TDR) au cabinet permet un diagnostic en 15 minutes. Ne prenez jamais d'antipaludique sans test positif ni prescription.",
    category: "ALERTE" as const,
    zones: [] as string[],
  },
  {
    title: "Lavage des mains : le geste le plus simple contre les infections",
    body: "Se laver les mains au savon réduit jusqu'à 40 % le risque de diarrhée et 25 % le risque d'infection respiratoire. Les bons moments :\n\n· Avant de cuisiner ou de manger\n· Après les toilettes\n· Après avoir changé un bébé\n· En rentrant de l'extérieur ou du marché\n\nLavez-vous les mains pendant au moins 20 secondes, en frottant paumes, dos des mains, entre les doigts et sous les ongles. À défaut d'eau courante, utilisez de l'eau propre stockée dans un récipient fermé.",
    category: "CONSEIL" as const,
    zones: [] as string[],
  },
  {
    title: "Vaccination des enfants de 0 à 5 ans : vérifiez le carnet",
    body: "Chaque vaccin du Programme Élargi de Vaccination protège contre une maladie grave : tuberculose (BCG), polio, rougeole, fièvre jaune, hépatite B…\n\nVérifiez que le carnet de votre enfant est à jour. Les rendez-vous clés : naissance, 6 semaines, 10 semaines, 14 semaines, 9 mois et 12-18 mois selon les rappels.\n\nUn retard n'est jamais une perte : les doses rattrapées reprennent simplement là où le carnet s'est arrêté. Passez au cabinet pour une mise à jour gratuite de son calendrier.",
    category: "CONSEIL" as const,
    zones: ["YOPOUGON", "PK22"],
  },
  {
    title: "Eau de boisson : prudence après les fortes pluies",
    body: "Après des inondations, l'eau des puits et des bornes-fontaines peut être contaminée (choléra, typhoïde, gastro-entérites). Avant de boire :\n\n1. Faites bouillir l'eau 5 minutes à gros bouillons, OU\n2. Traitez-la avec du chlore (Aquatabs / Waterguard) selon la notice.\n\nConservez l'eau traitée dans un récipient propre et fermé. Lavez les ustensiles avec cette même eau. En cas de diarrhée aqueuse soudaine dans le foyer, réhydratez (SRO) et consultez sans attendre.",
    category: "ALERTE" as const,
    zones: ["SONGON", "NDOTRE"],
  },
  {
    title: "Diabète et hypertension : deux dépistages simples, à jeun",
    body: "Le diabète et l'hypertension artérielle évoluent des années sans symptôme. Un dépistage annuel suffit à les repérer :\n\n· Glycémie à jeun : après 12 heures sans manger (dîner léger, eau autorisée).\n· Tension artérielle : mesure au cabinet, au repos, sur deux visites.\n\nSi vous êtes traité, ne stoppez jamais le traitement parce que « vous vous sentez bien » : l'équilibre mesuré est justement l'effet du traitement. Apportez vos ordonnances et votre carnet à chaque consultation.",
    category: "CONSEIL" as const,
    zones: [] as string[],
  },
  {
    title: "Grossesse : un suivi prénatal chaque mois protège maman et bébé",
    body: "Le suivi prénatal détecte tôt l'anémie, l'hypertension et les grossesses à risque. Le rythme recommandé : une consultation par mois jusqu'au 8e mois, puis deux par mois jusqu'à l'accouchement.\n\nChaque visite comprend : pesée, tension, mesure de la hauteur utérine et écoute des bruits du cœur du bébé. Apportez le carnet de grossesse à chaque visite et prenez le fer + acide folique prescrit, même sans fatigue.\n\nPrévoyez dès maintenant votre plan d'accouchement : établissement de référence, transport, accompagnant.",
    category: "CONSEIL" as const,
    zones: ["YOPOUGON", "SONGON"],
  },
];

async function main() {
  console.log("[seed_sensibilisations] purge des contenus existants…");
  const deleted = await prisma.sensibilisation.deleteMany({});
  console.log(`[seed_sensibilisations] ${deleted.count} contenu(s) supprimé(s)`);

  const created = await prisma.sensibilisation.createMany({
    data: CONTENUS.map((c, index) => ({
      ...c,
      zones: c.zones as never,
      publishedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000), // décalage d'un jour
    })),
  });
  console.log(`[seed_sensibilisations] ${created.count} sensibilisation(s) créée(s)`);

  const total = await prisma.sensibilisation.count();
  console.log(`[seed_sensibilisations] total en base : ${total}`);
}

main()
  .catch((e) => {
    console.error("[seed_sensibilisations] échec:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
