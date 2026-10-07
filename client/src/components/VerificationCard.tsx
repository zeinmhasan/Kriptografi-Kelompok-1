import { ShieldAlert } from 'lucide-react';
import { formatDate, groupHex } from '../lib/format';
import type { VerificationResult } from '../types';
import { Seal } from './Seal';

// Hasil verifikasi: cap penanda tangan ditekan bertinta bila valid, dan retak bila tidak.
export function VerificationCard({ result }: { result: VerificationResult }) {
  const tone = result.valid
    ? { text: 'text-seal', title: 'Valid Signature' }
    : { text: 'text-alert', title: 'Invalid Signature' };

  const rows: [string, string | null, boolean][] = [
    ['Signer', result.signer, false],
    ['Signed at', result.signedAt ? formatDate(result.signedAt) : null, false],
    ['File name when signed', result.fileName, false],
    ['Signing key fingerprint', result.keyFingerprint ? groupHex(result.keyFingerprint) : null, true],
    ['SHA-256 of the checked file', groupHex(result.fileHash, 8), true],
  ];

  return (
    <div className="well animate-rise p-4 sm:p-5" role="status">
      <div className="flex items-center gap-4 sm:gap-5">
        {result.signer && result.keyFingerprint ? (
          <Seal
            signer={result.signer}
            keyFingerprint={result.keyFingerprint}
            signedAt={result.signedAt}
            state={result.valid ? 'valid' : 'broken'}
            className="size-28 sm:size-36"
          />
        ) : (
          <ShieldAlert className={`size-10 shrink-0 ${tone.text}`} />
        )}
        <div className="min-w-0">
          <p className={`text-lg leading-tight font-semibold ${tone.text}`}>{tone.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{result.reason}</p>
        </div>
      </div>
      <dl className="groove-t mt-4 space-y-2.5 pt-3.5">
        {rows
          .filter(([, value]) => value)
          .map(([label, value, isHex]) => (
            <div key={label}>
              <dt className="term">{label}</dt>
              <dd className={isHex ? 'hex text-ink' : 'text-sm break-words text-ink'}>{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
