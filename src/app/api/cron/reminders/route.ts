// GET|POST /api/cron/reminders — tick du scheduler des rappels de RDV
// (FEATURE-RDV, Task 23). À brancher sur un planificateur externe (Vercel Cron,
// cron système…) : chaque appel traite les RDV CONFIRMÉS commençant dans moins
// de 24 h dont le patient a activé les rappels, via la passerelle SMS.
// Auth : header `Authorization: Bearer ${CRON_SECRET}` (comparaison à temps
// constant). CRON_SECRET absent = scheduler non configuré (la passerelle SMS
// est en attente de la décision A10) → 503 explicite, jamais d'envoi en silence.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processDueReminders } from "@/lib/reminders";

function secretsMatch(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Rappels non configurés — CRON_SECRET absent (passerelle SMS : décision A10 en attente)",
      },
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || !secretsMatch(token, secret)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await processDueReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/reminders] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
