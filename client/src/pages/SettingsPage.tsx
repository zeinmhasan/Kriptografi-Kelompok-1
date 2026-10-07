import { LoaderCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useParameters } from '../hooks/useFiles';
import { useInspector } from '../hooks/useInspector';
import { useToast } from '../hooks/useToast';
import { formatBytes, formatDate, groupHex } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { PublicJwk, PublicKeys } from '../types';

export function SettingsPage() {
  const { user } = useAuth();
  const parameters = useParameters();
  const [keys, setKeys] = useState<PublicKeys | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .publicKeys(user.username)
      .then(setKeys)
      .catch(() => setKeys(null));
  }, [user]);

  if (!user) return null;

  return (
    <>
      <PageHeader title="Settings" description="Akun, kunci publik, parameter kriptografi server, dan penggantian password." />

      <div className="space-y-6">
        <Section title="Akun">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field label="Username" value={user.username} />
            <Field label="Email" value={user.email} />
            <Field label="Terdaftar" value={formatDate(user.createdAt)} />
          </dl>
        </Section>

        <Section
          title="Kunci publik"
          description="Dua key pair terpisah, supaya satu kunci tidak dipakai untuk dua tujuan. Private key tersimpan terenkripsi dan tidak pernah dikirim ke browser."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <KeyCard title="Encryption key" usage="RSA-OAEP: membungkus kunci AES file" bits={keys?.rsaBits} fingerprint={user.encKeyFingerprint} jwk={keys?.encPublicKey} />
            <KeyCard title="Signing key" usage="RSA-PSS: digital signature" bits={keys?.rsaBits} fingerprint={user.sigKeyFingerprint} jwk={keys?.sigPublicKey} />
          </div>
        </Section>

        <Section title="Parameter kriptografi server">
          {!parameters ? (
            <p className="text-sm text-slate-500">Memuat…</p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Enkripsi file" value={parameters.algorithms.fileEncryption} />
              <Field label="Pembungkus kunci" value={parameters.algorithms.keyWrapping} />
              <Field label="Digital signature" value={parameters.algorithms.signature} />
              <Field label="Hash" value={parameters.algorithms.hash} />
              <Field label="Penurunan kunci dari password" value={`${parameters.algorithms.passwordKdf}, ${parameters.pbkdf2Iterations.toLocaleString('id-ID')} iterasi`} />
              <Field label="Sesi login" value={parameters.algorithms.session} />
              <Field label="Modulus RSA" value={`${parameters.rsaBits} bit`} />
              <Field label="Batas ukuran file" value={formatBytes(parameters.maxFileSize)} />
            </dl>
          )}
        </Section>

        <Section
          title="Ganti password"
          description="Private key dibuka dengan password lama lalu dibungkus ulang dengan password baru. File tidak dienkripsi ulang karena key pair-nya tidak berubah."
        >
          <ChangePasswordForm />
        </Section>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="border-b border-slate-800 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-xs text-slate-400">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-slate-100">{value}</dd>
    </div>
  );
}

interface KeyCardProps {
  title: string;
  usage: string;
  bits?: number;
  fingerprint: string;
  jwk?: PublicJwk;
}

function KeyCard({ title, usage, bits, fingerprint, jwk }: KeyCardProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-medium text-slate-100">
        {title}
        {bits && <span className="ml-2 font-mono text-xs font-normal text-slate-400">RSA-{bits}</span>}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{usage}</p>

      <p className="mt-3 text-xs text-slate-500">Fingerprint (SHA-256 dari public key)</p>
      <p className="hex mt-0.5">{groupHex(fingerprint)}</p>

      {jwk && (
        <>
          <p className="mt-3 text-xs text-slate-500">Eksponen publik e (base64url)</p>
          <p className="hex mt-0.5">{jwk.e}</p>
          <p className="mt-3 text-xs text-slate-500">Modulus n (base64url)</p>
          <p className="hex mt-0.5 max-h-24 overflow-y-auto rounded border border-slate-800 p-2">{jwk.n}</p>
        </>
      )}
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inspector = useInspector();
  const toast = useToast();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { trace } = await api.changePassword(currentPassword, newPassword);
      inspector.record(trace, 'Akun');
      toast.success('Password diganti. Private key sudah dibungkus ulang dengan password baru.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="current-password" className="label">
          Password saat ini
        </label>
        <input id="current-password" type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor="new-password" className="label">
          Password baru
        </label>
        <input id="new-password" type="password" className="input" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={busy} />
        <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="label">
          Ulangi password baru
        </label>
        <input id="confirm-password" type="password" className="input" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || !currentPassword || newPassword.length < 8 || !confirmation}>
        {busy && <LoaderCircle className="size-4 animate-spin" />}
        {busy ? 'Membungkus ulang kunci…' : 'Ganti Password'}
      </button>
    </form>
  );
}
