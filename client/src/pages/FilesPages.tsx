import { FileList } from '../components/FileList';
import { PageHeader } from '../components/Layout';
import { UploadZone } from '../components/UploadZone';
import { useFiles, useParameters } from '../hooks/useFiles';

function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <p className="card px-6 py-8 text-center text-sm text-rose-300">{error}</p>;
  if (loading) return <p className="card px-6 py-8 text-center text-sm text-slate-500">Memuat daftar file…</p>;
  return null;
}

export function MyFilesPage() {
  const { listing, error, reload } = useFiles();
  const parameters = useParameters();

  return (
    <>
      <PageHeader
        title="My Files"
        description="Klik sebuah file untuk melihat metadata kriptografinya dan aksi yang tersedia."
      />
      <UploadZone maxFileSize={parameters?.maxFileSize} onUploaded={reload} />
      <div className="mt-6">
        <LoadState loading={!listing} error={error} />
        {listing && !error && (
          <FileList files={listing.owned} onChanged={reload} emptyMessage="Belum ada file. Upload file untuk mengenkripsi dan menyimpannya." />
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
        description="File milik user lain yang kunci AES-nya dibungkus dengan public key Anda. Anda bisa mendekripsi dan memverifikasi signature-nya dengan kunci Anda sendiri."
      />
      <LoadState loading={!listing} error={error} />
      {listing && !error && (
        <FileList files={listing.shared} onChanged={reload} emptyMessage="Belum ada file yang dibagikan kepada Anda." />
      )}
    </>
  );
}
