import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listNurseMissions } from "@/lib/nurse";

export async function GET() {
  const guard = await requireRole(["NURSE"]);
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ missions: await listNurseMissions(guard.user.id) });
  } catch (error) {
    console.error("[nurse/missions GET]", error);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
