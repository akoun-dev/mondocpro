import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
    const guard = await requireRole(["NURSE"])
    if (!guard.ok) return guard.response

    try {
        const missions = await db.nurseMission.findMany({
            where: { nurseId: guard.user.id },
            orderBy: { assignedAt: "desc" },
            select: {
                status: true,
                assignedAt: true,
                patient: { select: { id: true, fullName: true, phone: true, zone: true } },
                appointment: {
                    select: {
                        scheduledAt: true,
                        type: true,
                        reason: true,
                        specialty: { select: { name: true } },
                    },
                },
            },
        })

        const patients = new Map<string, {
            id: string
            fullName: string
            phone: string
            zone: string
            missionCount: number
            lastMissionAt: string
            lastMission: { status: string; scheduledAt: string; type: string; reason: string | null; specialty: string | null }
        }>()

        for (const mission of missions) {
            const existing = patients.get(mission.patient.id)
            if (existing) {
                existing.missionCount += 1
                continue
            }
            patients.set(mission.patient.id, {
                id: mission.patient.id,
                fullName: mission.patient.fullName,
                phone: mission.patient.phone,
                zone: mission.patient.zone,
                missionCount: 1,
                lastMissionAt: mission.assignedAt.toISOString(),
                lastMission: {
                    status: mission.status,
                    scheduledAt: mission.appointment.scheduledAt.toISOString(),
                    type: mission.appointment.type,
                    reason: mission.appointment.reason,
                    specialty: mission.appointment.specialty?.name ?? null,
                },
            })
        }

        return NextResponse.json({ patients: [...patients.values()] })
    } catch (error) {
        console.error("[nurse/patients GET]", error)
        return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 })
    }
}
