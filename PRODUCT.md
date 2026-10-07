# Product

<!-- impeccable:product-schema 1 -->

> Provenance: written by `impeccable init` from `crypta-prd.md`, `README.md`, and the client code. The interview was declined, so the only fact confirmed in conversation is the interface language (English). Statements marked **(inferred)** are readings of the repository, not team decisions; correct them freely.

## Platform

web

## Users

- **Operators:** the three members of Kelompok 1 Kriptografi (listed in `README.md`), who run Crypta locally and drive it during a demonstration.
- **Audience (inferred):** the cryptography course lecturer or assessor, watching the team walk through the demo flow and judging whether the hand-written algorithms are correct and correctly composed.
- **Job:** show, step by step, that a file can be encrypted, shared, signed, verified, and shown to fail when tampered with, and that every one of those steps runs on the team's own implementation.
- **Not established:** whether the assessor ever uses the app hands-on, whether the demo is projected or shown on a laptop, and whether screenshots or recordings go into a written report.

## Product Purpose

Crypta is a local web application for storing, sharing, and signing files with hybrid encryption (AES-256-GCM + RSA-OAEP) and digital signatures (RSA-PSS + SHA-256).

It exists for three stated goals (PRD section 2):

1. Implement modern cryptographic algorithms by hand and prove them correct against official test vectors.
2. Show how those algorithms compose into a system: hybrid encryption, key wrapping, digital signature, file sharing.
3. Make the cryptographic process **visible** during a demo, not only running behind the scenes.

Success is a demo in which the audience can see the intermediate values of each operation and trust that the implementation is real. It is an academic project, not a production service.

## Positioning

Every cryptographic primitive is written from scratch in TypeScript with no cryptography library: SHA-256, HMAC, PBKDF2, AES-256, GCM, big-integer arithmetic, Miller-Rabin, RSA key generation, MGF1, OAEP, PSS, and JWT HS256. One SHA-256 implementation underlies HMAC, PBKDF2, MGF1, OAEP, PSS, JWT, and fingerprints.

The web app is the proof that the library works in a real system, and the interface exposes the algorithm, intermediate hex values, and duration of each step instead of hiding them.

Only two exceptions to "no library": `crypto.randomBytes` for randomness, and Node's `crypto` module as a comparison oracle inside test files only.

## Operating Context

- Runs locally over plain HTTP: API on `localhost:4000`, dev UI on `localhost:5173`, or both from port 4000 in single-process demo mode. Requires Node.js 22+ and a local MongoDB.
- The suggested demo (README) uses **two accounts in two browser windows**: register both, upload, inspect metadata, decrypt and download, sign, verify, export `.sig`, share to the second account, verify an external file with its `.sig`, change one byte and verify again, run the tamper test, then run Self-Test and Benchmark in the Crypto Lab.
- Waiting is part of the experience and has real causes: RSA-2048 key generation takes roughly 0.5-2.1 s per key pair at registration (two pairs, in a worker thread, with progress shown); every password-gated operation costs about 0.8 s of PBKDF2 (600,000 iterations); encrypting a file near the 25 MB limit takes up to about 2 s.
- A password is requested for decrypt and download, sign, verify of a stored file, and share. It is not requested for upload or for verifying an external file.

## Capabilities and Constraints

**Capabilities**

- Authentication: register (generates two RSA key pairs), login, logout, change password (private keys are re-wrapped; files are not re-encrypted).
- Two RSA key pairs per user: an encryption key (RSA-OAEP, wraps AES file keys) and a signing key (RSA-PSS).
- Upload with AES-256-GCM encryption and AAD; decrypt and download; download the raw encrypted `.enc`.
- Sign a file (over the plaintext), verify a stored file, export a detached `.sig`, verify an external file against a `.sig`.
- Share a file with another user by re-wrapping the AES key; the owner can revoke access; a recipient can release their own access.
- Owner-only actions: share, sign, revoke, delete. Recipients can decrypt, download, and verify.
- Key fingerprints (SHA-256 of the public key, shown as hex) identify keys in Settings, when sharing, and when verifying.
- Crypto Lab: Crypto Inspector (per-operation step trace), Tamper Simulation (single-bit flips on in-memory copies), Self-Test (known-answer tests), Benchmark.

**Pages:** Login / Register, Dashboard, My Files, Shared, Verify, Crypto Lab, Settings.

**Constraints**

- The full AES key and private keys are never displayed.
- All cryptographic operations run on the server; the browser does none.
- File size limit 25 MB. Parameters (RSA bits, PBKDF2 iterations, size limit) are configurable in `server/.env`, so the UI reads them from the API instead of hard-coding them.
- Stated limits that the product must not contradict: encryption at rest, not end-to-end; AES and RSA are not constant-time; a forgotten password means permanent loss of files; revoking access does not recall downloaded copies; a copied JWT stays valid until expiry (8 hours) after logout; no TLS.
- Out of scope: deployment, cloud storage, browser-side crypto, account recovery, audit log, RSA key rotation, email verification, social login, mobile app.

**Interface language:** English throughout, confirmed by the team on 2026-10-07. This covers navigation, actions, messages, and explanatory copy, with the document language set to match. The repository's documentation (`README.md`, `crypta-prd.md`) is in Indonesian and is not covered by this rule.

**Terminology in use:** Crypto Inspector, Tamper Test, Self-Test, Benchmark, fingerprint, wrapped key, auth tag, IV, AAD, KEK, `.sig`, `.enc`.

**Undecided**

- The viewing conditions of the demo (projector, laptop, or screen share).

## Brand Commitments

- **Name:** Crypta.
- **Tagline:** *Secure File Storage & Digital Signature Platform*.
- **Existing asset:** an inline SVG favicon in `client/index.html`. No other logo or brand asset exists in the repository.
- **Voice (inferred from the original Indonesian copy):** plain and precise, names the actual algorithm at work, addresses the user directly, and states limits without softening. Written in English per the interface language rule.

## Evidence on Hand

- Test suite (README): 41 known-answer cases from FIPS 180-4, FIPS 197, the GCM spec, RFC 4231, and RFC 7914; 13 interoperability cases against Node's `crypto`; 19 negative cases; 88 end-to-end checks over HTTP.
- Benchmarks measured on the development machine (PRD section 5): RSA-2048 key generation 0.5-2.1 s, PBKDF2 at 600,000 iterations about 0.8 s, AES-256-GCM 12-18 MB/s, SHA-256 185-225 MB/s, RSA-2048 private operation about 13 ms. These are machine-specific; the live Benchmark in the Crypto Lab is the authoritative source at demo time.
- Live evidence produced by the running app: operation traces, tamper results, self-test results, and benchmark results.
- Standards referenced: FIPS 180-4, FIPS 197, NIST SP 800-38D, RFC 2104, RFC 7519, RFC 8017, RFC 8018.

**Absent, and not to be fabricated:** real users, testimonials, customers, a security audit, production deployment, uptime or adoption figures, and any claim of end-to-end encryption, side-channel resistance, or production readiness.

## Product Principles

1. **Show the cryptography.** An operation that only succeeds silently has failed the product's third goal; the algorithm, intermediate values, and timing belong in view.
2. **Real values only.** Every hash, IV, tag, fingerprint, and duration on screen comes from an actual operation, never from illustration.
3. **Honest about limits.** The product says what it does not protect against as plainly as what it does.
4. **Secrets stay secret, even in a demo.** Visibility stops at the AES key and private keys.
5. **The file workflow is the proof.** Storage, sharing, and signing must work as a coherent everyday flow, because the app is the evidence that the library functions in a real system.
