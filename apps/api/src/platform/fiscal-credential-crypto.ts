import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
  const key = encodedKey ? Buffer.from(encodedKey, 'base64') : Buffer.alloc(0);
  if (!encodedKey || key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new ServiceUnavailableException(
      'Fiscal credential storage is unavailable until FISCAL_CREDENTIAL_ENCRYPTION_KEY is configured.',
    );
  }
  return createHash('sha256').update('saas-pos:fiscal-credentials:v1:').update(key).digest();
}

export function encryptFiscalCredentials(credentials: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptFiscalCredentials(encrypted: string): Record<string, string> {
  const [encodedIv, encodedTag, encodedCiphertext] = encrypted.split('.');
  if (!encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error('Stored fiscal credentials have an invalid format.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(encodedIv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed: unknown = JSON.parse(plaintext);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every((value) => typeof value === 'string')
  ) {
    throw new Error('Stored fiscal credentials have an invalid value.');
  }
  return parsed as Record<string, string>;
}
