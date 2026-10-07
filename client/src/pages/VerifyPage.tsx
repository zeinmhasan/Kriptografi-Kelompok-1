import { FileCheck, LoaderCircle } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { VerificationCard } from '../components/VerificationCard';
import { useInspector } from '../hooks/useInspector';
import { formatBytes } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { VerificationResult } from '../types';

export function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const inspector = useInspector();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !signature) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.verifyExternal(file, signature);
      inspector.record(data.trace, file.name);
      setResult(data.result);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Verify"
        description="Periksa keaslian file dari luar Crypta dengan file .sig-nya. Verifikasi hanya memakai public key penanda tangan, jadi tidak butuh password, dan file yang diperiksa tidak disimpan."
      />

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FilePicker id="verify-file" label="File yang diperiksa" hint="File asli, bukan yang terenkripsi" file={file} onChange={setFile} />
          <FilePicker id="verify-signature" label="File signature (.sig)" hint="Diekspor dari menu file di Crypta" accept=".sig,application/json" file={signature} onChange={setSignature} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !file || !signature}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck className="size-4" />}
          {busy ? 'Memverifikasi…' : 'Verify Signature'}
        </button>
      </form>

      {result && (
        <div className="mt-6">
          <VerificationCard result={result} />
        </div>
      )}
    </>
  );
}

interface FilePickerProps {
  id: string;
  label: string;
  hint: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FilePicker({ id, label, hint, accept, file, onChange }: FilePickerProps) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-300 file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-200 hover:file:bg-slate-700"
      />
      <p className="mt-1 text-xs text-slate-500">{file ? `${file.name} · ${formatBytes(file.size)}` : hint}</p>
    </div>
  );
}
