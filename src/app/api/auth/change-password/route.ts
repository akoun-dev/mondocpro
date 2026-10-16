// POST /api/auth/change-password — FEATURE-NURSE-PROFIL (Task 34, contrat
// API_CONTRACTS.md) — changement de mot de passe UTILISATEUR AUTHENTIFIÉ.
// Diffère du flux forgot/reset (US-AUTH-5) : ici l'utilisateur est connecté et
// prouve sa possession du compte via le mot de passe ACTUEL — aucun SMS requis
// (la passerelle reste en attente, ADR-006).
// Sécurité :
//   - le user ciblé est TOUJOURS celui de la session (jamais pris du corps) ;
//   - mot de passe actuel vérifié bcrypt (hash factice si absent — même
//     durée de comparaison, anti timing-attack, cf. login) ;
//   - nouveau mot de passe identique à l'actuel refusé (400) ;
//   - toutes les AUTRES sessions du compte sont révoquées après succès (un
//     appareil oublié ne survit pas au changement) — la session courante est
//     préservée : l'utilisateur n'est pas déconnecté de l'appareil présent ;
//   - erreurs génériques : aucune fuite d'information.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  hashToken,
  requireRole,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { changePasswordSchema } from "@/lib/auth-schemas";

// Hash factice : même durée de comparaison que pour un vrai hash (anti
// timing-attack) — réutilise la constante du contrat login.
const DUMMY_HASH = "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ZUbE0f8bZ0tA1X8s7Q9mW3x4yZ5b6C";

export async function POST(request: Request) {
  const guard = await requireRole(["PATIENT", "NURSE", "ADMIN"]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)" },
      { status: 400 }
    );
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { currentPassword, password } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { id: guard.user.id },
      select: { id: true, passwordHash: true },
    });

    const valid =
      user !== null &&
      (await verifyPassword(currentPassword, user.passwordHash ?? DUMMY_HASH));

    if (!user || !valid) {
      return NextResponse.json(
        {
          error: "Veuillez corriger les champs signalés",
          details: [
            {
              field: "currentPassword",
              message: "Mot de passe actuel incorrect",
            },
          ],
        },
        { status: 400 }
      );
    }

    if (await verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        {
          error: "Veuillez corriger les champs signalés",
          details: [
            {
              field: "password",
              message:
                "Le nouveau mot de passe doit être différent de l'actuel",
            },
          ],
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Révocation des AUTRES sessions : la session courante (ce navigateur)
    // reste valide — le cookie n'est pas remplacé.
    const store = await cookies();
    const currentToken = store.get(SESSION_COOKIE)?.value;
    if (currentToken) {
      await db.session.deleteMany({
        where: {
          userId: user.id,
          NOT: { tokenHash: hashToken(currentToken) },
        },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[auth/change-password] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 }
    );
  }
}
