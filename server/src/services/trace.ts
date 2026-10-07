// Jejak langkah kriptografi untuk Crypto Inspector: setiap operasi mencatat
// algoritma, nilai antara, dan durasinya.
import { bytesToHex } from '../crypto/bytes.ts';

export type TraceValues = Record<string, string | number>;

export interface TraceStep {
  label: string;
  algorithm: string;
  ms: number;
  values: TraceValues;
}

export interface Trace {
  operation: string;
  totalMs: number;
  steps: TraceStep[];
}

export class Tracer {
  private readonly steps: TraceStep[] = [];
  private readonly startedAt = performance.now();
  private readonly operation: string;

  constructor(operation: string) {
    this.operation = operation;
  }

  // Menjalankan satu langkah, mengukur durasinya, dan mencatat nilai yang boleh ditampilkan.
  step<T>(label: string, algorithm: string, run: () => T, describe?: (result: T) => TraceValues): T {
    const start = performance.now();
    const result = run();
    const ms = performance.now() - start;
    this.steps.push({ label, algorithm, ms, values: describe ? describe(result) : {} });
    return result;
  }

  // Mencatat langkah yang sudah dijalankan di tempat lain, misalnya di worker thread.
  record(label: string, algorithm: string, ms: number, values: TraceValues = {}): void {
    this.steps.push({ label, algorithm, ms, values });
  }

  finish(): Trace {
    return { operation: this.operation, totalMs: performance.now() - this.startedAt, steps: this.steps };
  }
}

// Hex untuk ditampilkan: nilai pendek utuh, nilai panjang dipotong.
export function preview(bytes: Uint8Array, maxBytes: number = 32): string {
  if (bytes.length <= maxBytes) return bytesToHex(bytes);
  return `${bytesToHex(bytes.subarray(0, maxBytes))}… (${bytes.length} byte)`;
}

// Kunci rahasia tidak pernah masuk ke jejak, hanya ukurannya.
export function hidden(bytes: Uint8Array): string {
  return `${bytes.length * 8} bit, disembunyikan`;
}
