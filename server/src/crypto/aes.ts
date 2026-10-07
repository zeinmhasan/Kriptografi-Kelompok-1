// AES (FIPS 197) untuk kunci 128, 192, dan 256 bit.
//
// State 16 byte disimpan per kolom: state[baris + 4 * kolom]. Dengan susunan ini
// byte masukan dipetakan langsung ke state tanpa penyusunan ulang.

export const AES_BLOCK_LENGTH = 16;

const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);

// Tabel perkalian di GF(2^8) untuk koefisien MixColumns dan InvMixColumns.
const MUL2 = new Uint8Array(256);
const MUL3 = new Uint8Array(256);
const MUL9 = new Uint8Array(256);
const MUL11 = new Uint8Array(256);
const MUL13 = new Uint8Array(256);
const MUL14 = new Uint8Array(256);

// Konstanta ronde untuk key expansion: RCON[i] = x^(i-1) di GF(2^8).
const RCON = new Uint8Array(11);

// Perkalian di GF(2^8) dengan polinomial pereduksi x^8 + x^4 + x^3 + x + 1 (0x11b).
function gfMultiply(a: number, b: number): number {
  let product = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) product ^= a;
    const overflow = a & 0x80;
    a = (a << 1) & 0xff;
    if (overflow) a ^= 0x1b;
    b >>= 1;
  }
  return product;
}

function rotateLeft8(value: number, shift: number): number {
  return ((value << shift) | (value >>> (8 - shift))) & 0xff;
}

// S-box dibangun dari definisinya, bukan disalin sebagai tabel:
// invers perkalian di GF(2^8) diikuti transformasi affine.
function buildTables(): void {
  const inverse = new Uint8Array(256);
  for (let a = 1; a < 256; a++) {
    for (let b = 1; b < 256; b++) {
      if (gfMultiply(a, b) === 1) {
        inverse[a] = b;
        break;
      }
    }
  }

  for (let x = 0; x < 256; x++) {
    const inv = inverse[x];
    const substituted =
      inv ^ rotateLeft8(inv, 1) ^ rotateLeft8(inv, 2) ^ rotateLeft8(inv, 3) ^ rotateLeft8(inv, 4) ^ 0x63;
    SBOX[x] = substituted;
    INV_SBOX[substituted] = x;

    MUL2[x] = gfMultiply(x, 2);
    MUL3[x] = gfMultiply(x, 3);
    MUL9[x] = gfMultiply(x, 9);
    MUL11[x] = gfMultiply(x, 11);
    MUL13[x] = gfMultiply(x, 13);
    MUL14[x] = gfMultiply(x, 14);
  }

  RCON[1] = 1;
  for (let i = 2; i < RCON.length; i++) RCON[i] = gfMultiply(RCON[i - 1], 2);
}

buildTables();

export class Aes {
  readonly rounds: number;
  private readonly roundKeys: Uint8Array;
  private readonly state = new Uint8Array(AES_BLOCK_LENGTH);

  constructor(key: Uint8Array) {
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new RangeError('AES key must be 16, 24, or 32 bytes');
    }
    this.rounds = key.length / 4 + 6;
    this.roundKeys = expandKey(key, this.rounds);
  }

  encryptBlock(input: Uint8Array, inputOffset: number, output: Uint8Array, outputOffset: number): void {
    const state = this.state;
    for (let i = 0; i < AES_BLOCK_LENGTH; i++) state[i] = input[inputOffset + i];

    this.addRoundKey(0);
    for (let round = 1; round < this.rounds; round++) {
      subBytes(state);
      shiftRows(state);
      mixColumns(state);
      this.addRoundKey(round);
    }
    subBytes(state);
    shiftRows(state);
    this.addRoundKey(this.rounds);

    for (let i = 0; i < AES_BLOCK_LENGTH; i++) output[outputOffset + i] = state[i];
  }

  decryptBlock(input: Uint8Array, inputOffset: number, output: Uint8Array, outputOffset: number): void {
    const state = this.state;
    for (let i = 0; i < AES_BLOCK_LENGTH; i++) state[i] = input[inputOffset + i];

    this.addRoundKey(this.rounds);
    for (let round = this.rounds - 1; round >= 1; round--) {
      invShiftRows(state);
      invSubBytes(state);
      this.addRoundKey(round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    this.addRoundKey(0);

    for (let i = 0; i < AES_BLOCK_LENGTH; i++) output[outputOffset + i] = state[i];
  }

  private addRoundKey(round: number): void {
    const state = this.state;
    const roundKeys = this.roundKeys;
    const base = round * AES_BLOCK_LENGTH;
    for (let i = 0; i < AES_BLOCK_LENGTH; i++) state[i] ^= roundKeys[base + i];
  }
}

// Key expansion: menghasilkan 4 * (rounds + 1) word, masing-masing 4 byte.
function expandKey(key: Uint8Array, rounds: number): Uint8Array {
  const keyWords = key.length / 4;
  const totalWords = 4 * (rounds + 1);
  const words = new Uint8Array(totalWords * 4);
  words.set(key);

  const temp = new Uint8Array(4);
  for (let i = keyWords; i < totalWords; i++) {
    for (let j = 0; j < 4; j++) temp[j] = words[4 * (i - 1) + j];

    if (i % keyWords === 0) {
      // RotWord, SubWord, lalu XOR dengan konstanta ronde.
      const first = temp[0];
      temp[0] = SBOX[temp[1]] ^ RCON[i / keyWords];
      temp[1] = SBOX[temp[2]];
      temp[2] = SBOX[temp[3]];
      temp[3] = SBOX[first];
    } else if (keyWords > 6 && i % keyWords === 4) {
      // Langkah SubWord tambahan yang hanya ada pada AES-256.
      for (let j = 0; j < 4; j++) temp[j] = SBOX[temp[j]];
    }

    for (let j = 0; j < 4; j++) words[4 * i + j] = words[4 * (i - keyWords) + j] ^ temp[j];
  }
  return words;
}

function subBytes(state: Uint8Array): void {
  for (let i = 0; i < AES_BLOCK_LENGTH; i++) state[i] = SBOX[state[i]];
}

function invSubBytes(state: Uint8Array): void {
  for (let i = 0; i < AES_BLOCK_LENGTH; i++) state[i] = INV_SBOX[state[i]];
}

// Baris r digeser ke kiri sejauh r posisi.
function shiftRows(state: Uint8Array): void {
  let temp = state[1];
  state[1] = state[5];
  state[5] = state[9];
  state[9] = state[13];
  state[13] = temp;

  temp = state[2];
  state[2] = state[10];
  state[10] = temp;
  temp = state[6];
  state[6] = state[14];
  state[14] = temp;

  temp = state[15];
  state[15] = state[11];
  state[11] = state[7];
  state[7] = state[3];
  state[3] = temp;
}

// Baris r digeser ke kanan sejauh r posisi.
function invShiftRows(state: Uint8Array): void {
  let temp = state[13];
  state[13] = state[9];
  state[9] = state[5];
  state[5] = state[1];
  state[1] = temp;

  temp = state[2];
  state[2] = state[10];
  state[10] = temp;
  temp = state[6];
  state[6] = state[14];
  state[14] = temp;

  temp = state[3];
  state[3] = state[7];
  state[7] = state[11];
  state[11] = state[15];
  state[15] = temp;
}

// Tiap kolom dikalikan dengan matriks tetap [2 3 1 1; 1 2 3 1; 1 1 2 3; 3 1 1 2].
function mixColumns(state: Uint8Array): void {
  for (let column = 0; column < 16; column += 4) {
    const a0 = state[column];
    const a1 = state[column + 1];
    const a2 = state[column + 2];
    const a3 = state[column + 3];
    state[column] = MUL2[a0] ^ MUL3[a1] ^ a2 ^ a3;
    state[column + 1] = a0 ^ MUL2[a1] ^ MUL3[a2] ^ a3;
    state[column + 2] = a0 ^ a1 ^ MUL2[a2] ^ MUL3[a3];
    state[column + 3] = MUL3[a0] ^ a1 ^ a2 ^ MUL2[a3];
  }
}

// Matriks invers: [14 11 13 9; 9 14 11 13; 13 9 14 11; 11 13 9 14].
function invMixColumns(state: Uint8Array): void {
  for (let column = 0; column < 16; column += 4) {
    const a0 = state[column];
    const a1 = state[column + 1];
    const a2 = state[column + 2];
    const a3 = state[column + 3];
    state[column] = MUL14[a0] ^ MUL11[a1] ^ MUL13[a2] ^ MUL9[a3];
    state[column + 1] = MUL9[a0] ^ MUL14[a1] ^ MUL11[a2] ^ MUL13[a3];
    state[column + 2] = MUL13[a0] ^ MUL9[a1] ^ MUL14[a2] ^ MUL11[a3];
    state[column + 3] = MUL11[a0] ^ MUL13[a1] ^ MUL9[a2] ^ MUL14[a3];
  }
}

export function getSbox(): Uint8Array {
  return SBOX.slice();
}
