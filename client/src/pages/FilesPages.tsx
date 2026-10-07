import { LoaderCircle } from 'lucide-react';
import { FileList } from '../components/FileList';
import { PageHeader } from '../components/Layout';
import { UploadZone } from '../components/UploadZone';
import { useFiles, useParameters } from '../hooks/useFiles';

function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <div role="alert" className="alert alert-error items-center justify-between">
        <span>{error}</span>
        <button type="button" className="btn" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <p className="card flex items-center justify-center gap-2 px-6 py-10 text-sm text-ink-muted">
        <LoaderCircle className="size-4 animate-spin" />
        Loading files…
      </p>
    );
  }
  return null;
}

export function MyFilesPage() {
  const { listing, error, reload } = useFiles();
  const parameters = useParameters();

  return (
    <>
      <PageHeader title="My Files" description="Select a file to see its cryptographic metadata and the actions available." />
      <UploadZone maxFileSize={parameters?.maxFileSize} onUploaded={reload} />
      <div className="mt-6">
        <LoadState loading={!listing} error={error} onRetry={reload} />
        {listing && !error && (
          <FileList files={listing.owned} onChanged={reload} emptyMessage="No files yet. Upload a file to encrypt and store it." />
        )}
      </div>
    </>
  );
}

export function SharedPage() {
  const { listing, error, reload } = useFiles();

  return (
    <>
      <PageHeader
        title="Shared"
        description="Files owned by other users whose AES key is wrapped with your public key. You can decrypt them and verify their signatures with your own keys."
      />
      <LoadState loading={!listing} error={error} onRetry={reload} />
      {listing && !error && <FileList files={listing.shared} onChanged={reload} emptyMessage="No files have been shared with you yet." />}
    </>
  );
}
