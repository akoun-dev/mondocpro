// Service d'authentification — FEATURE-AUTH (ADR-004)
// Côté serveur uniquement (bcrypt, sessions, cookies) — jamais importé côté client.
import { createHash, randomBytes, randomInt } from "node:crypto"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import type { Role, Zone } from "@prisma/client"

export const SESSION_COOKIE = "Mon doc Pro_session"
const SESSION_TTL_DAYS = 30
// Session courte (« Se souvenir de moi » décoché) : le cookie expire à la
// fermeture du navigateur et le token serveur au bout de 24 h.
const SESSION_SHORT_TTL_DAYS = 1
const BCRYPT_ROUNDS = 10

// Profil exposé au client — JAMAIS de passwordHash ni de session interne.
export type PublicUser = {
    id: string
    fullName: string
    phone: string
    role: Role
    zone: Zone
    createdAt: Date
}

export function toPublicUser(user: {
    id: string
    fullName: string
    phone: string
    role: Role
    zone: Zone
    createdAt: Date
}): PublicUser {
    return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        zone: user.zone,
        createdAt: user.createdAt,
    }
}

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(
    password: string,
    passwordHash: string
): Promise<boolean> {
    return bcrypt.compare(password, passwordHash)
}

// Un cookie fuité ne doit pas permettre de rejouer une session en cas de fuite DB :
// seul le SHA-256 du token est stocké.
export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
}

// Code à 6 chiffres pour la réinitialisation de mot de passe (US-AUTH-5).
export function generateResetCode(): string {
    return String(randomInt(100000, 1000000))
}

export const PASSWORD_RESET_TTL_MINUTES = 15

// Après un reset de mot de passe, toutes les sessions existantes sont révoquées :
// un attaquant ayant volé une session ne la conserve pas après reprise de contrôle.
export async function invalidateUserSessions(userId: string): Promise<void> {
    await db.session.deleteMany({ where: { userId } })
}

export async function createSession(
    userId: string,
    remember = true
): Promise<void> {
    const token = randomBytes(48).toString("hex")
    const ttlDays = remember ? SESSION_TTL_DAYS : SESSION_SHORT_TTL_DAYS
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

    await db.session.create({
        data: { tokenHash: hashToken(token), userId, expiresAt },
    })

    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        // « Se souvenir de moi » décoché : cookie de session (expire à la fermeture
        // du navigateur) au lieu d'un cookie persistant 30 jours.
        ...(remember ? { expires: expiresAt } : {}),
    })
}

export async function getCurrentUser(): Promise<PublicUser | null> {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null

    const session = await db.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
    })

    if (!session) return null
    if (session.expiresAt < new Date()) {
        await db.session
            .delete({ where: { id: session.id } })
            .catch(() => undefined)
        return null
    }

    return toPublicUser(session.user)
}

export async function destroySession(): Promise<void> {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value

    if (token) {
        await db.session
            .delete({ where: { tokenHash: hashToken(token) } })
            .catch(() => undefined)
    }
    store.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
    })
}
