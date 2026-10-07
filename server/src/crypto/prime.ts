// Uji primalitas Miller-Rabin dan pembangkitan bilangan prima acak.
import { modPow, randomBits, randomInRange } from './bigint.ts';

export const DEFAULT_MILLER_RABIN_ROUNDS = 32;

const SMALL_PRIME_LIMIT = 2000;

// Sieve of Eratosthenes. Bilangan prima kecil dipakai untuk membuang sebagian besar
// kandidat komposit sebelum Miller-Rabin yang jauh lebih mahal.
function sieve(limit: number): bigint[] {
  const composite = new Uint8Array(limit + 1);
  const primes: bigint[] = [];
  for (let n = 2; n <= limit; n++) {
    if (composite[n]) continue;
    primes.push(BigInt(n));
    for (let multiple = n * n; multiple <= limit; multiple += n) composite[multiple] = 1;
  }
  return primes;
}

const SMALL_PRIMES = sieve(SMALL_PRIME_LIMIT);

// Miller-Rabin: tulis n - 1 = 2^s * d dengan d ganjil. Untuk basis acak a, n lolos jika
// a^d = 1 atau a^(2^r * d) = -1 (mod n) untuk suatu r < s. Bilangan komposit lolos satu
// ronde dengan peluang paling besar 1/4.
export function isProbablePrime(n: bigint, rounds: number = DEFAULT_MILLER_RABIN_ROUNDS): boolean {
  if (n < 2n) return false;
  for (const prime of SMALL_PRIMES) {
    if (n === prime) return true;
    if (n % prime === 0n) return false;
  }

  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }

  const minusOne = n - 1n;
  witnessLoop: for (let round = 0; round < rounds; round++) {
    const base = randomInRange(2n, n - 2n);
    let x = modPow(base, d, n);
    if (x === 1n || x === minusOne) continue;

    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === minusOne) continue witnessLoop;
      if (x === 1n) return false;
    }
    return false;
  }
  return true;
}

// Bilangan prima acak dengan panjang tepat `bits` bit. Dua bit teratas dipaksa 1 supaya
// hasil kali dua prima seperti ini selalu sepanjang 2 * bits bit.
export function generatePrime(bits: number, rounds: number = DEFAULT_MILLER_RABIN_ROUNDS): bigint {
  if (bits < 16) throw new RangeError('prime size must be at least 16 bits');
  const topBits = (1n << BigInt(bits - 1)) | (1n << BigInt(bits - 2));
  while (true) {
    const candidate = randomBits(bits) | topBits | 1n;
    if (isProbablePrime(candidate, rounds)) return candidate;
  }
}
