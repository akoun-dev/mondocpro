// POST /api/auth/register — FEATURE-AUTH (contrat API_CONTRACTS.md)
// Inscription Patient uniquement — le rôle PATIENT est forcé côté serveur
// (décision PO 2026-10 : pas de choix de rôle à l'inscription, INFIRMIER/ADMIN
// créés par l'administration). ADMIN refusé (seed uniquement — ADR-004 §5).
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide (JSON attendu)" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
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

  const { fullName, phone, password, zone } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      // Rôle forcé serveur : aucune confiance aux données client (convention API).
      data: { fullName, phone, passwordHash, role: "PATIENT" as const, zone },
    });

    await createSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" // violation d'unicité (course entre findUnique et create)
    ) {
      return NextResponse.json(
        { error: "Ce numéro est déjà inscrit. Connectez-vous." },
        { status: 409 },
      );
    }
    console.error("[auth/register] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
