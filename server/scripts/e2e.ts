// Uji end-to-end: npm run e2e
// Menjalankan server sungguhan terhadap database dan folder storage sementara,
// lalu menguji seluruh alur lewat HTTP. Membutuhkan MongoDB lokal yang berjalan.
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const storageDir = await mkdtemp(path.join(os.tmpdir(), 'crypta-e2e-'));
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/crypta_e2e_${Date.now()}`;
process.env.STORAGE_DIR = storageDir;
process.env.JWT_SECRET = 'e2e-secret';
process.env.MAX_FILE_SIZE_MB = '1';
// Iterasi diperkecil hanya supaya uji cepat; alurnya sama persis.
process.env.PBKDF2_ITERATIONS = '20000';

const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.ts');
const { config } = await import('../src/config.ts');
const { base64urlDecode, bytesToHex, bytesToUtf8 } = await import('../src/crypto/bytes.ts');
const { randomBytes } = await import('../src/crypto/random.ts');
const { sha256 } = await import('../src/crypto/sha256.ts');

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

class Client {
  private cookie = '';
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(method: string, url: string, body?: unknown, rawCookie?: string): Promise<Response> {
    const headers: Record<string, string> = {};
    const cookie = rawCookie ?? this.cookie;
    if (cookie) headers.cookie = cookie;
    let payload: string | FormData | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(this.baseUrl + url, { method, headers, body: payload });
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length > 0) this.cookie = setCookie[0].split(';')[0];
    return response;
  }

  async json(method: string, url: string, body?: unknown): Promise<{ status: number; data: any }> {
    const response = await this.request(method, url, body);
    return { status: response.status, data: await response.json() };
  }

  get sessionCookie(): string {
    return this.cookie;
  }
}

function uploadForm(data: Uint8Array, name: string, type = 'application/pdf'): FormData {
  const form = new FormData();
  form.append('file', new Blob([data], { type }), name);
  return form;
}

const same = (a: Uint8Array, b: Uint8Array) => bytesToHex(a) === bytesToHex(b);
const bodyBytes = async (response: Response) => new Uint8Array(await response.arrayBuffer());

async function run(baseUrl: string): Promise<void> {
  const alice = new Client(baseUrl);
  const bob = new Client(baseUrl);
  const guest = new Client(baseUrl);
  const alicePassword = 'password-alice-1';
  const bobPassword = 'password-bob-123';

  console.log('\nAutentikasi');
  check('permintaan tanpa login ditolak (401)', (await guest.json('GET', '/api/files')).status === 401);
  check(
    'password pendek ditolak (400)',
    (await guest.json('POST', '/api/auth/register', { username: 'x_user', email: 'x@e.id', password: 'short' })).status === 400,
  );

  const registered = await alice.json('POST', '/api/auth/register', {
    username: 'Alice',
    email: 'alice@example.com',
    password: alicePassword,
  });
  check('registrasi alice (201)', registered.status === 201, registered.data);
  check('username disimpan huruf kecil', registered.data.user?.username === 'alice');
  check(
    'dua key pair berbeda dibangkitkan',
    /^[0-9a-f]{64}$/.test(registered.data.user?.encKeyFingerprint) &&
      registered.data.user.encKeyFingerprint !== registered.data.user.sigKeyFingerprint,
  );
  check('jejak registrasi berisi langkah', registered.data.trace?.steps?.length >= 5);
  check('respons registrasi tidak membocorkan kunci privat', !JSON.stringify(registered.data).includes('"d":'));

  const bobRegistered = await bob.json('POST', '/api/auth/register', {
    username: 'bob',
    email: 'bob@example.com',
    password: bobPassword,
  });
  check('registrasi bob (201)', bobRegistered.status === 201, bobRegistered.data);
  check(
    'username ganda ditolak (409)',
    (await guest.json('POST', '/api/auth/register', { username: 'alice', email: 'z@e.id', password: 'whatever-123' })).status === 409,
  );
  check('sesi aktif setelah registrasi', (await alice.json('GET', '/api/auth/me')).data.user?.username === 'alice');
  check('cookie sesi bertanda HttpOnly', true === (await (async () => {
    const response = await guest.request('POST', '/api/auth/login', { identifier: 'alice', password: alicePassword });
    return response.headers.getSetCookie().some((value) => /HttpOnly/i.test(value) && /SameSite=Strict/i.test(value));
  })()));
  check(
    'login dengan password salah ditolak (401)',
    (await new Client(baseUrl).json('POST', '/api/auth/login', { identifier: 'alice', password: 'wrong-password' })).status === 401,
  );
  check(
    'login dengan email diterima',
    (await new Client(baseUrl).json('POST', '/api/auth/login', { identifier: 'alice@example.com', password: alicePassword })).status === 200,
  );

  const [header, payload, signature] = alice.sessionCookie.split('=')[1].split('.');
  const forged = bytesToUtf8(base64urlDecode(payload)).replace('"username":"alice"', '"username":"admin"');
  const forgedPayload = Buffer.from(forged).toString('base64url');
  check(
    'token dengan payload diubah ditolak (401)',
    (await guest.request('GET', '/api/auth/me', undefined, `crypta_token=${header}.${forgedPayload}.${signature}`)).status === 401,
  );

  console.log('\nUpload dan enkripsi');
  const original = randomBytes(300_000);
  const fileName = 'laporan résumé ñ 日本.pdf';
  const uploaded = await alice.json('POST', '/api/files', uploadForm(original, fileName));
  check('upload (201)', uploaded.status === 201, uploaded.data);
  const file = uploaded.data.file;
  check('nama file non-ASCII utuh', file?.originalName === fileName, file?.originalName);
  check('hash plaintext tercatat benar', file?.plaintextHash === bytesToHex(sha256(original)));
  check('jejak upload berisi 4 langkah kripto', uploaded.data.trace?.steps?.length === 4);
  check('jejak upload tidak memuat kunci AES', !JSON.stringify(uploaded.data.trace).match(/kunciAes":"[0-9a-f]{64}/));

  const storedFiles = await readdir(storageDir);
  check('tepat satu file .enc di storage', storedFiles.length === 1 && storedFiles[0].endsWith('.enc'));
  const storedPath = path.join(storageDir, storedFiles[0]);
  const onDisk = new Uint8Array(await readFile(storedPath));
  check('ukuran ciphertext sama dengan plaintext', onDisk.length === original.length);
  check('isi di storage bukan plaintext', !same(onDisk, original));
  check('nama asli tidak muncul di nama file storage', !storedFiles[0].includes('laporan'));

  const empty = await alice.json('POST', '/api/files', uploadForm(new Uint8Array(0), 'kosong.txt', 'text/plain'));
  check('upload file kosong (201)', empty.status === 201, empty.data);
  check(
    'file di atas batas ukuran ditolak (413)',
    (await alice.json('POST', '/api/files', uploadForm(randomBytes(1_200_000), 'besar.bin'))).status === 413,
  );

  const listing = await alice.json('GET', '/api/files');
  check('daftar file alice berisi 2 file', listing.data.owned?.length === 2 && listing.data.shared?.length === 0);

  console.log('\nDekripsi');
  const wrongPassword = await alice.json('POST', `/api/files/${file.id}/decrypt`, { password: 'bukan-password' });
  check('dekripsi dengan password salah ditolak (403 WRONG_PASSWORD)', wrongPassword.status === 403 && wrongPassword.data.error?.code === 'WRONG_PASSWORD');
  check('sesi tetap aktif setelah password salah', (await alice.json('GET', '/api/auth/me')).status === 200);

  const decrypted = await alice.request('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword });
  check('dekripsi (200)', decrypted.status === 200);
  const traceHeader = decrypted.headers.get('x-crypta-trace');
  check('hasil dekripsi identik byte demi byte', same(await bodyBytes(decrypted), original));
  const decryptTrace = traceHeader ? JSON.parse(bytesToUtf8(base64urlDecode(traceHeader))) : null;
  check('jejak dekripsi dikirim di header', decryptTrace?.steps?.length === 5, decryptTrace?.steps?.length);

  const emptyDecrypted = await alice.request('POST', `/api/files/${empty.data.file.id}/decrypt`, { password: alicePassword });
  check('file kosong terdekripsi menjadi 0 byte', emptyDecrypted.status === 200 && (await bodyBytes(emptyDecrypted)).length === 0);

  const raw = await alice.request('GET', `/api/files/${file.id}/raw`);
  check('download encrypted mengembalikan ciphertext di storage', same(await bodyBytes(raw), onDisk));

  check('bob tidak bisa melihat file alice (404)', (await bob.json('GET', `/api/files/${file.id}`)).status === 404);
  check('bob tidak bisa mendekripsi file alice (404)', (await bob.json('POST', `/api/files/${file.id}/decrypt`, { password: bobPassword })).status === 404);
  check('id file tidak valid dijawab 404', (await alice.json('GET', '/api/files/bukan-id')).status === 404);

  console.log('\nDigital signature');
  check('verifikasi sebelum ditandatangani ditolak (400)', (await alice.json('POST', `/api/files/${file.id}/verify`, { password: alicePassword })).status === 400);
  const signed = await alice.json('POST', `/api/files/${file.id}/sign`, { password: alicePassword });
  check('tanda tangan (200)', signed.status === 200, signed.data);
  check('metadata signature tercatat', signed.data.file?.signature?.signer === 'alice');
  check(
    'signature memakai signing key, bukan encryption key',
    signed.data.file?.signature?.keyFingerprint === registered.data.user.sigKeyFingerprint,
  );

  const verified = await alice.json('POST', `/api/files/${file.id}/verify`, { password: alicePassword });
  check('verifikasi file tersimpan: valid', verified.data.result?.valid === true, verified.data);

  const sigResponse = await alice.request('GET', `/api/files/${file.id}/signature`);
  const sigBytes = await bodyBytes(sigResponse);
  const sig = JSON.parse(bytesToUtf8(sigBytes));
  check('ekspor .sig berisi metadata lengkap', sig.signer === 'alice' && sig.algorithm === 'RSA-PSS-SHA256' && sig.fileName === fileName);

  const verifyExternal = async (client: Client, data: Uint8Array, signatureFile: Uint8Array) => {
    const form = new FormData();
    form.append('file', new Blob([data]), 'salinan.pdf');
    form.append('signature', new Blob([signatureFile]), 'salinan.pdf.sig');
    return client.json('POST', '/api/verify', form);
  };

  const external = await verifyExternal(bob, original, sigBytes);
  check('verifikasi eksternal oleh bob tanpa password: valid', external.data.result?.valid === true, external.data);

  const modified = original.slice();
  modified[150_000] ^= 0x01;
  const externalModified = await verifyExternal(bob, modified, sigBytes);
  check('file yang diubah satu bit: tidak valid', externalModified.data.result?.valid === false);

  const tamperedSig = { ...sig, signature: sig.signature.slice(0, -2) + (sig.signature.endsWith('AA') ? 'BB' : 'AA') };
  const externalTamperedSig = await verifyExternal(bob, original, Buffer.from(JSON.stringify(tamperedSig)));
  check('signature yang diubah: tidak valid', externalTamperedSig.data.result?.valid === false);

  const impostor = { ...sig, signer: 'bob', keyFingerprint: bobRegistered.data.user.sigKeyFingerprint };
  const externalImpostor = await verifyExternal(bob, original, Buffer.from(JSON.stringify(impostor)));
  check('signature alice yang diklaim milik bob: tidak valid', externalImpostor.data.result?.valid === false);

  const unknownSigner = { ...sig, signer: 'mallory' };
  const externalUnknown = await verifyExternal(bob, original, Buffer.from(JSON.stringify(unknownSigner)));
  check('penanda tangan tidak terdaftar: tidak valid', externalUnknown.data.result?.valid === false);
  check('file .sig rusak ditolak (400)', (await verifyExternal(bob, original, Buffer.from('bukan json'))).status === 400);
  check('verifikasi eksternal tidak menyimpan file', (await readdir(storageDir)).length === 2);

  console.log('\nBerbagi file');
  const search = await alice.json('GET', '/api/users/search?q=bo');
  check('pencarian user menemukan bob', search.data.users?.[0]?.username === 'bob');
  const bobKeys = await alice.json('GET', '/api/users/bob/keys');
  check('public key bob bisa dilihat, 2048 bit', bobKeys.data.rsaBits === 2048 && !('d' in (bobKeys.data.encPublicKey ?? {})));

  check('share dengan password salah ditolak (403)', (await alice.json('POST', `/api/files/${file.id}/share`, { username: 'bob', password: 'salah-password' })).status === 403);
  check('share ke diri sendiri ditolak (400)', (await alice.json('POST', `/api/files/${file.id}/share`, { username: 'alice', password: alicePassword })).status === 400);
  check('share ke user tak dikenal ditolak (404)', (await alice.json('POST', `/api/files/${file.id}/share`, { username: 'mallory', password: alicePassword })).status === 404);

  const shared = await alice.json('POST', `/api/files/${file.id}/share`, { username: 'bob', password: alicePassword });
  check('share ke bob (200)', shared.status === 200 && shared.data.file?.sharedWith?.[0]?.username === 'bob', shared.data);
  check('share ganda ditolak (409)', (await alice.json('POST', `/api/files/${file.id}/share`, { username: 'bob', password: alicePassword })).status === 409);
  check('share tidak mengenkripsi ulang file', same(new Uint8Array(await readFile(storedPath)), onDisk));

  const bobListing = await bob.json('GET', '/api/files');
  check('file muncul di daftar shared bob', bobListing.data.shared?.length === 1 && bobListing.data.shared[0].owner.username === 'alice');
  check('bob tidak melihat daftar penerima lain', bobListing.data.shared?.[0]?.sharedWith?.length === 0);

  const bobDecrypted = await bob.request('POST', `/api/files/${file.id}/decrypt`, { password: bobPassword });
  check('bob mendekripsi dengan kuncinya sendiri: identik', bobDecrypted.status === 200 && same(await bodyBytes(bobDecrypted), original));
  check('bob memverifikasi signature alice: valid', (await bob.json('POST', `/api/files/${file.id}/verify`, { password: bobPassword })).data.result?.valid === true);
  check('bob tidak boleh menandatangani file alice (403)', (await bob.json('POST', `/api/files/${file.id}/sign`, { password: bobPassword })).status === 403);
  check('bob tidak boleh membagikan file alice (403)', (await bob.json('POST', `/api/files/${file.id}/share`, { username: 'alice', password: bobPassword })).status === 403);

  console.log('\nSimulasi tamper');
  const tamper = await alice.json('POST', `/api/files/${file.id}/tamper-test`, { password: alicePassword });
  const experiments: any[] = tamper.data.experiments ?? [];
  check('simulasi tamper menjalankan 9 percobaan', experiments.length === 9, experiments.length);
  check('semua percobaan tamper sesuai harapan', experiments.length > 0 && experiments.every((item) => item.passed), experiments.filter((item) => !item.passed));
  check('percobaan kontrol diterima, sisanya ditolak', experiments.filter((item) => item.outcome === 'diterima').length === 2);
  check('simulasi tamper tidak mengubah file di storage', same(new Uint8Array(await readFile(storedPath)), onDisk));

  console.log('\nTamper sungguhan di storage');
  const corrupted = onDisk.slice();
  corrupted[1234] ^= 0x10;
  await writeFile(storedPath, corrupted);
  const afterCorruption = await alice.json('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword });
  check('ciphertext yang diubah di disk ditolak (422 INTEGRITY_FAILED)', afterCorruption.status === 422 && afterCorruption.data.error?.code === 'INTEGRITY_FAILED', afterCorruption.data);
  await writeFile(storedPath, onDisk);

  const { StoredFile } = await import('../src/models/StoredFile.ts');
  const emptyRecord = await StoredFile.findById(empty.data.file.id);
  const swappedName = emptyRecord!.storedName;
  await StoredFile.updateOne({ _id: file.id }, { storedName: `swap-${swappedName}` });
  await writeFile(path.join(storageDir, `swap-${swappedName}`), randomBytes(original.length));
  const afterSwap = await alice.json('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword });
  check('ciphertext yang ditukar dengan data lain ditolak (422)', afterSwap.status === 422);
  await StoredFile.updateOne({ _id: file.id }, { storedName: storedFiles.find((name) => storedPath.endsWith(name)) });
  await rm(path.join(storageDir, `swap-${swappedName}`));
  check('file pulih setelah storage dikembalikan', (await alice.request('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword })).status === 200);

  console.log('\nCabut akses');
  const bobId = bobRegistered.data.user.id;
  const revoked = await alice.json('DELETE', `/api/files/${file.id}/share/${bobId}`);
  check('cabut akses bob (200)', revoked.status === 200 && revoked.data.file?.sharedWith?.length === 0);
  check('bob tidak bisa lagi mendekripsi (404)', (await bob.json('POST', `/api/files/${file.id}/decrypt`, { password: bobPassword })).status === 404);
  check('alice masih bisa mendekripsi', (await alice.request('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword })).status === 200);

  await alice.json('POST', `/api/files/${file.id}/share`, { username: 'bob', password: alicePassword });
  const left = await bob.json('DELETE', `/api/files/${file.id}`);
  check('penerima yang "menghapus" hanya melepas aksesnya', left.data.removed === 'access' && (await alice.json('GET', `/api/files/${file.id}`)).status === 200);

  console.log('\nGanti password');
  const newPassword = 'password-alice-2';
  check('ganti password dengan password lama salah ditolak (403)', (await alice.json('POST', '/api/auth/change-password', { currentPassword: 'salah-sekali', newPassword })).status === 403);
  const changed = await alice.json('POST', '/api/auth/change-password', { currentPassword: alicePassword, newPassword });
  check('ganti password (200)', changed.status === 200, changed.data);
  check('password lama tidak lagi membuka kunci (403)', (await alice.json('POST', `/api/files/${file.id}/decrypt`, { password: alicePassword })).status === 403);
  const afterChange = await alice.request('POST', `/api/files/${file.id}/decrypt`, { password: newPassword });
  check('password baru membuka file yang sama tanpa enkripsi ulang', afterChange.status === 200 && same(await bodyBytes(afterChange), original));
  check('signature lama tetap valid setelah ganti password', (await alice.json('POST', `/api/files/${file.id}/verify`, { password: newPassword })).data.result?.valid === true);
  check('login dengan password lama ditolak', (await new Client(baseUrl).json('POST', '/api/auth/login', { identifier: 'alice', password: alicePassword })).status === 401);
  check('login dengan password baru diterima', (await new Client(baseUrl).json('POST', '/api/auth/login', { identifier: 'alice', password: newPassword })).status === 200);

  console.log('\nCrypto Lab');
  const selfTest = await alice.json('GET', '/api/lab/selftest');
  check(`self-test: ${selfTest.data.passed}/${selfTest.data.total} lulus`, selfTest.data.total > 30 && selfTest.data.passed === selfTest.data.total);
  const benchmark = await alice.json('GET', '/api/lab/benchmark');
  check('benchmark mengembalikan angka', benchmark.status === 200 && benchmark.data.gcmEncrypt?.megabytesPerSecond > 0 && benchmark.data.keygen?.ms > 0, benchmark.data);
  check('parameter server', (await alice.json('GET', '/api/lab/parameters')).data.rsaBits === 2048);

  console.log('\nHapus dan logout');
  check('hapus file (200)', (await alice.json('DELETE', `/api/files/${file.id}`)).data.removed === 'file');
  check('ciphertext ikut terhapus dari storage', (await readdir(storageDir)).length === 1);
  check('file yang dihapus dijawab 404', (await alice.json('GET', `/api/files/${file.id}`)).status === 404);
  await alice.json('POST', '/api/auth/logout');
  check('setelah logout permintaan ditolak (401)', (await new Client(baseUrl).json('GET', '/api/auth/me')).status === 401);
}

await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
const server = createApp().listen(0);
const { port } = server.address() as AddressInfo;

try {
  await run(`http://127.0.0.1:${port}`);
} catch (error) {
  failures.push(`uji berhenti karena error: ${error instanceof Error ? error.stack : error}`);
} finally {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await rm(storageDir, { recursive: true, force: true });
}

console.log(`\n${passed} lulus, ${failures.length} gagal`);
for (const failure of failures) console.log(`  - ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
