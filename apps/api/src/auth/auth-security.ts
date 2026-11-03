import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_ISSUER = 'SaaS POS';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getMfaEncryptionKey(): Buffer {
  const secret = process.env.MFA_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === 'production' ? undefined : process.env.JWT_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured with at least 32 characters.');
  }
  return createHash('sha256').update('saas-pos:mfa-secret:v1:').update(secret).digest();
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getMfaEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptMfaSecret(encrypted: string): string {
  const [encodedIv, encodedTag, encodedCiphertext] = encrypted.split('.');
  if (!encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error('Stored MFA secret has an invalid format.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getMfaEncryptionKey(),
    Buffer.from(encodedIv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of secret.replace(/=+$/g, '').toUpperCase()) {
    const digit = BASE32_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('MFA secret is invalid.');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function createTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function getTotpProvisioningUri(secret: string, accountName: string): string {
  const label = encodeURIComponent(`${MFA_ISSUER}:${accountName}`);
  const query = new URLSearchParams({
    secret,
    issuer: MFA_ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function totpAtCounter(secret: string, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(totpAtCounter(secret, counter + drift));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }
  return false;
}

export function generateMfaRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(9).toString('hex').toUpperCase(),
  );
}
