# PRD — Crypta

**Nama:** Crypta  
**Tagline:** *Secure File Storage & Digital Signature Platform*  
**Platform:** Web Application — Local  
**Status:** Academic Project  
**Language:** TypeScript  
**Versi PRD:** 2.1 (disesuaikan dengan hasil implementasi)

## 1. Overview

**Crypta** adalah aplikasi web lokal untuk menyimpan, membagikan, dan menandatangani file secara aman menggunakan **hybrid encryption** (AES-256-GCM + RSA-OAEP) dan **digital signature** (RSA-PSS + SHA-256).

Seluruh algoritma kriptografi **diimplementasikan sendiri dari nol** dalam TypeScript, tanpa library kriptografi. Aplikasi web berfungsi sebagai pembuktian bahwa implementasi tersebut bekerja dalam sistem nyata.

## 2. Tujuan

1. Mengimplementasikan sendiri algoritma kriptografi modern dan membuktikan kebenarannya dengan test vector resmi.
2. Menunjukkan bagaimana algoritma tersebut dirangkai menjadi sistem: hybrid encryption, key wrapping, digital signature, dan berbagi file.
3. Membuat proses kriptografi **terlihat** saat demo, bukan hanya berjalan di belakang layar.

Proyek ini bukan layanan production. Batasannya dijelaskan di bagian 6.

## 3. Aturan Implementasi Manual

### 3.1 Ditulis sendiri

| Lapisan | Komponen | Acuan |
|---|---|---|
| Hash | SHA-256 | FIPS 180-4 |
| MAC & KDF | HMAC-SHA256, PBKDF2-HMAC-SHA256 | RFC 2104, RFC 8018 |
| Cipher simetris | AES-256 (key expansion, cipher, inverse cipher) | FIPS 197 |
| Mode operasi | GCM (CTR + GHASH di GF(2^128)) | NIST SP 800-38D |
| Aritmetika | modular exponentiation, modular inverse, GCD, Miller-Rabin, pembangkitan bilangan prima | — |
| RSA | key generation, operasi privat dengan CRT, I2OSP/OS2IP | RFC 8017 |
| Padding RSA | MGF1, OAEP, EMSA-PSS | RFC 8017 |
| Token | JWT HS256 (di atas HMAC-SHA256 sendiri) | RFC 7519 |
| Utilitas | hex, base64url, perbandingan constant-time | — |

Satu implementasi SHA-256 menjadi fondasi untuk HMAC, PBKDF2, MGF1, OAEP, PSS, JWT, dan fingerprint.

### 3.2 Pengecualian

- **Bilangan acak:** `crypto.randomBytes` dari Node.js. CSPRNG bergantung pada entropi sistem operasi dan tidak bisa dibuat sendiri dengan aman.
- **`BigInt`:** tipe bawaan bahasa JavaScript, bukan library.
- **Test oracle:** modul `crypto` Node.js dipakai **hanya di file test** sebagai pembanding untuk semua primitif. Tidak pernah dipanggil oleh kode aplikasi.

### 3.3 Library yang tidak dipakai

`bcrypt`, `jsonwebtoken`, `crypto-js`, `node-forge`, dan sejenisnya. Password hashing memakai PBKDF2 buatan sendiri sebagai pengganti bcrypt.

### 3.4 Library non-kriptografi yang dipakai

Express, Mongoose, Multer, React, Vite, Tailwind CSS, Vitest.

## 4. Tech Stack

| Bagian | Teknologi |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (lokal) |
| Kriptografi | Modul sendiri di `server/src/crypto` |
| Autentikasi | JWT HS256 buatan sendiri, disimpan di cookie httpOnly |
| Penyimpanan file | `server/storage/encrypted` |
| Testing | Vitest |

Seluruh operasi kriptografi berjalan di server.

## 5. Parameter Kriptografi

| Komponen | Parameter |
|---|---|
| AES | Kunci 256-bit, acak per file |
| GCM | IV 96-bit acak per enkripsi, tag 128-bit, dengan AAD |
| RSA | Modulus 2048-bit, e = 65537 |
| OAEP | SHA-256, MGF1-SHA-256, label kosong |
| PSS | SHA-256, MGF1-SHA-256, panjang salt 32 byte |
| PBKDF2 | HMAC-SHA256, output 32 byte, 600.000 iterasi |
| Batas ukuran file | 25 MB |

Parameter di atas ditetapkan dari hasil benchmark implementasi sendiri (`npm run bench`) di mesin pengembangan:

| Operasi | Hasil |
|---|---|
| Pembangkitan kunci RSA-2048 | 0,5-2,1 detik per key pair |
| PBKDF2, 600.000 iterasi | sekitar 0,8 detik |
| AES-256-GCM | 12-18 MB/s |
| SHA-256 | 185-225 MB/s |
| RSA-2048 operasi privat (dekripsi, tanda tangan) | sekitar 13 ms |

- Iterasi PBKDF2 memenuhi rekomendasi OWASP (600.000). Setiap operasi yang butuh password memakan waktu sekitar 0,8 detik.
- Batas 25 MB menjaga enkripsi satu file tetap di bawah sekitar 2 detik.
- Semua nilai bisa diubah lewat `server/.env`.

## 6. Threat Model

### Dilindungi

- **Pencurian folder storage:** file hanya berupa ciphertext.
- **Kebocoran database:** kunci AES terbungkus RSA, private key terbungkus kunci turunan password, password tersimpan sebagai hash PBKDF2.
- **Modifikasi ciphertext atau metadata:** terdeteksi oleh tag GCM dan AAD.
- **Pemalsuan atau perubahan file bertanda tangan:** terdeteksi oleh verifikasi RSA-PSS.

### Tidak dilindungi

- **Server yang sudah dikuasai penyerang saat berjalan.** Server melihat plaintext dan password ketika memproses permintaan. Ini encryption-at-rest, bukan end-to-end encryption.
- **Side-channel.** Implementasi AES dan RSA tidak constant-time.
- **Lupa password.** Private key tidak bisa dipulihkan, sehingga file hilang permanen.
- **Pencabutan akses setelah file diunduh.** Penerima yang sudah mengunduh tetap memegang salinannya.
- **Jaringan.** Aplikasi berjalan lokal lewat HTTP tanpa TLS.
- **Token setelah logout.** JWT bersifat stateless. Logout menghapus cookie, tetapi token yang sudah disalin tetap berlaku sampai kedaluwarsa (8 jam).
- **Ketersediaan.** Operasi kriptografi berjalan sinkron di thread utama server, kecuali pembangkitan kunci RSA.

## 7. Manajemen Kunci

### 7.1 Kunci per user

Setiap user memiliki **dua** RSA key pair agar satu kunci tidak dipakai untuk dua tujuan:

```text
Encryption Key Pair  → RSA-OAEP  → membungkus kunci AES file
Signing Key Pair     → RSA-PSS   → membuat digital signature
```

### 7.2 Perlindungan private key

```text
Password + kekSalt
      │
      ▼
PBKDF2-HMAC-SHA256
      │
      ▼
KEK (256-bit)
      │
      ▼
AES-256-GCM  (AAD = userId | jenis kunci)
      │
      ▼
Encrypted Private Key
```

- Hash login memakai salt terpisah (`authSalt`), sehingga hash di database tidak bisa dipakai untuk membuka private key.
- KEK tidak pernah disimpan. Ia diturunkan ulang setiap kali dibutuhkan.

### 7.3 Kapan password diminta

| Operasi | Butuh password | Alasan |
|---|---|---|
| Upload | Tidak | Hanya memakai public key |
| Verifikasi file eksternal | Tidak | Hanya memakai public key penanda tangan |
| Decrypt & download | Ya | Membuka private encryption key |
| Sign | Ya | Membuka private signing key |
| Verifikasi file tersimpan | Ya | File harus didekripsi untuk dihitung hash-nya |
| Share | Ya | Kunci AES harus dibuka lalu dibungkus ulang |

Password salah terdeteksi dari gagalnya tag GCM saat membuka private key.

### 7.4 Ganti password

Private key dibuka dengan KEK lama lalu dibungkus ulang dengan KEK baru. File tidak perlu dienkripsi ulang.

### 7.5 Fingerprint

Fingerprint = SHA-256 dari public key, ditampilkan sebagai hex. Dipakai untuk mengenali kunci di Settings, saat share, dan saat verifikasi.

## 8. Fitur

### 8.1 Authentication

- Register: membuat akun dan membangkitkan dua RSA key pair. Pembangkitan kunci berjalan di worker thread dan UI menampilkan progres.
- Login, logout, dan ganti password.

### 8.2 Secure File Upload

```text
Original File
      │
      ├──► SHA-256 ──► Plaintext Hash
      │
      ▼
Generate Random AES Key + IV
      │
      ▼
AES-256-GCM  (AAD = fileId | ownerId)
      │
      ├── Encrypted File  → storage
      └── Auth Tag        → MongoDB

AES Key
   │
   ▼
RSA-OAEP + Public Encryption Key pemilik
   │
   ▼
Wrapped AES Key → MongoDB
```

File asli tidak pernah ditulis ke disk.

### 8.3 Decrypt & Download

```text
Password ──► KEK ──► Private Encryption Key
                            │
Wrapped AES Key ──► RSA-OAEP Decrypt ──► AES Key
                                            │
Encrypted File ──► AES-256-GCM Decrypt ──► Original File
```

Tersedia juga **Download Encrypted**, yang mengunduh file `.enc` apa adanya.

### 8.4 File Sharing

Pemilik dapat membagikan file ke user lain tanpa mengenkripsi ulang file:

```text
Wrapped AES Key (pemilik)
        │
        ▼
RSA-OAEP Decrypt + Private Key pemilik
        │
        ▼
AES Key
        │
        ▼
RSA-OAEP Encrypt + Public Key penerima
        │
        ▼
Wrapped AES Key (penerima)
```

- Penerima dapat mendekripsi, mengunduh, dan memverifikasi signature.
- Hanya pemilik yang dapat membagikan, menandatangani, mencabut akses, dan menghapus file.
- Mencabut akses berarti menghapus wrapped key milik penerima.
- Penerima dapat melepas aksesnya sendiri. File tetap ada untuk pemiliknya.

### 8.5 Digital Signature

```text
Original File
 │
 ▼
SHA-256
 │
 ▼
Hash
 │
 ▼
EMSA-PSS Encode + Private Signing Key
 │
 ▼
Digital Signature
```

- Yang ditandatangani adalah **plaintext**, bukan ciphertext.
- Signature dapat diekspor sebagai file `.sig` (detached signature):

```json
{
  "algorithm": "RSA-PSS-SHA256",
  "signer": "hasro",
  "keyFingerprint": "9f2c…",
  "fileName": "laporan.pdf",
  "fileHash": "b94d…",
  "signature": "base64url…",
  "signedAt": "2026-10-07T10:00:00Z"
}
```

### 8.6 Signature Verification

Dua mode:

1. **File tersimpan** — file didekripsi, hash dihitung ulang, lalu signature diverifikasi dengan public signing key penanda tangan.
2. **File eksternal** — user mengunggah file dan `.sig`. Verifikasi memakai public key milik user yang tertera di `.sig`. File tidak disimpan.

Hasil menampilkan status valid atau invalid, nama penanda tangan, fingerprint kunci, dan waktu tanda tangan.

### 8.7 Crypto Lab

Halaman khusus untuk demonstrasi:

- **Crypto Inspector** — setiap operasi (upload, decrypt, sign, verify, share) mengembalikan jejak langkah: algoritma, nilai antara dalam hex (IV, tag, wrapped key, hash), dan durasi tiap langkah. Kunci AES dan private key tidak pernah ditampilkan utuh.
- **Tamper Simulation** — mengubah satu byte pada salinan ciphertext di memori lalu mencoba dekripsi, sehingga terlihat tag GCM gagal. Hal yang sama untuk signature: satu byte plaintext diubah, verifikasi gagal. File asli tidak disentuh.
- **Self-Test** — menjalankan known-answer test dari standar resmi dan menampilkan lulus atau gagal per algoritma.
- **Benchmark** — kecepatan AES-GCM, SHA-256, PBKDF2, dan operasi RSA. Menunjukkan mengapa hybrid encryption diperlukan.

## 9. Halaman

```text
┌──────────────────────────────────────────────┐
│ CRYPTA                             👤 User   │
├───────────────┬──────────────────────────────┤
│               │                              │
│ Dashboard     │  My Secure Files             │
│ My Files      │                              │
│ Shared        │  📄 laporan.pdf              │
│ Verify        │     🔐 Encrypted  ✍ Signed   │
│ Crypto Lab    │                              │
│ Settings      │  📄 sertifikat.pdf           │
│               │     🔐 Encrypted  👥 Shared  │
│               │                              │
│               │        [+ Upload File]       │
└───────────────┴──────────────────────────────┘
```

| Halaman | Isi |
|---|---|
| Login / Register | Form akun, progres pembangkitan kunci |
| Dashboard | Ringkasan jumlah file, file bertanda tangan, file dibagikan |
| My Files | Daftar file milik sendiri beserta aksinya |
| Shared | File yang dibagikan user lain |
| Verify | Verifikasi file eksternal dengan `.sig` |
| Crypto Lab | Inspector, Tamper Simulation, Self-Test, Benchmark |
| Settings | Public key, fingerprint, ganti password |

Aksi pada file milik sendiri: Decrypt & Download, Download Encrypted, Sign, Verify, Export `.sig`, Share, Tamper Test, Delete.

## 10. Database Structure

### users

```text
users
├── _id
├── username
├── email
├── passwordHash
├── authSalt
├── kekSalt
├── kdfIterations
├── encPublicKey          { n, e }
├── sigPublicKey          { n, e }
├── encPrivateKey         { ciphertext, iv, tag }
├── sigPrivateKey         { ciphertext, iv, tag }
├── encKeyFingerprint
├── sigKeyFingerprint
└── createdAt
```

### files

```text
files
├── _id
├── ownerId
├── originalName
├── storedName
├── size
├── mimeType
├── iv
├── authTag
├── plaintextHash
├── wrappedKeys[]
│   ├── userId
│   ├── wrappedKey
│   └── sharedAt
├── signature             (opsional)
│   ├── value
│   ├── signerId
│   ├── keyFingerprint
│   └── signedAt
├── createdAt
└── updatedAt
```

`wrappedKeys` selalu berisi entri pemilik. Entri lain adalah penerima share.

## 11. API

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/change-password

GET    /api/users/search?q=
GET    /api/users/:username/keys

GET    /api/files
POST   /api/files
GET    /api/files/:id
GET    /api/files/:id/raw
POST   /api/files/:id/decrypt
DELETE /api/files/:id

POST   /api/files/:id/sign
POST   /api/files/:id/verify
GET    /api/files/:id/signature
POST   /api/verify

POST   /api/files/:id/share
DELETE /api/files/:id/share/:userId

POST   /api/files/:id/tamper-test
GET    /api/lab/selftest
GET    /api/lab/benchmark
GET    /api/lab/parameters
```

Endpoint yang membutuhkan password menerimanya di body permintaan.

## 12. Struktur Project

```text
crypta/
├── client/
│   └── src/
│       ├── components/          ← FileList, PasswordDialog, InspectorDrawer, ...
│       ├── pages/               ← Dashboard, Files, Verify, CryptoLab, Settings
│       ├── services/api.ts
│       ├── hooks/               ← useAuth, useFiles, useInspector, useToast
│       ├── lib/format.ts
│       └── types.ts
│
├── server/
│   ├── src/
│   │   ├── crypto/              ← pustaka kriptografi buatan sendiri
│   │   │   ├── bytes.ts
│   │   │   ├── random.ts
│   │   │   ├── sha256.ts
│   │   │   ├── hmac.ts
│   │   │   ├── pbkdf2.ts
│   │   │   ├── aes.ts
│   │   │   ├── gcm.ts
│   │   │   ├── bigint.ts
│   │   │   ├── prime.ts
│   │   │   ├── rsa.ts
│   │   │   ├── mgf1.ts
│   │   │   ├── oaep.ts
│   │   │   ├── pss.ts
│   │   │   ├── jwt.ts
│   │   │   ├── selftest.ts      ← known-answer test, dipakai test dan Crypto Lab
│   │   │   └── benchmark.ts
│   │   ├── services/            ← merangkai primitif menjadi alur
│   │   │   ├── keyService.ts
│   │   │   ├── fileService.ts
│   │   │   ├── signatureService.ts
│   │   │   ├── shareService.ts
│   │   │   ├── labService.ts
│   │   │   ├── serializers.ts
│   │   │   └── trace.ts
│   │   ├── workers/             ← pembangkitan kunci RSA di worker thread
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/              ← User, StoredFile
│   │   └── middleware/
│   ├── tests/
│   │   ├── vectors/             ← test vector resmi
│   │   ├── interop/             ← uji silang dengan crypto Node.js
│   │   └── crypto/              ← uji negatif
│   ├── scripts/                 ← e2e.ts, bench.ts
│   └── storage/
│       └── encrypted/
│
├── crypta-prd.md
└── README.md
```

`server/src/crypto` tidak bergantung pada Express, MongoDB, atau package pihak ketiga apa pun.

## 13. Strategi Pengujian

Kriptografi buatan sendiri yang salah sedikit tetap terlihat "berjalan". Karena itu setiap primitif wajib lulus test vector resmi sebelum dipakai lapisan di atasnya.

| Komponen | Sumber test vector |
|---|---|
| SHA-256 | FIPS 180-4 / NIST CAVP |
| HMAC-SHA256 | RFC 4231 |
| PBKDF2-HMAC-SHA256 | RFC 7914 bagian 11 |
| AES-256 | FIPS 197 Appendix C.3 |
| AES-256-GCM | Test case GCM spec (McGrew & Viega) |
| RSA-OAEP, RSA-PSS | Uji silang dua arah dengan `crypto` Node.js |

Uji silang RSA: enkripsi dengan Crypta lalu dekripsi dengan Node.js dan sebaliknya; tanda tangan dengan Crypta lalu verifikasi dengan Node.js dan sebaliknya.

Uji negatif: tag salah, AAD salah, ciphertext diubah, signature diubah, dan password salah harus ditolak.

Di atas pustaka kripto ada dua lapisan lagi:

- **End-to-end** (`npm run e2e`): server sungguhan dijalankan terhadap database dan storage sementara, lalu seluruh alur diuji lewat HTTP, termasuk merusak ciphertext di disk.
- **Penelusuran UI**: alur yang sama dijalankan di browser sungguhan.

## 14. Urutan Pengerjaan

| Tahap | Isi | Status |
|---|---|---|
| M0 | Scaffold client dan server, TypeScript, Vitest, koneksi MongoDB | Selesai |
| M1 | `bytes`, `sha256`, `hmac`, `pbkdf2`, `aes`, `gcm` | Selesai, semua test vector lulus |
| M2 | `bigint`, `prime`, `rsa`, `mgf1`, `oaep`, `pss`, worker keygen | Selesai, uji silang dengan Node.js lulus |
| M3 | `jwt`, register, login, logout, pembungkusan private key, ganti password | Selesai |
| M4 | Upload, daftar file, decrypt & download, download encrypted, delete | Selesai, hasil unduhan identik byte demi byte |
| M5 | Sign, verify file tersimpan, export `.sig`, verify eksternal | Selesai |
| M6 | Share dan cabut akses | Selesai |
| M7 | Crypto Lab: Inspector, Tamper Simulation, Self-Test, Benchmark | Selesai |
| M8 | UI, README | Selesai |

## 15. Scope

### Included

- [x] Pustaka kriptografi buatan sendiri dengan test vector
- [x] Register, login, logout, ganti password
- [x] Dua RSA key pair per user, private key terbungkus password
- [x] Upload dan enkripsi AES-256-GCM dengan AAD
- [x] Pembungkusan kunci dengan RSA-OAEP
- [x] Decrypt & download, download encrypted
- [x] Digital signature RSA-PSS dan ekspor `.sig`
- [x] Verifikasi file tersimpan dan file eksternal
- [x] Berbagi file dan pencabutan akses
- [x] Fingerprint kunci
- [x] Crypto Lab

### Not Included

- Deployment dan cloud storage
- Kriptografi di sisi browser (end-to-end encryption)
- Pemulihan akun saat lupa password
- Audit log
- Rotasi kunci RSA
- Email verification, social login
- Implementasi constant-time
- Mobile app
