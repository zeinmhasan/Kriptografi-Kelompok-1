import { Activity, CircleCheck, CircleX, Gauge, ListChecks, LoaderCircle, Zap } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { PasswordDialog } from '../components/PasswordDialog';
import { TamperTable } from '../components/TamperTable';
import { TraceView } from '../components/TraceView';
import { useFiles } from '../hooks/useFiles';
import { useInspector } from '../hooks/useInspector';
import { formatMs, formatNumber, formatTime } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { BenchmarkReport, SelfTestReport, TamperReport } from '../types';

const TABS = [
  { id: 'inspector', label: 'Inspector', icon: Activity, Panel: InspectorTab },
  { id: 'tamper', label: 'Tamper Simulation', icon: Zap, Panel: TamperTab },
  { id: 'selftest', label: 'Self-Test', icon: ListChecks, Panel: SelfTestTab },
  { id: 'benchmark', label: 'Benchmark', icon: Gauge, Panel: BenchmarkTab },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CryptoLabPage() {
  const [tab, setTab] = useState<TabId>('inspector');

  // Di layar sempit deretan tab bergulir ke samping; tab yang aktif selalu dibawa ke area terlihat.
  useEffect(() => {
    document.getElementById(`lab-tab-${tab}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  // Panah kiri/kanan, Home, dan End berpindah tab, sesuai pola tab pada umumnya.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex(({ id }) => id === tab);
    const target =
      event.key === 'ArrowRight'
        ? (current + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (current - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : -1;
    if (target < 0) return;
    event.preventDefault();
    setTab(TABS[target].id);
    document.getElementById(`lab-tab-${TABS[target].id}`)?.focus();
  }

  return (
    <>
      <PageHeader
        title="Crypto Lab"
        description="Every algorithm in Crypta is written from scratch. This page shows how they work and proves they are correct."
      />

      <div role="tablist" aria-label="Crypto Lab tools" className="segmented mb-6 w-fit max-w-full" onKeyDown={handleKeyDown}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`lab-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`lab-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className="segment"
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Semua panel tetap terpasang, sehingga hasil Self-Test dan Benchmark tidak hilang saat berpindah tab. */}
      {TABS.map(({ id, Panel }) => (
        <div key={id} id={`lab-panel-${id}`} role="tabpanel" aria-labelledby={`lab-tab-${id}`} hidden={tab !== id}>
          <Panel />
        </div>
      ))}
    </>
  );
}

function Intro({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-[68ch] text-sm text-ink-muted">{children}</p>;
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="alert alert-error mt-4">
      {message}
    </p>
  );
}

function InspectorTab() {
  const { records, selectedId, select } = useInspector();
  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <>
      <Intro>
        Every cryptographic operation records its steps: the algorithm used, intermediate values such as the IV, auth tag, and
        hash, and how long each step took. The AES key and private keys are never recorded.
      </Intro>
      {!selected ? (
        <p className="card px-6 py-10 text-center text-sm text-ink-muted">
          No operations in this session yet. Upload, decrypt, sign, or share a file, then come back here.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <ul className="well max-h-[32rem] space-y-1 overflow-y-auto p-1.5 lg:col-span-1">
            {records.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => select(record.id)}
                  aria-current={record.id === selected.id ? 'true' : undefined}
                  className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-[box-shadow] duration-150 focus-visible:-outline-offset-2 ${record.id === selected.id ? 'bg-well shadow-sunk' : ''}`}
                >
                  <p className={`text-sm ${record.id === selected.id ? 'font-medium text-stamp' : 'text-ink'}`}>
                    {record.trace.operation}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    <span className="tabular-nums">{formatTime(record.at)}</span>
                    {record.subject && ` · ${record.subject}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className="card p-4 lg:col-span-2">
            <TraceView key={selected.id} trace={selected.trace} />
          </div>
        </div>
      )}
    </>
  );
}

function TamperTab() {
  const { listing, error: listError } = useFiles();
  const [fileId, setFileId] = useState('');
  const [asking, setAsking] = useState(false);
  const [report, setReport] = useState<TamperReport | null>(null);
  const inspector = useInspector();

  const files = listing ? [...listing.owned, ...listing.shared] : [];
  const selectedId = fileId || files[0]?.id || '';

  return (
    <>
      <Intro>
        The server flips one random bit in the ciphertext, auth tag, IV, wrapped AES key, file contents, and signature in turn,
        then tries to process the result. Each experiment runs on an in-memory copy, so the original file stays intact.
      </Intro>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="tamper-file" className="label">
            File to test
          </label>
          <select
            id="tamper-file"
            className="input"
            aria-describedby="tamper-file-hint"
            value={selectedId}
            onChange={(event) => setFileId(event.target.value)}
            disabled={files.length === 0}
          >
            {files.length === 0 && <option value="">{listing ? 'No files yet' : 'Loading files…'}</option>}
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.originalName}
                {file.signature ? ' (signed)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={() => setAsking(true)}>
          <Zap className="size-4" />
          Run Simulation
        </button>
      </div>
      <p id="tamper-file-hint" className="hint mt-2">
        A signed file adds three experiments against its RSA-PSS signature.
      </p>
      <ErrorNote message={listError} />

      {report && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">Results for "{report.fileName}"</h2>
          <TamperTable experiments={report.experiments} />
        </div>
      )}

      {asking && (
        <PasswordDialog
          title="Tamper simulation"
          description="Your password is needed to unlock the private key that unwraps this file's AES key."
          confirmLabel="Run Simulation"
          busyLabel="Running…"
          onSubmit={async (password) => {
            const result = await api.tamperTest(selectedId, password);
            inspector.record(result.trace, result.fileName);
            setReport(result);
          }}
          onClose={() => setAsking(false)}
        />
      )}
    </>
  );
}

function SelfTestTab() {
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setReport(await api.selfTest());
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  const algorithms = report ? [...new Set(report.results.map((result) => result.algorithm))] : [];
  const allPassed = report !== null && report.passed === report.total;

  return (
    <>
      <Intro>
        Known-answer tests: each algorithm runs on inputs from its official standard (FIPS, NIST, RFC) and its output is compared
        with the answer published there. RSA-OAEP and RSA-PSS use random values, so they are tested for pairwise consistency on
        a freshly generated key.
      </Intro>

      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
        {busy ? 'Running…' : 'Run Self-Test'}
      </button>
      <ErrorNote message={error} />

      {report && (
        <div className="mt-6 space-y-4">
          <p className={`flex items-center gap-2 text-sm font-medium ${allPassed ? 'text-seal' : 'text-alert'}`} role="status">
            {allPassed ? <CircleCheck className="size-4 shrink-0" /> : <CircleX className="size-4 shrink-0" />}
            {report.passed} of {report.total} tests passed.
          </p>
          {algorithms.map((algorithm) => {
            const results = report.results.filter((result) => result.algorithm === algorithm);
            return (
              <section key={algorithm} className="card overflow-hidden">
                <h2 className="flex items-center justify-between gap-3 groove-b px-4 py-2.5 text-sm font-semibold text-ink">
                  <span className="font-mono">{algorithm}</span>
                  <span className="text-xs font-normal text-ink-muted tabular-nums">
                    {results.filter((result) => result.passed).length}/{results.length} passed
                  </span>
                </h2>
                <ul className="divide-y divide-line">
                  {results.map((result, index) => (
                    <li key={index} className="flex items-start gap-3 px-4 py-2.5">
                      {result.passed ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-seal" role="img" aria-label="Passed" />
                      ) : (
                        <CircleX className="mt-0.5 size-4 shrink-0 text-alert" role="img" aria-label="Failed" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{result.name}</p>
                        <p className="text-xs text-ink-muted">{result.source}</p>
                        {result.error && <p className="text-xs text-alert">{result.error}</p>}
                      </div>
                      <span className="font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums">{formatMs(result.ms)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function BenchmarkTab() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setReport(await api.benchmark());
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Intro>
        Measures the speed of the hand-written implementation on this machine. These numbers are the basis for the file size
        limit and the PBKDF2 iteration count, and they show why hybrid encryption is used.
      </Intro>

      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Gauge className="size-4" />}
        {busy ? 'Measuring…' : 'Run Benchmark'}
      </button>
      <p className="hint mt-2 empty:hidden" aria-live="polite">
        {busy && 'The first run also generates an RSA key, so it takes a few seconds.'}
      </p>
      <ErrorNote message={error} />

      {report && <BenchmarkResults report={report} />}
    </>
  );
}

function BenchmarkResults({ report }: { report: BenchmarkReport }) {
  const megabytes = (value: number) => `${value.toFixed(1)} MB/s`;
  const rows: [string, string, string][] = [
    ['SHA-256', megabytes(report.sha256.megabytesPerSecond), `${report.sha256.megabytes} MB in ${formatMs(report.sha256.ms)}`],
    ['AES-256-GCM encryption', megabytes(report.gcmEncrypt.megabytesPerSecond), `${report.gcmEncrypt.megabytes} MB in ${formatMs(report.gcmEncrypt.ms)}`],
    ['AES-256-GCM decryption', megabytes(report.gcmDecrypt.megabytesPerSecond), `${report.gcmDecrypt.megabytes} MB in ${formatMs(report.gcmDecrypt.ms)}`],
    ['PBKDF2-HMAC-SHA256', formatMs(report.pbkdf2.ms), `${formatNumber(report.pbkdf2.iterations)} iterations, one key derivation`],
    [`RSA-${report.keygen.bits} key generation`, formatMs(report.keygen.ms), 'One key pair, including the search for two primes'],
    [`RSA-${report.rsa.bits} OAEP encryption`, formatMs(report.rsa.oaepEncryptMs), 'Public-key operation, e = 65537'],
    [`RSA-${report.rsa.bits} OAEP decryption`, formatMs(report.rsa.oaepDecryptMs), 'Private-key operation with CRT'],
    [`RSA-${report.rsa.bits} PSS signing`, formatMs(report.rsa.pssSignMs), 'Private-key operation with CRT'],
    [`RSA-${report.rsa.bits} PSS verification`, formatMs(report.rsa.pssVerifyMs), 'Public-key operation, e = 65537'],
  ];

  const aesKilobytes = report.gcmDecrypt.megabytesPerSecond * 1024;
  const ratio = aesKilobytes / report.rsa.oaepDecryptKilobytesPerSecond;

  return (
    <div className="mt-6 space-y-6">
      <div className="well overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Operation
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Result
              </th>
              <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([operation, value, note]) => (
              <tr key={operation}>
                <th scope="row" className="px-4 py-2.5 font-normal text-ink">
                  {operation}
                  {/* Di layar sempit kolom Notes disembunyikan; isinya pindah ke bawah nama operasi. */}
                  <span className="mt-0.5 block text-xs text-ink-muted sm:hidden">{note}</span>
                </th>
                <td className="px-4 py-2.5 text-right align-top font-mono font-semibold whitespace-nowrap text-ink tabular-nums">{value}</td>
                <td className="hidden px-4 py-2.5 text-ink-muted sm:table-cell">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-ink">Why hybrid encryption</h2>
        <p className="mt-2 max-w-[68ch] text-sm text-ink-soft">
          RSA-OAEP at {report.rsa.bits} bits can only encrypt {report.rsa.oaepMaxMessageBytes} bytes per operation. Used directly
          on file contents, it would decrypt at about{' '}
          <span className="font-mono font-semibold text-ink">{report.rsa.oaepDecryptKilobytesPerSecond.toFixed(1)} KB/s</span>, while
          AES-256-GCM reaches <span className="font-mono font-semibold text-ink">{formatNumber(Math.round(aesKilobytes))} KB/s</span>: about{' '}
          <span className="font-mono font-semibold text-ink">{formatNumber(Math.round(ratio))} times</span> faster.
        </p>
        <p className="mt-2 max-w-[68ch] text-sm text-ink-soft">
          That is why file contents are encrypted with AES, and RSA is used only once per file to wrap the 32-byte AES key.
        </p>
      </section>
    </div>
  );
}
