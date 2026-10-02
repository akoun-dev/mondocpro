// GET /api/health — Sonde de vie (contrat API_CONTRACTS.md)
// Vérification de santé utilisée par les tests E2E et le monitoring.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
