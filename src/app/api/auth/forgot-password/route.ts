// POST /api/auth/forgot-password — US-AUTH-5 (contrat API_CONTRACTS.md)
// Étape 1 : demande de code de réinitialisation.
// ANTI-ÉNUMÉRATION : réponse 200 identique que le compte existe ou non —
// aucune information n'est divulguée sur l'existence d'un numéro.
// Livraison : passerelle SMS à brancher (INT-SMS, TODO) — placeholder console.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  PASSWORD_RESET_TTL_MINUTES,
  generateResetCode,
  hashToken,
} from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/auth-schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide (JSON attendu)" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { phone } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { phone } });

    if (user) {
      // Un seul jeton actif par compte : les précédents non utilisés sont purgés.
      await db.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const code = generateResetCode();
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(code),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
        },
      });

      // TODO INT-SMS : brancher la passerelle SMS (Orange CI / MTN CI) ici.
      // En attendant, le code n'est JAMAIS renvoyé dans la réponse HTTP —
      // il n'apparaît que dans les logs serveur (dev.log) pour les tests.
      console.log(
        `[SMS-TODO] Code de réinitialisation pour ${phone} : ${code} ` +
          `(valide ${PASSWORD_RESET_TTL_MINUTES} min)`,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "Si ce numéro est inscrit, un code à 6 chiffres vous a été envoyé par SMS.",
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("[auth/forgot-password] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
