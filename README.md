# Crypta

*Secure File Storage & Digital Signature Platform*

Aplikasi web lokal untuk menyimpan, membagikan, dan menandatangani file dengan hybrid encryption (AES-256-GCM + RSA-OAEP) dan digital signature (RSA-PSS + SHA-256).

Seluruh algoritma kriptografi ditulis sendiri dalam TypeScript, tanpa library kriptografi. Rancangan lengkapnya ada di [crypta-prd.md](crypta-prd.md).

## Kelompok 1 Kriptografi

| Nama | NRP |
|---|---|
| Muhammad Fatihul Qolbi | 5027241023 |
| Zein Muhammad Hasan | 5027241035 |
| Raya Ahmad Syarif | 5027241041 |

## Prasyarat

- Node.js 22 atau lebih baru
- MongoDB yang berjalan di `mongodb://127.0.0.1:27017`

## Menjalankan

```bash
npm run setup        # pasang dependensi server dan client, sekali saja
```

**Mode pengembangan** (dua terminal):

```bash
npm run dev:server   # API di http://localhost:4000
npm run dev:client   # UI di http://localhost:5173
```

**Mode satu proses** (untuk demo):

```bash
npm run build        # build client
npm start            # API dan UI di http://localhost:4000
```

Konfigurasi bersifat opsional. Salin `server/.env.example` menjadi `server/.env` untuk mengubahnya. Isi `JWT_SECRET` supaya sesi login tidak hangus setiap server di-restart.

## Pengujian

```bash
npm test             # test vector resmi, uji silang dengan Node.js, uji negatif
npm run e2e          # seluruh alur lewat HTTP, pakai database sementara
npm run bench        # kecepatan tiap primitif di mesin ini
```

| Lapisan | Isi | Jumlah |
|---|---|---|
| Known-answer test | Vektor dari FIPS 180-4, FIPS 197, GCM spec, RFC 4231, RFC 7914 | 41 kasus |
| Uji silang | Hasil Crypta dibandingkan dengan modul `crypto` Node.js, dua arah untuk RSA | 13 kasus |
| Uji negatif | Data, tag, kunci, signature, dan token yang diubah harus ditolak | 19 kasus |
| End-to-end | Registrasi sampai hapus file, lewat HTTP | 88 pemeriksaan |

## Pustaka kriptografi

Semua ada di [server/src/crypto](server/src/crypto) dan tidak bergantung pada package pihak ketiga.

| Berkas | Isi | Acuan |
|---|---|---|
| `sha256.ts` | SHA-256 | FIPS 180-4 |
| `hmac.ts` | HMAC-SHA256 | RFC 2104 |
| `pbkdf2.ts` | PBKDF2-HMAC-SHA256 | RFC 8018 |
| `aes.ts` | AES-128/192/256, S-box dibangun dari definisinya | FIPS 197 |
| `gcm.ts` | Mode GCM: counter mode + GHASH di GF(2^128) | NIST SP 800-38D |
| `bigint.ts` | Eksponensiasi modular, invers modular, GCD | — |
| `prime.ts` | Miller-Rabin, pembangkitan bilangan prima | — |
| `rsa.ts` | Pembangkitan kunci, operasi privat dengan CRT, JWK, fingerprint | RFC 8017 |
| `mgf1.ts`, `oaep.ts`, `pss.ts` | MGF1, RSAES-OAEP, RSASSA-PSS | RFC 8017 |
| `jwt.ts` | JWT HS256 | RFC 7519 |
| `bytes.ts` | Hex, base64url, perbandingan constant-time | — |
| `selftest.ts`, `benchmark.ts` | Known-answer test dan pengukuran kecepatan | — |

Dua pengecualian dari aturan "tanpa library":

- `random.ts` memakai `crypto.randomBytes` Node.js, karena CSPRNG bergantung pada entropi sistem operasi.
- File di `server/tests` memakai modul `crypto` Node.js sebagai pembanding. Kode aplikasi tidak pernah memanggilnya.

## Alur demo yang disarankan

1. Daftarkan dua akun di dua jendela browser. Crypto Inspector menampilkan pembangkitan kedua key pair.
2. Upload file. Inspector menampilkan hash, IV, auth tag, dan kunci AES yang terbungkus.
3. Buka file di **My Files** untuk melihat metadatanya, lalu **Decrypt & Download**.
4. **Sign**, **Verify**, lalu **Export .sig**.
5. **Share** ke akun kedua. Di akun kedua, buka **Shared** dan dekripsi dengan password akun itu sendiri.
6. Di akun kedua, buka **Verify** dan periksa file asli dengan `.sig`-nya. Ubah satu byte file itu lalu periksa lagi.
7. **Tamper Test** pada file: sembilan percobaan pembalikan satu bit.
8. **Crypto Lab**: jalankan Self-Test dan Benchmark.

## Batasan

Ini proyek akademik, bukan layanan production.

- Server melihat plaintext dan password saat memproses permintaan. Ini encryption-at-rest, bukan end-to-end encryption.
- Implementasi AES dan RSA tidak constant-time, jadi tidak tahan serangan side-channel.
- Lupa password berarti private key tidak bisa dibuka dan file hilang permanen.
- Mencabut akses tidak menarik kembali salinan yang sudah diunduh penerima.
- Logout menghapus cookie sesi, tetapi token yang sudah disalin tetap berlaku sampai kedaluwarsa (8 jam).
- Operasi kriptografi berjalan sinkron di thread utama server, kecuali pembangkitan kunci RSA.
- Aplikasi berjalan lewat HTTP lokal tanpa TLS.
