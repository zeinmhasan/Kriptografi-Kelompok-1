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

  // Hasil lama tidak berlaku untuk file yang baru dipilih, jadi ikut dihapus.
  function choose(setter: (file: File | null) => void) {
    return (chosen: File | null) => {
      setter(chosen);
      setResult(null);
      setError(null);
    };
  }

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
        description="Check the authenticity of a file from outside Crypta against its .sig file. Verification only uses the signer's public key, so no password is needed and the checked file is not stored."
      />

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FilePicker id="verify-file" label="File to check" hint="The original file, not the encrypted one" file={file} onChange={choose(setFile)} />
          <FilePicker
            id="verify-signature"
            label="Signature file (.sig)"
            hint="Exported from a file's actions in Crypta"
            accept=".sig,application/json"
            file={signature}
            onChange={choose(setSignature)}
          />
        </div>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !file || !signature}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck className="size-4" />}
          {busy ? 'Verifying…' : 'Verify Signature'}
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
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full cursor-pointer rounded-[10px] bg-well text-sm text-ink-soft shadow-sunk file:m-1 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink file:shadow-key focus-visible:outline-offset-0"
      />
      <p id={`${id}-hint`} className="hint truncate">
        {file ? `${file.name} · ${formatBytes(file.size)}` : hint}
      </p>
    </div>
  );
}
