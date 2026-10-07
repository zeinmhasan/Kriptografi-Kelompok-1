// SHA-256 (FIPS 180-4).

export const SHA256_DIGEST_LENGTH = 32;
export const SHA256_BLOCK_LENGTH = 64;

// 32 bit pertama bagian pecahan akar pangkat tiga dari 64 bilangan prima pertama.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// 32 bit pertama bagian pecahan akar kuadrat dari 8 bilangan prima pertama.
const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

// Message schedule, dipakai ulang antar pemanggilan karena compress() sinkron.
const W = new Uint32Array(64);

function compress(state: Uint32Array, block: Uint8Array, offset: number): void {
  for (let i = 0; i < 16; i++) {
    const j = offset + 4 * i;
    W[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15];
    const w2 = W[i - 2];
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }

  let a = state[0] | 0;
  let b = state[1] | 0;
  let c = state[2] | 0;
  let d = state[3] | 0;
  let e = state[4] | 0;
  let f = state[5] | 0;
  let g = state[6] | 0;
  let h = state[7] | 0;

  for (let i = 0; i < 64; i++) {
    const sigma1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const choice = (e & f) ^ (~e & g);
    const temp1 = (h + sigma1 + choice + K[i] + W[i]) | 0;
    const sigma0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (sigma0 + majority) | 0;

    h = g;
    g = f;
    f = e;
    e = (d + temp1) | 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) | 0;
  }

  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

export class Sha256 {
  private readonly state = new Uint32Array(INITIAL_STATE);
  private readonly buffer = new Uint8Array(SHA256_BLOCK_LENGTH);
  private bufferLength = 0;
  private totalLength = 0;

  update(data: Uint8Array): this {
    this.totalLength += data.length;
    let offset = 0;

    if (this.bufferLength > 0) {
      const take = Math.min(SHA256_BLOCK_LENGTH - this.bufferLength, data.length);
      this.buffer.set(data.subarray(0, take), this.bufferLength);
      this.bufferLength += take;
      offset = take;
      if (this.bufferLength < SHA256_BLOCK_LENGTH) return this;
      compress(this.state, this.buffer, 0);
      this.bufferLength = 0;
    }

    while (offset + SHA256_BLOCK_LENGTH <= data.length) {
      compress(this.state, data, offset);
      offset += SHA256_BLOCK_LENGTH;
    }

    if (offset < data.length) {
      this.buffer.set(data.subarray(offset));
      this.bufferLength = data.length - offset;
    }
    return this;
  }

  // Menambahkan padding lalu mengembalikan digest. Objek tidak boleh dipakai lagi setelahnya.
  digest(): Uint8Array {
    const buffer = this.buffer;
    let length = this.bufferLength;

    buffer[length++] = 0x80;
    if (length > 56) {
      buffer.fill(0, length);
      compress(this.state, buffer, 0);
      length = 0;
    }
    buffer.fill(0, length, 56);

    // Panjang pesan dalam bit sebagai integer 64-bit big-endian.
    const bitsHigh = Math.floor(this.totalLength / 0x20000000);
    const bitsLow = (this.totalLength << 3) >>> 0;
    writeUint32(buffer, 56, bitsHigh);
    writeUint32(buffer, 60, bitsLow);
    compress(this.state, buffer, 0);

    const out = new Uint8Array(SHA256_DIGEST_LENGTH);
    for (let i = 0; i < 8; i++) writeUint32(out, 4 * i, this.state[i]);
    return out;
  }

  clone(): Sha256 {
    const copy = new Sha256();
    copy.state.set(this.state);
    copy.buffer.set(this.buffer);
    copy.bufferLength = this.bufferLength;
    copy.totalLength = this.totalLength;
    return copy;
  }
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value >>> 24;
  target[offset + 1] = value >>> 16;
  target[offset + 2] = value >>> 8;
  target[offset + 3] = value;
}

export function sha256(data: Uint8Array): Uint8Array {
  return new Sha256().update(data).digest();
}
