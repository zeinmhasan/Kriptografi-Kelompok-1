import {
  ChevronDown,
  Download,
  FileDown,
  FileText,
  Lock,
  LockOpen,
  PenLine,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useInspector } from '../hooks/useInspector';
import { useToast } from '../hooks/useToast';
import { formatBytes, formatDate, groupHex, saveBlob } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { FileItem, TamperReport, VerificationResult } from '../types';
import { Modal } from './Modal';
import { PasswordDialog } from './PasswordDialog';
import { ShareDialog } from './ShareDialog';
import { TamperTable } from './TamperTable';
import { VerificationCard } from './VerificationCard';

type PasswordAction = 'decrypt' | 'sign' | 'verify' | 'tamper';

interface FileListProps {
  files: FileItem[];
  onChanged: () => void;
  emptyMessage: string;
}

export function FileList({ files, onChanged, emptyMessage }: FileListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [passwordAction, setPasswordAction] = useState<{ kind: PasswordAction; file: FileItem } | null>(null);
  const [sharing, setSharing] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [verification, setVerification] = useState<{ file: FileItem; result: VerificationResult } | null>(null);
  const [tamperReport, setTamperReport] = useState<TamperReport | null>(null);
  const inspector = useInspector();
  const toast = useToast();

  async function runPasswordAction(password: string) {
    if (!passwordAction) return;
    const { kind, file } = passwordAction;

    if (kind === 'decrypt') {
      const { blob, trace } = await api.decrypt(file.id, password);
      saveBlob(new Blob([blob], { type: file.mimeType }), file.originalName);
      inspector.record(trace, file.originalName);
      toast.success(`"${file.originalName}" didekripsi dan diunduh.`);
    } else if (kind === 'sign') {
      const { trace } = await api.sign(file.id, password);
      inspector.record(trace, file.originalName);
      toast.success(`"${file.originalName}" ditandatangani.`);
      onChanged();
    } else if (kind === 'verify') {
      const { result, trace } = await api.verify(file.id, password);
      inspector.record(trace, file.originalName);
      setVerification({ file, result });
    } else {
      const report = await api.tamperTest(file.id, password);
      inspector.record(report.trace, file.originalName);
      setTamperReport(report);
    }
  }

  async function download(file: FileItem, kind: 'encrypted' | 'signature') {
    try {
      if (kind === 'encrypted') saveBlob(await api.downloadEncrypted(file.id), `${file.originalName}.enc`);
      else saveBlob(await api.downloadSignature(file.id), `${file.originalName}.sig`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { removed } = await api.deleteFile(deleting.id);
      toast.success(removed === 'file' ? `"${deleting.originalName}" dihapus.` : `Akses ke "${deleting.originalName}" dilepas.`);
      setDeleting(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (files.length === 0) {
    return <p className="card px-6 py-10 text-center text-sm text-slate-400">{emptyMessage}</p>;
  }

  const sharingFile = sharing ? (files.find((file) => file.id === sharing.id) ?? sharing) : null;

  return (
    <>
      <ul className="space-y-2">
        {files.map((file) => {
          const expanded = expandedId === file.id;
          return (
            <li key={file.id} className="card overflow-hidden">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : file.id)}
              >
                <FileText className="size-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{file.originalName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    {!file.isOwner && ` · milik ${file.owner.username}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                    <Badges file={file} />
                  </div>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  <Badges file={file} />
                </div>
                <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="border-t border-slate-800 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton primary icon={<LockOpen className="size-4" />} onClick={() => setPasswordAction({ kind: 'decrypt', file })}>
                      Dekripsi &amp; Unduh
                    </ActionButton>
                    <ActionButton icon={<Download className="size-4" />} onClick={() => void download(file, 'encrypted')}>
                      Unduh .enc
                    </ActionButton>
                    {file.isOwner && (
                      <ActionButton icon={<PenLine className="size-4" />} onClick={() => setPasswordAction({ kind: 'sign', file })}>
                        {file.signature ? 'Tanda Tangani Ulang' : 'Tanda Tangani'}
                      </ActionButton>
                    )}
                    {file.signature && (
                      <>
                        <ActionButton icon={<ShieldCheck className="size-4" />} onClick={() => setPasswordAction({ kind: 'verify', file })}>
                          Verifikasi
                        </ActionButton>
                        <ActionButton icon={<FileDown className="size-4" />} onClick={() => void download(file, 'signature')}>
                          Ekspor .sig
                        </ActionButton>
                      </>
                    )}
                    {file.isOwner && (
                      <ActionButton icon={<Share2 className="size-4" />} onClick={() => setSharing(file)}>
                        Bagikan
                      </ActionButton>
                    )}
                    <ActionButton icon={<Zap className="size-4" />} onClick={() => setPasswordAction({ kind: 'tamper', file })}>
                      Uji Tamper
                    </ActionButton>
                    <button type="button" className="btn btn-danger" onClick={() => setDeleting(file)}>
                      <Trash2 className="size-4" />
                      {file.isOwner ? 'Hapus' : 'Lepas Akses'}
                    </button>
                  </div>

                  <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Detail label="Enkripsi isi file" value={file.encryption.algorithm} />
                    <Detail label="Pembungkus kunci AES" value={file.encryption.keyAlgorithm} />
                    <Detail label="IV (96 bit)" value={file.encryption.iv} hex />
                    <Detail label="Auth tag (128 bit)" value={file.encryption.authTag} hex />
                    <Detail label="SHA-256 isi file asli" value={groupHex(file.plaintextHash, 8)} hex wide />
                    <Detail label="Nama di storage" value={file.encryption.storedName} hex wide />
                    {file.signature && (
                      <>
                        <Detail label="Ditandatangani oleh" value={`${file.signature.signer} · ${formatDate(file.signature.signedAt)}`} />
                        <Detail label="Algoritma signature" value={file.signature.algorithm} />
                        <Detail label="Fingerprint signing key" value={groupHex(file.signature.keyFingerprint)} hex wide />
                      </>
                    )}
                    {file.sharedWith.length > 0 && (
                      <Detail label="Dibagikan ke" value={file.sharedWith.map((recipient) => recipient.username).join(', ')} wide />
                    )}
                  </dl>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {passwordAction && (
        <PasswordDialog
          key={`${passwordAction.kind}-${passwordAction.file.id}`}
          {...PASSWORD_DIALOG[passwordAction.kind]}
          title={`${PASSWORD_DIALOG[passwordAction.kind].title} "${passwordAction.file.originalName}"`}
          onSubmit={runPasswordAction}
          onClose={() => setPasswordAction(null)}
        />
      )}

      {sharingFile && <ShareDialog file={sharingFile} onChanged={onChanged} onClose={() => setSharing(null)} />}

      {deleting && (
        <Modal title={deleting.isOwner ? 'Hapus file' : 'Lepas akses'} onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-300">
            {deleting.isOwner
              ? `File terenkripsi "${deleting.originalName}" dan seluruh kuncinya akan dihapus permanen, termasuk untuk penerima share.`
              : `"${deleting.originalName}" akan hilang dari daftar Anda. File tetap ada untuk pemiliknya.`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()}>
              <Trash2 className="size-4" />
              {deleting.isOwner ? 'Hapus Permanen' : 'Lepas Akses'}
            </button>
          </div>
        </Modal>
      )}

      {verification && (
        <Modal title={`Verifikasi "${verification.file.originalName}"`} onClose={() => setVerification(null)} size="lg">
          <VerificationCard result={verification.result} />
        </Modal>
      )}

      {tamperReport && (
        <Modal title={`Simulasi tamper "${tamperReport.fileName}"`} onClose={() => setTamperReport(null)} size="xl">
          <TamperTable experiments={tamperReport.experiments} />
        </Modal>
      )}
    </>
  );
}

const PASSWORD_DIALOG: Record<PasswordAction, { title: string; description: string; confirmLabel: string; busyLabel: string }> = {
  decrypt: {
    title: 'Dekripsi',
    description:
      'Private encryption key Anda dibuka, dipakai untuk membuka kunci AES file dengan RSA-OAEP, lalu isi file didekripsi dengan AES-256-GCM.',
    confirmLabel: 'Dekripsi & Unduh',
    busyLabel: 'Mendekripsi…',
  },
  sign: {
    title: 'Tanda tangani',
    description:
      'File didekripsi, di-hash dengan SHA-256, lalu hash-nya ditandatangani dengan private signing key Anda memakai RSA-PSS.',
    confirmLabel: 'Tanda Tangani',
    busyLabel: 'Menandatangani…',
  },
  verify: {
    title: 'Verifikasi',
    description:
      'File didekripsi dan di-hash ulang, lalu signature diperiksa dengan public key penanda tangan. Password hanya dibutuhkan untuk mendekripsi file.',
    confirmLabel: 'Verifikasi',
    busyLabel: 'Memverifikasi…',
  },
  tamper: {
    title: 'Uji tamper',
    description:
      'Satu bit pada ciphertext, tag, IV, kunci terbungkus, dan signature diubah bergantian pada salinan di memori untuk menunjukkan bahwa setiap perubahan terdeteksi.',
    confirmLabel: 'Jalankan Simulasi',
    busyLabel: 'Menjalankan…',
  },
};

function Badges({ file }: { file: FileItem }) {
  return (
    <>
      <span className="badge bg-emerald-500/15 text-emerald-300">
        <Lock className="size-3" />
        Encrypted
      </span>
      {file.signature && (
        <span className="badge bg-sky-500/15 text-sky-300">
          <PenLine className="size-3" />
          Signed
        </span>
      )}
      {file.sharedWith.length > 0 && (
        <span className="badge bg-violet-500/15 text-violet-300">
          <Users className="size-3" />
          Shared {file.sharedWith.length}
        </span>
      )}
    </>
  );
}

function ActionButton({ icon, children, onClick, primary }: { icon: ReactNode; children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function Detail({ label, value, hex, wide }: { label: string; value: string; hex?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={hex ? 'hex mt-0.5' : 'mt-0.5 text-sm break-words text-slate-200'}>{value}</dd>
    </div>
  );
}
