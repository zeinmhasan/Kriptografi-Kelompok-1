// JSON Web Token dengan HMAC-SHA256 / HS256 (RFC 7519, RFC 7515).
import { base64urlDecode, base64urlEncode, bytesToUtf8, constantTimeEqual, utf8ToBytes } from './bytes.ts';
import { hmacSha256 } from './hmac.ts';

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  [claim: string]: unknown;
}

const HEADER = base64urlEncode(utf8ToBytes(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function signJwt(
  claims: { sub: string; [claim: string]: unknown },
  secret: Uint8Array,
  expiresInSeconds: number,
  now: number = nowInSeconds(),
): string {
  const payload: JwtPayload = { ...claims, iat: now, exp: now + expiresInSeconds };
  const signingInput = `${HEADER}.${base64urlEncode(utf8ToBytes(JSON.stringify(payload)))}`;
  const signature = hmacSha256(secret, utf8ToBytes(signingInput));
  return `${signingInput}.${base64urlEncode(signature)}`;
}

export function verifyJwt(token: string, secret: Uint8Array, now: number = nowInSeconds()): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('malformed token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg?: unknown; typ?: unknown };
  let payload: JwtPayload;
  let signature: Uint8Array;
  try {
    header = JSON.parse(bytesToUtf8(base64urlDecode(encodedHeader)));
    payload = JSON.parse(bytesToUtf8(base64urlDecode(encodedPayload)));
    signature = base64urlDecode(encodedSignature);
  } catch {
    throw new JwtError('malformed token');
  }

  // Algoritma dikunci ke HS256. Token dengan alg lain, termasuk "none", ditolak.
  if (header === null || typeof header !== 'object' || header.alg !== 'HS256') {
    throw new JwtError('unsupported algorithm');
  }

  const expected = hmacSha256(secret, utf8ToBytes(`${encodedHeader}.${encodedPayload}`));
  if (!constantTimeEqual(signature, expected)) throw new JwtError('invalid signature');

  if (payload === null || typeof payload !== 'object') throw new JwtError('malformed token');
  if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') throw new JwtError('malformed token');
  if (now >= payload.exp) throw new JwtError('token expired');
  return payload;
}
