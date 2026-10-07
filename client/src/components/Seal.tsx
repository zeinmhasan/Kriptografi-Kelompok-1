import { useId } from 'react';
import { formatDate } from '../lib/format';

interface SealProps {
  signer: string;
  keyFingerprint: string;
  signedAt?: string | null;
  // embossed: cap timbul tanpa tinta, tanda bahwa file membawa tanda tangan.
  // valid: cap bertinta, baru saja lolos verifikasi.
  // broken: cap retak, verifikasi gagal.
  state: 'embossed' | 'valid' | 'broken';
  className?: string;
}

const STATE_LABEL = { embossed: 'Signed', valid: 'Valid signature', broken: 'Invalid signature' };

// Cap penanda tangan. Isinya data sungguhan: nama penanda tangan, ujung fingerprint
// kuncinya, dan tanggal tanda tangan.
export function Seal({ signer, keyFingerprint, signedAt, state, className = '' }: SealProps) {
  const id = useId();
  const head = keyFingerprint.slice(0, 8).toUpperCase();
  const tail = keyFingerprint.slice(-8).toUpperCase();
  const date = signedAt ? formatDate(signedAt).split(',')[0] : '';
  const name = signer.length > 14 ? `${signer.slice(0, 13)}…` : signer;
  // Nama mengecil mengikuti panjangnya supaya tetap di dalam lingkaran tengah.
  const nameSize = Math.min(12.5, 112 / name.length);

  const face = (
    <>
      <circle cx="60" cy="60" r="56" fill="none" strokeWidth="2.25" />
      <circle cx="60" cy="60" r="51.5" fill="none" strokeWidth="0.75" />
      <circle cx="60" cy="60" r="33" fill="none" strokeWidth="0.75" strokeDasharray="1.5 2.5" />
      <text stroke="none" fontSize="8.6" fontWeight="700" letterSpacing="1.2">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
          RSA-PSS · SHA-256
        </textPath>
      </text>
      <text stroke="none" fontSize="7.6" fontWeight="600" letterSpacing="0.6" style={{ fontFamily: 'var(--font-mono)' }}>
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
          {head} · {tail}
        </textPath>
      </text>
      <text x="60" y="60" stroke="none" fontSize={nameSize} fontWeight="700" textAnchor="middle">
        {name}
      </text>
      <text x="60" y="72" stroke="none" fontSize="7.4" fontWeight="500" textAnchor="middle" letterSpacing="0.2">
        {date}
      </text>
    </>
  );

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${STATE_LABEL[state]}: ${signer}, key ${head}…${tail}`}
      className={`shrink-0 overflow-visible font-sans ${state === 'valid' ? 'animate-seal-press -rotate-6' : ''} ${className}`}
    >
      <defs>
        <path id={`${id}-top`} d="M 18.5,60 A 41.5,41.5 0 0 1 101.5,60" />
        <path id={`${id}-bottom`} d="M 13.5,60 A 46.5,46.5 0 0 0 106.5,60" />
        <clipPath id={`${id}-upper`}>
          <polygon points="0,0 120,0 120,38 0,86" />
        </clipPath>
        <clipPath id={`${id}-lower`}>
          <polygon points="0,86 120,38 120,120 0,120" />
        </clipPath>
      </defs>

      {state === 'embossed' && (
        <>
          {/* Cakram timbul tanpa tinta: satu tepi terang di kiri atas, satu tepi gelap di kanan bawah. */}
          <circle cx="60" cy="60" r="56" fill="var(--color-ground)" style={{ filter: 'drop-shadow(-2px -2px 3px var(--relief-light)) drop-shadow(2px 2px 3px var(--relief-dark))' }} />
          <g fill="var(--color-ink-muted)" stroke="var(--color-ink-muted)">
            {face}
          </g>
        </>
      )}

      {state === 'valid' && (
        <g fill="var(--color-stamp)" stroke="var(--color-stamp)">
          {face}
        </g>
      )}

      {state === 'broken' && (
        <g fill="var(--color-alert)" stroke="var(--color-alert)">
          {/* Dua belahan yang tidak lagi bertemu. */}
          <g clipPath={`url(#${id}-upper)`} transform="translate(-3.5 -4) rotate(-3 60 60)">
            {face}
          </g>
          <g clipPath={`url(#${id}-lower)`} transform="translate(3.5 4.5) rotate(2.5 60 60)">
            {face}
          </g>
        </g>
      )}
    </svg>
  );
}
