// Service d'authentification — FEATURE-AUTH (ADR-004)
// Côté serveur uniquement (bcrypt, sessions, cookies) — jamais importé côté client.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Role, Zone } from "@prisma/client";

export const SESSION_COOKIE = "mondocpro_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 10;

// Profil exposé au client — JAMAIS de passwordHash ni de session interne.
export type PublicUser = {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  zone: Zone;
  createdAt: Date;
};

export function toPublicUser(user: {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  zone: Zone;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    zone: user.zone,
    createdAt: user.createdAt,
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// Un cookie fuité ne doit pas permettre de rejouer une session en cas de fuite DB :
// seul le SHA-256 du token est stocké.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return toPublicUser(session.user);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .delete({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
