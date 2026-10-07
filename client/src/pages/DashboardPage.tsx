import { ArrowRight, FileText, Fingerprint, KeyRound, Lock, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { UploadZone } from '../components/UploadZone';
import { useAuth } from '../hooks/useAuth';
import { useFiles, useParameters } from '../hooks/useFiles';
import { formatBytes, formatDate, groupHex } from '../lib/format';

export function DashboardPage() {
  const { user } = useAuth();
  const { listing, error, reload } = useFiles();
  const parameters = useParameters();

  const owned = listing?.owned ?? [];
  const shared = listing?.shared ?? [];
  const summary = [
    { label: 'File terenkripsi', value: owned.length },
    { label: 'Sudah ditandatangani', value: owned.filter((file) => file.signature).length },
    { label: 'Saya bagikan', value: owned.filter((file) => file.sharedWith.length > 0).length },
    { label: 'Dibagikan ke saya', value: shared.length },
  ];

  return (
    <>
      <PageHeader
        title={`Halo, ${user?.username}`}
        description="File Anda dienkripsi AES-256-GCM sebelum disimpan, dan kunci AES-nya dibungkus dengan public key RSA Anda."
      />

      <UploadZone maxFileSize={parameters?.maxFileSize} onUploaded={reload} />

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="card px-4 py-3">
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-100">{listing ? item.value : '–'}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-100">File terbaru</h2>
            <Link to="/files" className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
              Semua file <ArrowRight className="size-3" />
            </Link>
          </div>
          {owned.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Belum ada file. Upload file pertama Anda di atas.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {owned.slice(0, 5).map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="size-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{file.originalName}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <Lock className="size-3.5 shrink-0 text-emerald-400" aria-label="Terenkripsi" />
                  {file.signature && <PenLine className="size-3.5 shrink-0 text-sky-400" aria-label="Ditandatangani" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-100">Kunci Anda</h2>
          </div>
          <div className="space-y-4 px-4 py-4">
            <KeySummary icon={<KeyRound className="size-4 text-emerald-400" />} title="Encryption key" usage="RSA-OAEP, membungkus kunci AES" fingerprint={user?.encKeyFingerprint} />
            <KeySummary icon={<Fingerprint className="size-4 text-sky-400" />} title="Signing key" usage="RSA-PSS, tanda tangan digital" fingerprint={user?.sigKeyFingerprint} />
          </div>
        </section>
      </div>
    </>
  );
}

function KeySummary({ icon, title, usage, fingerprint }: { icon: ReactNode; title: string; usage: string; fingerprint?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
        {icon}
        {title}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{usage}</p>
      <p className="hex mt-1.5">{fingerprint ? groupHex(fingerprint) : ''}</p>
    </div>
  );
}
