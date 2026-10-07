import { KeyRound, LoaderCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Setelah gagal, kolom password aktif lagi dan isinya terpilih, siap diketik ulang.
  useEffect(() => {
    if (!error) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [error]);

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
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-ink-soft">{description}</div>

        <div>
          <label htmlFor="operation-password" className="label">
            Account password
          </label>
          <input
            ref={inputRef}
            id="operation-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="input"
            aria-describedby="operation-password-hint"
            aria-invalid={error ? true : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <p id="operation-password-hint" className="hint flex items-start gap-1.5">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            Your password is used to derive the KEK that unlocks your private key. The server does not store it.
          </p>
        </div>

        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || password.length === 0}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? (busyLabel ?? 'Working…') : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
