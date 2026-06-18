const secret = process.env.JWT_SECRET || 'squirryfy-session-secret-encryption-fallback-key-at-least-32-chars';

async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Signs a payload with HMAC SHA-256 and generates a signed session token.
 */
export async function signToken(payload: Record<string, any>): Promise<string> {
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  
  // Set default expiration to 7 days
  const expiration = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payloadStr = JSON.stringify({ ...payload, exp: expiration });
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Base64 encode the payload to make it URL safe
  const payloadBase64 = btoa(payloadStr);
  return `${payloadBase64}.${signatureHex}`;
}

/**
 * Verifies a session token's signature and expiration.
 */
export async function verifyToken(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const [payloadBase64, signatureHex] = parts;
    const payloadStr = atob(payloadBase64);
    const key = await getCryptoKey();
    const encoder = new TextEncoder();
    
    // Convert signature from Hex string to Uint8Array
    const signatureBuffer = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(payloadStr));
    if (!isValid) return null;
    
    const payload = JSON.parse(payloadStr);
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Token has expired
    }
    
    return payload;
  } catch {
    return null;
  }
}
