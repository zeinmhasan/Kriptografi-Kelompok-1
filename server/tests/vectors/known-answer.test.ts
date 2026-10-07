import { describe, expect, it } from 'vitest';
import { runSelfTests } from '../../src/crypto/selftest.ts';

// Menjalankan semua vektor uji resmi yang juga dipakai panel Self-Test di Crypto Lab.
describe('known-answer tests', () => {
  const results = runSelfTests();

  it('covers every algorithm', () => {
    const algorithms = new Set(results.map((result) => result.algorithm));
    expect([...algorithms].sort()).toEqual(
      [
        'AES',
        'AES-256-GCM',
        'HMAC-SHA256',
        'JWT HS256',
        'MGF1-SHA256',
        'PBKDF2-HMAC-SHA256',
        'RSA',
        'RSA-OAEP',
        'RSA-PSS',
        'SHA-256',
      ].sort(),
    );
  });

  for (const result of results) {
    it(`${result.algorithm}: ${result.name}`, () => {
      expect(result.error).toBeUndefined();
      expect(result.passed).toBe(true);
    });
  }
});
