import { ArrowRight, FileText, KeyRound, LoaderCircle, Lock, Stamp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { UploadZone } from '../components/UploadZone';
import { useAuth } from '../hooks/useAuth';
import { useFiles, useParameters } from '../hooks/useFiles';
import { formatBytes, formatDate, groupHex } from '../lib/format';

// Alur pemisah antar penghitung: 2x2 di layar sempit, satu baris di layar lebar.
const COUNTER_GROOVES = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-t border-l lg:border-t-0'];

export function DashboardPage() {
  const { user } = useAuth();
  const { listing, error, reload } = useFiles();
  const parameters = useParameters();

  const owned = listing?.owned ?? [];
  const shared = listing?.shared ?? [];
  const summary = [
    { label: 'Encrypted files', value: owned.length },
    { label: 'Signed', value: owned.filter((file) => file.signature).length },
    { label: 'Shared by me', value: owned.filter((file) => file.sharedWith.length > 0).length },
    { label: 'Shared with me', value: shared.length },
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.username}`}
        description="Your files are encrypted with AES-256-GCM before they are stored, and each AES key is wrapped with your RSA public key."
      />

      <UploadZone maxFileSize={parameters?.maxFileSize} onUploaded={reload} />

      {error && (
        <div role="alert" className="alert alert-error mt-4 items-center justify-between">
          <span>{error}</span>
          <button type="button" className="btn" onClick={reload}>
            Try Again
          </button>
        </div>
      )}

      {/* Penghitung dicetak masuk ke kertas: nilainya dibaca, bukan ditekan. */}
      <dl className="well mt-6 grid grid-cols-2 lg:grid-cols-4">
        {summary.map((item, index) => (
          <div key={item.label} className={`border-line px-4 py-3 ${COUNTER_GROOVES[index]}`}>
            <dt className="term">{item.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">{listing ? item.value : '–'}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 grid items-start gap-7 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <PanelHeader title="Recent files" to="/files" linkLabel="All files" />
          {!listing ? (
            <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-ink-muted">
              {error ? (
                'The file list could not be loaded.'
              ) : (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading files…
                </>
              )}
            </p>
          ) : owned.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">No files yet. Upload your first file above.</p>
          ) : (
            <ul className="divide-y divide-line">
              {owned.slice(0, 5).map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="size-4 shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{file.originalName}</p>
                    <p className="text-xs text-ink-muted">
                      {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <Lock className="size-3.5 shrink-0 text-seal" role="img" aria-label="Encrypted" />
                  {file.signature && <Stamp className="size-3.5 shrink-0 text-stamp" role="img" aria-label="Signed" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <PanelHeader title="Your keys" to="/settings" linkLabel="Public keys" />
          <div className="space-y-5 px-4 py-4">
            <KeySummary icon={<KeyRound className="size-4 text-seal" />} title="Encryption key" usage="RSA-OAEP, wraps file AES keys" fingerprint={user?.encKeyFingerprint} />
            <KeySummary icon={<Stamp className="size-4 text-stamp" />} title="Signing key" usage="RSA-PSS, digital signatures" fingerprint={user?.sigKeyFingerprint} />
          </div>
        </section>
      </div>
    </>
  );
}

function PanelHeader({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="groove-b flex items-center justify-between gap-3 px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <Link to={to} className="flex items-center gap-1 rounded text-xs font-medium text-stamp hover:underline">
        {linkLabel} <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function KeySummary({ icon, title, usage, fingerprint }: { icon: ReactNode; title: string; usage: string; fingerprint?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        {icon}
        {title}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{usage}</p>
      <p className="hex mt-1.5">{fingerprint ? groupHex(fingerprint) : ''}</p>
    </div>
  );
}
