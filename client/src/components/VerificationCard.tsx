import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDate, groupHex } from '../lib/format';
import type { VerificationResult } from '../types';

export function VerificationCard({ result }: { result: VerificationResult }) {
  const tone = result.valid
    ? { box: 'border-emerald-500/40 bg-emerald-500/10', text: 'text-emerald-300', Icon: ShieldCheck, title: 'Signature Valid' }
    : { box: 'border-rose-500/40 bg-rose-500/10', text: 'text-rose-300', Icon: ShieldAlert, title: 'Signature Tidak Valid' };

  const rows: [string, string | null, boolean][] = [
    ['Penanda tangan', result.signer, false],
    ['Waktu tanda tangan', result.signedAt ? formatDate(result.signedAt) : null, false],
    ['Nama file saat ditandatangani', result.fileName, false],
    ['Fingerprint signing key', result.keyFingerprint ? groupHex(result.keyFingerprint) : null, true],
    ['SHA-256 file yang diperiksa', groupHex(result.fileHash, 8), true],
  ];

  return (
    <div className={`rounded-xl border p-4 ${tone.box}`} role="status">
      <div className="flex items-center gap-3">
        <tone.Icon className={`size-8 shrink-0 ${tone.text}`} />
        <div>
          <p className={`text-lg font-semibold ${tone.text}`}>{tone.title}</p>
          <p className="text-sm text-slate-300">{result.reason}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 border-t border-white/10 pt-3">
        {rows
          .filter(([, value]) => value)
          .map(([label, value, isHex]) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className={isHex ? 'hex' : 'text-sm break-words text-slate-100'}>{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
