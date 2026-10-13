/** Session du bureau dans ce navigateur : jeton et rôle (sessionStorage), après POST /api/bureau-auth. */

const TOKEN_KEY = 'asso-bureau-token';
const ROLE_KEY = 'asso-bureau-role';

export type BureauRole = 'admin' | 'seance';

export function getBureauToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getBureauRole(): BureauRole | null {
  try {
    const role = sessionStorage.getItem(ROLE_KEY);
    return role === 'admin' || role === 'seance' ? role : null;
  } catch {
    return null;
  }
}

export function setBureauRole(role: BureauRole): void {
  sessionStorage.setItem(ROLE_KEY, role);
}

export function clearBureauToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function setBureauToken(token: string): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  sessionStorage.setItem(TOKEN_KEY, token);
}
