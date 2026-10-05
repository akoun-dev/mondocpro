// Service d'authentification — FEATURE-AUTH (ADR-004)
// Côté serveur uniquement (bcrypt, sessions, cookies) — jamais importé côté client.
import { createHash, randomBytes, randomInt } from "node:crypto"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import type { Role, ThemeMode, Zone } from "@prisma/client"

// RFC 6265 §4.1.1 : cookie-name est une suite de tokens — ni espace, ni
// accent, ni « # », ni « / ». Le nom historique « Mon doc Pro_session » était
// donc rejeté en bloc par les navigateurs : le serveur posait bien le cookie
// (login 200) mais le client ne le stockait jamais, d'où les 401 sur /me.
// Nom ASCII sans espace ni caractère spécial.
export const SESSION_COOKIE = "mondocpro_session"
const SESSION_TTL_DAYS = 30
// Session courte (« Se souvenir de moi » décoché) : le cookie expire à la
// fermeture du navigateur et le token serveur au bout de 24 h.
const SESSION_SHORT_TTL_DAYS = 1
const BCRYPT_ROUNDS = 10

// Profil exposé au client — JAMAIS de passwordHash ni de session interne.
// FEATURE-PROFIL (Task 22) : birthDate + préférences de notification éditables
// via PATCH /api/auth/profile (birthDate = Date minuit UTC, sérialisée ISO).
// FEATURE-DARK-MODE (Task 37) : theme = préférence par utilisateur (SYSTEM,
// LIGHT ou DARK) appliquée par ThemeInit et persistée en base.
export type PublicUser = {
    id: string
    fullName: string
    phone: string
    role: Role
    zone: Zone
    birthDate: Date | null
    appointmentReminders: boolean
    healthAlerts: boolean
    theme: ThemeMode
    createdAt: Date
}

export function toPublicUser(user: {
    id: string
    fullName: string
    phone: string
    role: Role
    zone: Zone
    birthDate: Date | null
    appointmentReminders: boolean
    healthAlerts: boolean
    theme: ThemeMode
    createdAt: Date
}): PublicUser {
    return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        zone: user.zone,
        birthDate: user.birthDate,
        appointmentReminders: user.appointmentReminders,
        healthAlerts: user.healthAlerts,
        theme: user.theme,
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

// Options du cookie de session selon le contexte de service :
// - localhost (http://localhost:3000, E2E curl/playwright) : SameSite=Lax,
//   comportement historique — inchangé.
// - proxy de prévisualisation / production (HTTPS, potentiellement affiché en
//   iframe cross-site) : SameSite=None + Secure + Partitioned (CHIPS). Un cookie
//   Lax n'est JAMAIS renvoyé par un navigateur depuis un iframe tiers, ce qui
//   produisait des 401 systématiques après connexion dans l'aperçu intégré.
//   Partitioned restaure en prime une cloison anti-CSRF (les requêtes cross-site
//   ne voient pas la partition du site hôte).
async function sessionCookieOptions(): Promise<{
    sameSite: "lax" | "none"
    secure: boolean
    partitioned?: boolean
}> {
    const host = (await headers()).get("host") ?? ""
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    return isLocal
        ? { sameSite: "lax", secure: false }
        : { sameSite: "none", secure: true, partitioned: true }
}

// Après un reset de mot de passe, toutes les sessions existantes sont révoquées :
// un attaquant ayant volé une session ne la conserve pas après reprise de contrôle.
// ADR-010 : les clés de sondage du Background Runner sont purgées avec — ce
// sont des credentials de lecture des notifications au même titre qu'une
// session (l'appareil se reprovisionnera à la prochaine connexion).
export async function invalidateUserSessions(userId: string): Promise<void> {
    await db.session.deleteMany({ where: { userId } })
    await db.deviceToken.deleteMany({ where: { userId } })
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
        path: "/",
        ...(await sessionCookieOptions()),
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
        path: "/",
        // Mêmes attributs que la pose : le navigateur n'écrase le cookie que si
        // nom + domaine + chemin + partition correspondent.
        ...(await sessionCookieOptions()),
        maxAge: 0,
    })
}

// Garde API factorisée (audit patients 2026-10-03 §3) : un seul endroit gère
// l'authentification et l'autorisation par rôle des routes métier.
// 401 si session absente/expirée · 403 si rôle hors liste autorisée.
export type RequireRoleResult =
    | { ok: true; user: PublicUser }
    | { ok: false; response: NextResponse }

export async function requireRole(
    allowed: Role[]
): Promise<RequireRoleResult> {
    const user = await getCurrentUser()

    if (!user) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Authentification requise" },
                { status: 401 }
            ),
        }
    }

    if (!allowed.includes(user.role)) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Accès non autorisé pour ce rôle" },
                { status: 403 }
            ),
        }
    }

    return { ok: true, user }
}
