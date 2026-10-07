import { LoaderCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useParameters } from '../hooks/useFiles';
import { useInspector } from '../hooks/useInspector';
import { useToast } from '../hooks/useToast';
import { formatBytes, formatDate, formatNumber, groupHex } from '../lib/format';
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
      <PageHeader title="Settings" description="Your account, public keys, the server's cryptographic parameters, and password change." />

      <div className="space-y-6">
        <Section title="Account">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field label="Username" value={user.username} />
            <Field label="Email" value={user.email} />
            <Field label="Registered" value={formatDate(user.createdAt)} />
          </dl>
        </Section>

        <Section
          title="Public keys"
          description="Two separate key pairs, so that one key is never used for two purposes. Private keys are stored encrypted and are never sent to the browser."
        >
          <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <KeyDetails title="Encryption key" usage="RSA-OAEP: wraps file AES keys" bits={keys?.rsaBits} fingerprint={user.encKeyFingerprint} jwk={keys?.encPublicKey} />
            <KeyDetails title="Signing key" usage="RSA-PSS: digital signatures" bits={keys?.rsaBits} fingerprint={user.sigKeyFingerprint} jwk={keys?.sigPublicKey} />
          </div>
        </Section>

        <Section title="Server cryptographic parameters">
          {!parameters ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Loading…
            </p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="File encryption" value={parameters.algorithms.fileEncryption} />
              <Field label="Key wrapping" value={parameters.algorithms.keyWrapping} />
              <Field label="Digital signature" value={parameters.algorithms.signature} />
              <Field label="Hash" value={parameters.algorithms.hash} />
              <Field label="Password key derivation" value={`${parameters.algorithms.passwordKdf}, ${formatNumber(parameters.pbkdf2Iterations)} iterations`} />
              <Field label="Login session" value={parameters.algorithms.session} />
              <Field label="RSA modulus" value={`${parameters.rsaBits} bits`} />
              <Field label="File size limit" value={formatBytes(parameters.maxFileSize)} />
            </dl>
          )}
        </Section>

        <Section
          title="Change password"
          description="Your private keys are unlocked with the old password, then re-wrapped with the new one. Files are not re-encrypted because the key pairs do not change."
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
      <div className="groove-b px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-[68ch] text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="term">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{value}</dd>
    </div>
  );
}

interface KeyDetailsProps {
  title: string;
  usage: string;
  bits?: number;
  fingerprint: string;
  jwk?: PublicJwk;
}

function KeyDetails({ title, usage, bits, fingerprint, jwk }: KeyDetailsProps) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-ink">
        {title}
        {bits && <span className="ml-2 font-mono text-xs font-normal text-ink-muted">RSA-{bits}</span>}
      </h3>
      <p className="mt-0.5 text-xs text-ink-muted">{usage}</p>

      <dl className="mt-3 space-y-3">
        <div>
          <dt className="term">Fingerprint (SHA-256 of the public key)</dt>
          <dd className="hex mt-0.5">{groupHex(fingerprint)}</dd>
        </div>
        {jwk && (
          <>
            <div>
              <dt className="term">Public exponent e (base64url)</dt>
              <dd className="hex mt-0.5">{jwk.e}</dd>
            </div>
            <div>
              <dt className="term">Modulus n (base64url)</dt>
              <dd className="hex well mt-1 max-h-24 overflow-y-auto rounded-lg p-2.5" tabIndex={0}>
                {jwk.n}
              </dd>
            </div>
          </>
        )}
      </dl>
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
      setError('The new password and its confirmation do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { trace } = await api.changePassword(currentPassword, newPassword);
      inspector.record(trace, 'Account');
      toast.success('Password changed. Your private keys are now wrapped with the new password.');
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
          Current password
        </label>
        <input id="current-password" type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor="new-password" className="label">
          New password
        </label>
        <input id="new-password" type="password" className="input" autoComplete="new-password" aria-describedby="new-password-hint" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={busy} />
        <p id="new-password-hint" className="hint">
          At least 8 characters.
        </p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="label">
          Repeat new password
        </label>
        <input id="confirm-password" type="password" className="input" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
      </div>
      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || !currentPassword || newPassword.length < 8 || !confirmation}>
        {busy && <LoaderCircle className="size-4 animate-spin" />}
        {busy ? 'Re-wrapping keys…' : 'Change Password'}
      </button>
    </form>
  );
}
