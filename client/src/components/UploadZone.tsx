import { LoaderCircle, Upload } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { useInspector } from '../hooks/useInspector';
import { useToast } from '../hooks/useToast';
import { formatBytes } from '../lib/format';
import { api, errorMessage } from '../services/api';

interface UploadZoneProps {
  maxFileSize?: number;
  onUploaded: () => void;
}

export function UploadZone({ maxFileSize, onUploaded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inspector = useInspector();
  const toast = useToast();

  async function upload(file: File) {
    if (maxFileSize && file.size > maxFileSize) {
      toast.error(`"${file.name}" is ${formatBytes(file.size)}, over the ${formatBytes(maxFileSize)} limit.`);
      return;
    }
    setUploading(file.name);
    try {
      const { file: stored, trace } = await api.upload(file);
      inspector.record(trace, stored.originalName);
      toast.success(`"${stored.originalName}" encrypted and stored.`);
      onUploaded();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(null);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !uploading) void upload(file);
  }

  // Baki cekung: tempat file dijatuhkan. Satu-satunya tuts di dalamnya adalah tombol unggah.
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // dragleave juga terpicu saat kursor masuk ke elemen anak; itu belum keluar dari zona.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
      aria-live="polite"
      className={`flex min-h-36 flex-col items-center justify-center rounded-2xl bg-well px-6 py-7 text-center shadow-sunk-deep ${
        dragging ? 'outline-2 -outline-offset-8 outline-stamp outline-dashed' : ''
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />
      {uploading ? (
        <p className="flex max-w-full items-center gap-2 text-sm text-ink-soft">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-stamp" />
          <span className="truncate">Encrypting "{uploading}"…</span>
        </p>
      ) : (
        <>
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Upload File
          </button>
          <p className="mt-3 text-sm text-ink-muted">
            or drag a file here. Files are encrypted with AES-256-GCM before they are stored
            {maxFileSize ? `, up to ${formatBytes(maxFileSize)}.` : '.'}
          </p>
        </>
      )}
    </div>
  );
}
