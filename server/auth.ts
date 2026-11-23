import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export const CUSTOMER_COOKIE_NAME = 'hm_customer_session';
export const ADMIN_COOKIE_NAME = 'hm_admin_session';

export interface SessionPayload {
  sub: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function timingSafeStringMatch(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Compare against dummy buffer of same length to avoid length leak timing differences
    crypto.timingSafeEqual(aBuf, Buffer.alloc(aBuf.length));
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (parsed.role !== 'customer' && parsed.role !== 'admin') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

export function setSessionCookie(req: Request, res: Response, name: string, token: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (typeof req.headers.origin === 'string' && req.headers.origin.startsWith('https://'));

  const maxAge = 60 * 60 * 24 * 7;
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response, name: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (typeof req.headers.origin === 'string' && req.headers.origin.startsWith('https://'));

  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export function verifyCsrfForCookieMutation(req: Request): boolean {
  // Bearer-authenticated calls do not rely on ambient cookies.
  if (extractBearerToken(req)) return true;

  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }

  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (typeof origin === 'string' && typeof host === 'string') {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function getAuthenticatedSession(req: Request, role: 'customer' | 'admin'): SessionPayload | null {
  const bearer = extractBearerToken(req);
  if (bearer) {
    const payload = verifySessionToken(bearer);
    if (payload && payload.role === role) return payload;
  }
  const cookies = parseCookies(req);
  const cookieName = role === 'admin' ? ADMIN_COOKIE_NAME : CUSTOMER_COOKIE_NAME;
  const payload = verifySessionToken(cookies[cookieName]);
  if (payload && payload.role === role) return payload;
  return null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !verifyCsrfForCookieMutation(req)) {
    res.status(403).json({ error: 'Forbidden: missing CSRF verification header.' });
    return;
  }
  const session = getAuthenticatedSession(req, 'admin');
  if (!session) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  (req as Request & { adminSession?: SessionPayload }).adminSession = session;
  next();
}
