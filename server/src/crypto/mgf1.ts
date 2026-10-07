// MGF1 dengan SHA-256 (RFC 8017 lampiran B.2.1): memperpanjang seed menjadi mask
// sepanjang yang diminta dengan meng-hash seed || counter berulang kali.
import { concatBytes, uint32ToBytes } from './bytes.ts';
import { SHA256_DIGEST_LENGTH, sha256 } from './sha256.ts';

export function mgf1Sha256(seed: Uint8Array, length: number): Uint8Array {
  const mask = new Uint8Array(length);
  let offset = 0;
  for (let counter = 0; offset < length; counter++) {
    const block = sha256(concatBytes(seed, uint32ToBytes(counter)));
    const take = Math.min(SHA256_DIGEST_LENGTH, length - offset);
    mask.set(block.subarray(0, take), offset);
    offset += take;
  }
  return mask;
}
