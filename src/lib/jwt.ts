/** Decode JWT payload and return the `exp` claim (seconds since epoch), or undefined if missing/invalid. */
export function parseTokenExp(token: string): number | undefined {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return undefined;
    const payload = JSON.parse(atob(encoded)) as Record<string, unknown>;
    return typeof payload.exp === 'number' ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}
