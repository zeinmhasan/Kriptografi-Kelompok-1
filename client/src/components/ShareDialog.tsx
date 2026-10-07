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
      toast.success(`"${file.originalName}" dibagikan ke ${username.trim().toLowerCase()}.`);
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
    try {
      const { file: updated } = await api.revokeShare(file.id, userId);
      toast.success(`Akses ${recipient} dicabut.`);
      onChanged(updated);
    } catch (thrown) {
      toast.error(errorMessage(thrown));
    }
  }

  return (
    <Modal title={`Bagikan "${file.originalName}"`} onClose={busy ? () => {} : onClose} size="lg">
      <p className="text-sm text-slate-300">
        Kunci AES file dibuka dengan private key Anda, lalu dibungkus ulang dengan public key penerima. Isi file tidak
        dienkripsi ulang.
      </p>

      <form onSubmit={handleShare} className="mt-4 space-y-3">
        <div>
          <label htmlFor="share-username" className="label">
            Username penerima
          </label>
          <input
            id="share-username"
            className="input"
            autoFocus
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
          />
          {suggestions.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border border-slate-700 px-2 py-1 text-left text-xs hover:border-emerald-400"
                    onClick={() => setUsername(user.username)}
                  >
                    <span className="text-slate-100">{user.username}</span>
                    <span className="ml-2 font-mono text-slate-500">{shortFingerprint(user.encKeyFingerprint)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="share-password" className="label">
            Password akun Anda
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
          <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy || username.trim().length === 0 || password.length === 0}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? 'Membungkus kunci…' : 'Bagikan'}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <h3 className="text-sm font-medium text-slate-200">Yang punya akses</h3>
        {file.sharedWith.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum dibagikan ke siapa pun.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-800">
            {file.sharedWith.map((recipient) => (
              <li key={recipient.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{recipient.username}</p>
                  <p className="text-xs text-slate-500">sejak {formatDate(recipient.sharedAt)}</p>
                </div>
                <button type="button" className="btn btn-danger" onClick={() => void handleRevoke(recipient.id, recipient.username)}>
                  <UserMinus className="size-4" />
                  Cabut
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Mencabut akses menghapus wrapped key penerima. Salinan yang sudah diunduh penerima tidak bisa ditarik kembali.
        </p>
      </div>
    </Modal>
  );
}
