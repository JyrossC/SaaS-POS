import { ServiceUnavailableException } from '@nestjs/common';
import {
  decryptFiscalCredentials,
  encryptFiscalCredentials,
} from './fiscal-credential-crypto';

describe('fiscal credential encryption', () => {
  const previousKey = process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = previousKey;
    }
  });

  it('encrypts credentials and decrypts them only with the configured key', () => {
    process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString('base64');
    const credentials = { account: 'merchant-1', token: 'sensitive-value' };
    const encrypted = encryptFiscalCredentials(credentials);

    expect(encrypted).not.toContain(credentials.token);
    expect(decryptFiscalCredentials(encrypted)).toEqual(credentials);
  });

  it('refuses to store credentials when the dedicated key is missing', () => {
    delete process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;

    expect(() => encryptFiscalCredentials({ token: 'sensitive-value' }))
      .toThrow(ServiceUnavailableException);
  });

  it('rejects tampered encrypted credentials', () => {
    process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString('base64');
    const encrypted = encryptFiscalCredentials({ token: 'sensitive-value' });
    const [iv, tag, ciphertext] = encrypted.split('.');
    const replacement = `${iv}.${tag}.${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptFiscalCredentials(replacement)).toThrow();
  });
});
