import {
  ChevronDown,
  Download,
  FileDown,
  FileText,
  LoaderCircle,
  Lock,
  LockOpen,
  PenLine,
  Share2,
  ShieldCheck,
  Stamp,
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
import { Seal } from './Seal';
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
  const [deleteBusy, setDeleteBusy] = useState(false);
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
      toast.success(`"${file.originalName}" decrypted and downloaded.`);
    } else if (kind === 'sign') {
      const { trace } = await api.sign(file.id, password);
      inspector.record(trace, file.originalName);
      toast.success(`"${file.originalName}" signed.`);
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
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const { removed } = await api.deleteFile(deleting.id);
      toast.success(removed === 'file' ? `"${deleting.originalName}" deleted.` : `Access to "${deleting.originalName}" removed.`);
      setDeleting(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (files.length === 0) {
    return <p className="well px-6 py-10 text-center text-sm text-ink-muted">{emptyMessage}</p>;
  }

  const sharingFile = sharing ? (files.find((file) => file.id === sharing.id) ?? sharing) : null;

  return (
    <>
      <ul className="space-y-2">
        {files.map((file) => {
          const expanded = expandedId === file.id;
          const detailsId = `file-details-${file.id}`;
          return (
            <li key={file.id} className="card overflow-hidden">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-well/60 focus-visible:-outline-offset-2"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => setExpandedId(expanded ? null : file.id)}
              >
                <FileText className="size-5 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{file.originalName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    {!file.isOwner && ` · owned by ${file.owner.username}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                    <Badges file={file} />
                  </div>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  <Badges file={file} />
                </div>
                <ChevronDown className={`size-4 shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div id={detailsId} className="groove-t px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton primary icon={<LockOpen className="size-4" />} onClick={() => setPasswordAction({ kind: 'decrypt', file })}>
                      Decrypt &amp; Download
                    </ActionButton>
                    <ActionButton icon={<Download className="size-4" />} onClick={() => void download(file, 'encrypted')}>
                      Download .enc
                    </ActionButton>
                    {file.isOwner && (
                      <ActionButton icon={<PenLine className="size-4" />} onClick={() => setPasswordAction({ kind: 'sign', file })}>
                        {file.signature ? 'Re-sign' : 'Sign'}
                      </ActionButton>
                    )}
                    {file.signature && (
                      <>
                        <ActionButton icon={<ShieldCheck className="size-4" />} onClick={() => setPasswordAction({ kind: 'verify', file })}>
                          Verify
                        </ActionButton>
                        <ActionButton icon={<FileDown className="size-4" />} onClick={() => void download(file, 'signature')}>
                          Export .sig
                        </ActionButton>
                      </>
                    )}
                    {file.isOwner && (
                      <ActionButton icon={<Share2 className="size-4" />} onClick={() => setSharing(file)}>
                        Share
                      </ActionButton>
                    )}
                    <ActionButton icon={<Zap className="size-4" />} onClick={() => setPasswordAction({ kind: 'tamper', file })}>
                      Tamper Test
                    </ActionButton>
                    {/* Aksi yang merusak dipisah ke ujung kanan, jauh dari aksi sehari-hari. */}
                    <button type="button" className="btn btn-danger max-sm:mt-4 sm:ml-auto" onClick={() => setDeleting(file)}>
                      <Trash2 className="size-4" />
                      {file.isOwner ? 'Delete' : 'Remove Access'}
                    </button>
                  </div>

                  <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
                  <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Detail label="File content encryption" value={file.encryption.algorithm} />
                    <Detail label="AES key wrapping" value={file.encryption.keyAlgorithm} />
                    <Detail label="IV (96 bits)" value={file.encryption.iv} hex />
                    <Detail label="Auth tag (128 bits)" value={file.encryption.authTag} hex />
                    <Detail label="SHA-256 of the original file" value={groupHex(file.plaintextHash, 8)} hex wide />
                    <Detail label="Name in storage" value={file.encryption.storedName} hex wide />
                    {file.signature && (
                      <>
                        <Detail label="Signed by" value={`${file.signature.signer} · ${formatDate(file.signature.signedAt)}`} />
                        <Detail label="Signature algorithm" value={file.signature.algorithm} />
                        <Detail label="Signing key fingerprint" value={groupHex(file.signature.keyFingerprint)} hex wide />
                      </>
                    )}
                    {file.sharedWith.length > 0 && (
                      <Detail label="Shared with" value={file.sharedWith.map((recipient) => recipient.username).join(', ')} wide />
                    )}
                  </dl>
                  {/* File bertanda tangan membawa cap timbul penanda tangannya. */}
                  {file.signature && (
                    <Seal
                      signer={file.signature.signer}
                      keyFingerprint={file.signature.keyFingerprint}
                      signedAt={file.signature.signedAt}
                      state="embossed"
                      className="size-32 self-center sm:size-36 sm:self-start"
                    />
                  )}
                  </div>
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
        <Modal title={deleting.isOwner ? 'Delete file' : 'Remove access'} onClose={() => setDeleting(null)} busy={deleteBusy}>
          <p className="text-sm text-ink-soft">
            {deleting.isOwner
              ? `The encrypted file "${deleting.originalName}" and all of its keys will be permanently deleted, including for everyone it is shared with.`
              : `"${deleting.originalName}" will disappear from your list. The file stays available to its owner.`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()} disabled={deleteBusy}>
              {deleteBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting.isOwner ? 'Delete Permanently' : 'Remove Access'}
            </button>
          </div>
        </Modal>
      )}

      {verification && (
        <Modal title={`Verification of "${verification.file.originalName}"`} onClose={() => setVerification(null)} size="lg">
          <VerificationCard result={verification.result} />
        </Modal>
      )}

      {tamperReport && (
        <Modal title={`Tamper simulation for "${tamperReport.fileName}"`} onClose={() => setTamperReport(null)} size="xl">
          <TamperTable experiments={tamperReport.experiments} />
        </Modal>
      )}
    </>
  );
}

const PASSWORD_DIALOG: Record<PasswordAction, { title: string; description: string; confirmLabel: string; busyLabel: string }> = {
  decrypt: {
    title: 'Decrypt',
    description:
      "Your private encryption key is unlocked and used to unwrap the file's AES key with RSA-OAEP, then the file contents are decrypted with AES-256-GCM.",
    confirmLabel: 'Decrypt & Download',
    busyLabel: 'Decrypting…',
  },
  sign: {
    title: 'Sign',
    description: 'The file is decrypted and hashed with SHA-256, then the hash is signed with your private signing key using RSA-PSS.',
    confirmLabel: 'Sign',
    busyLabel: 'Signing…',
  },
  verify: {
    title: 'Verify',
    description:
      "The file is decrypted and hashed again, then the signature is checked against the signer's public key. Your password is only needed to decrypt the file.",
    confirmLabel: 'Verify',
    busyLabel: 'Verifying…',
  },
  tamper: {
    title: 'Tamper test',
    description:
      'One bit of the ciphertext, tag, IV, wrapped key, and signature is flipped in turn on an in-memory copy, to show that every change is detected.',
    confirmLabel: 'Run Simulation',
    busyLabel: 'Running…',
  },
};

function Badges({ file }: { file: FileItem }) {
  return (
    <>
      <span className="badge text-seal">
        <Lock className="size-3" />
        Encrypted
      </span>
      {file.signature && (
        <span className="badge text-stamp">
          <Stamp className="size-3" />
          Signed
        </span>
      )}
      {file.sharedWith.length > 0 && (
        <span className="badge text-share">
          <Users className="size-3" />
          Shared {file.sharedWith.length}
        </span>
      )}
    </>
  );
}

function ActionButton({ icon, children, onClick, primary }: { icon: ReactNode; children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn'} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function Detail({ label, value, hex, wide }: { label: string; value: string; hex?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="term">{label}</dt>
      <dd className={hex ? 'hex mt-0.5' : 'mt-0.5 text-sm break-words text-ink'}>{value}</dd>
    </div>
  );
}
