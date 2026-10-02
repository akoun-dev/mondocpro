// GET /api — Index de l'API (remplace le hello-world du scaffold).
// La sonde de vie contractuelle est /api/health.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Mon doc Pro API",
    timestamp: new Date().toISOString(),
  });
}
