/**
 * Hashes a password string appended with salt using the native Web Crypto API.
 * This helper has zero external dependencies and runs in Next.js Edge Runtime, middleware, and Node.js.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a secure random 32-character hex salt string.
 */
export function generateSalt(): string {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
}
