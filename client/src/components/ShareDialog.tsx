import { LoaderCircle, UserMinus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useInspector } from '../hooks/useInspector';
import { useToast } from '../hooks/useToast';
import { formatDate, shortFingerprint } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { FileItem, UserSummary } from '../types';
import { Modal } from './Modal';

interface ShareDialogProps {
  file: FileItem;
  onChanged: (file: FileItem) => void;
  onClose: () => void;
}

export function ShareDialog({ file, onChanged, onClose }: ShareDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspector = useInspector();
  const toast = useToast();

  // Saran username muncul sambil mengetik. Hasil dari ketikan lama diabaikan.
  useEffect(() => {
    const query = username.trim();
    if (query.length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchUsers(query)
        .then((data) => {
          if (!cancelled) setSuggestions(data.users.filter((user) => user.username !== query.toLowerCase()));
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  async function handleShare(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { file: updated, trace } = await api.share(file.id, username.trim(), password);
      inspector.record(trace, file.originalName);
      toast.success(`"${file.originalName}" shared with ${username.trim().toLowerCase()}.`);
      onChanged(updated);
      setUsername('');
      setPassword('');
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(userId: string, recipient: string) {
    if (revokingId) return;
    setRevokingId(userId);
    try {
      const { file: updated } = await api.revokeShare(file.id, userId);
      toast.success(`Access revoked for ${recipient}.`);
      onChanged(updated);
    } catch (thrown) {
      toast.error(errorMessage(thrown));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Modal title={`Share "${file.originalName}"`} onClose={onClose} busy={busy} size="lg">
      <p className="text-sm text-ink-soft">
        The file's AES key is unwrapped with your private key, then re-wrapped with the recipient's public key. The file
        contents are not re-encrypted.
      </p>

      <form onSubmit={handleShare} className="mt-4 space-y-4">
        <div>
          <label htmlFor="share-username" className="label">
            Recipient username
          </label>
          <input
            id="share-username"
            className="input"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
          />
          {suggestions.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Matching users">
              {suggestions.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="btn min-h-0 px-2.5 py-1 text-xs"
                    onClick={() => setUsername(user.username)}
                  >
                    <span className="text-ink">{user.username}</span>
                    <span className="ml-2 font-mono text-ink-muted">{shortFingerprint(user.encKeyFingerprint)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="share-password" className="label">
            Your account password
          </label>
          <input
            id="share-password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy || username.trim().length === 0 || password.length === 0}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? 'Wrapping key…' : 'Share'}
          </button>
        </div>
      </form>

      <div className="groove-t mt-6 pt-4">
        <h3 className="text-sm font-medium text-ink">People with access</h3>
        {file.sharedWith.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Not shared with anyone yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {file.sharedWith.map((recipient) => (
              <li key={recipient.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{recipient.username}</p>
                  <p className="text-xs text-ink-muted">since {formatDate(recipient.sharedAt)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={revokingId !== null}
                  onClick={() => void handleRevoke(recipient.id, recipient.username)}
                >
                  {revokingId === recipient.id ? <LoaderCircle className="size-4 animate-spin" /> : <UserMinus className="size-4" />}
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint mt-3">
          Revoking access deletes the recipient's wrapped key. Copies they have already downloaded cannot be recalled.
        </p>
      </div>
    </Modal>
  );
}
