import { KeyRound, LoaderCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { errorMessage } from '../services/api';
import { Modal } from './Modal';

interface PasswordDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  // Menjalankan operasi dengan password. Jika melempar error, dialog tetap terbuka
  // dan menampilkan pesannya, sehingga user bisa mencoba lagi.
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}

export function PasswordDialog({ title, description, confirmLabel, busyLabel, onSubmit, onClose }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || password.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      onClose();
    } catch (thrown) {
      setError(errorMessage(thrown));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-slate-300">{description}</div>

        <div>
          <label htmlFor="operation-password" className="label">
            Password akun
          </label>
          <input
            id="operation-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            Password dipakai untuk menurunkan KEK yang membuka private key Anda. Server tidak menyimpannya.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || password.length === 0}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? (busyLabel ?? 'Memproses…') : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
