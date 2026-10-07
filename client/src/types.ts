export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  encKeyFingerprint: string;
  sigKeyFingerprint: string;
}

export interface TraceStep {
  label: string;
  algorithm: string;
  ms: number;
  values: Record<string, string | number>;
}

export interface Trace {
  operation: string;
  totalMs: number;
  steps: TraceStep[];
}

export interface FileSignatureInfo {
  algorithm: string;
  signer: string;
  keyFingerprint: string;
  signedAt: string;
}

export interface ShareRecipient {
  id: string;
  username: string;
  sharedAt: string;
}

export interface FileItem {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  owner: { id: string; username: string };
  isOwner: boolean;
  encryption: {
    algorithm: string;
    keyAlgorithm: string;
    storedName: string;
    iv: string;
    authTag: string;
  };
  plaintextHash: string;
  signature: FileSignatureInfo | null;
  sharedWith: ShareRecipient[];
}

export interface FileListing {
  owned: FileItem[];
  shared: FileItem[];
}

export interface VerificationResult {
  valid: boolean;
  reason: string;
  signer: string | null;
  keyFingerprint: string | null;
  signedAt: string | null;
  fileName: string | null;
  fileHash: string;
}

export interface TamperExperiment {
  title: string;
  change: string;
  expected: 'diterima' | 'ditolak';
  outcome: 'diterima' | 'ditolak';
  detectedBy: string;
  passed: boolean;
  ms: number;
}

export interface TamperReport {
  fileName: string;
  experiments: TamperExperiment[];
  trace: Trace;
}

export interface SelfTestResult {
  algorithm: string;
  name: string;
  source: string;
  passed: boolean;
  ms: number;
  error?: string;
}

export interface SelfTestReport {
  results: SelfTestResult[];
  passed: number;
  total: number;
}

export interface Throughput {
  megabytes: number;
  ms: number;
  megabytesPerSecond: number;
}

export interface BenchmarkReport {
  sha256: Throughput;
  gcmEncrypt: Throughput;
  gcmDecrypt: Throughput;
  pbkdf2: { iterations: number; ms: number };
  rsa: {
    bits: number;
    oaepEncryptMs: number;
    oaepDecryptMs: number;
    pssSignMs: number;
    pssVerifyMs: number;
    oaepMaxMessageBytes: number;
    oaepEncryptKilobytesPerSecond: number;
    oaepDecryptKilobytesPerSecond: number;
  };
  keygen: { bits: number; ms: number };
}

export interface PublicJwk {
  kty: string;
  n: string;
  e: string;
}

export interface PublicKeys {
  username: string;
  rsaBits: number;
  encPublicKey: PublicJwk;
  sigPublicKey: PublicJwk;
  encKeyFingerprint: string;
  sigKeyFingerprint: string;
}

export interface ServerParameters {
  rsaBits: number;
  pbkdf2Iterations: number;
  maxFileSize: number;
  algorithms: Record<string, string>;
}

export interface UserSummary {
  id: string;
  username: string;
  encKeyFingerprint: string;
}
