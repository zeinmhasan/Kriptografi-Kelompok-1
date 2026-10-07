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
      toast.error(`"${file.name}" berukuran ${formatBytes(file.size)}, melebihi batas ${formatBytes(maxFileSize)}.`);
      return;
    }
    setUploading(file.name);
    try {
      const { file: stored, trace } = await api.upload(file);
      inspector.record(trace, stored.originalName);
      toast.success(`"${stored.originalName}" dienkripsi dan disimpan.`);
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

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
        dragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/40'
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
        <p className="flex items-center justify-center gap-2 text-sm text-slate-300">
          <LoaderCircle className="size-4 animate-spin text-emerald-400" />
          Mengenkripsi "{uploading}"…
        </p>
      ) : (
        <>
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Upload File
          </button>
          <p className="mt-3 text-sm text-slate-400">
            atau seret file ke sini. File dienkripsi AES-256-GCM sebelum disimpan
            {maxFileSize ? `, maksimal ${formatBytes(maxFileSize)}.` : '.'}
          </p>
        </>
      )}
    </div>
  );
}
