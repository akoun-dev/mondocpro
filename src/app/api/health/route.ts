// GET /api/health — Sonde de vie + base de données (contrat API_CONTRACTS.md v2)
// Vérification de santé utilisée par les tests E2E et le monitoring.
// Toujours HTTP 200 : l'état DB est porté par le corps (`database`, `status`)
// afin que la sonde réponde même pendant un incident de base de données.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  let database: "up" | "down" = "down";
  try {
    await db.$queryRawUnsafe("SELECT 1");
    database = "up";
  } catch (e) {
    console.error("[health] probe DB échouée:", e);
  }

  return NextResponse.json({
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString(),
  });
}
