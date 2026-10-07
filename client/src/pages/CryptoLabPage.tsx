import { Activity, CircleCheck, CircleX, Gauge, ListChecks, LoaderCircle, Zap } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { PasswordDialog } from '../components/PasswordDialog';
import { TamperTable } from '../components/TamperTable';
import { TraceView } from '../components/TraceView';
import { useFiles } from '../hooks/useFiles';
import { useInspector } from '../hooks/useInspector';
import { formatMs } from '../lib/format';
import { api, errorMessage } from '../services/api';
import type { BenchmarkReport, SelfTestReport, TamperReport } from '../types';

const TABS = [
  { id: 'inspector', label: 'Inspector', icon: Activity },
  { id: 'tamper', label: 'Simulasi Tamper', icon: Zap },
  { id: 'selftest', label: 'Self-Test', icon: ListChecks },
  { id: 'benchmark', label: 'Benchmark', icon: Gauge },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CryptoLabPage() {
  const [tab, setTab] = useState<TabId>('inspector');

  return (
    <>
      <PageHeader
        title="Crypto Lab"
        description="Semua algoritma di Crypta ditulis sendiri dari nol. Halaman ini memperlihatkan cara kerjanya dan membuktikan kebenarannya."
      />

      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              tab === id ? 'border-emerald-400 font-medium text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'inspector' && <InspectorTab />}
      {tab === 'tamper' && <TamperTab />}
      {tab === 'selftest' && <SelfTestTab />}
      {tab === 'benchmark' && <BenchmarkTab />}
    </>
  );
}

function Intro({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-3xl text-sm text-slate-400">{children}</p>;
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </p>
  );
}

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeStyle: 'medium' });

function InspectorTab() {
  const { records, selectedId, select } = useInspector();
  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <>
      <Intro>
        Setiap operasi kriptografi mencatat langkahnya: algoritma yang dipakai, nilai antara seperti IV, auth tag, dan hash,
        serta durasinya. Kunci AES dan private key tidak pernah ikut dicatat.
      </Intro>
      {!selected ? (
        <p className="card px-6 py-10 text-center text-sm text-slate-500">
          Belum ada operasi pada sesi ini. Upload, dekripsi, tanda tangani, atau bagikan file, lalu kembali ke sini.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ul className="card max-h-[32rem] divide-y divide-slate-800 overflow-y-auto lg:col-span-1">
            {records.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => select(record.id)}
                  className={`w-full cursor-pointer px-4 py-2.5 text-left hover:bg-slate-800/50 ${record.id === selected.id ? 'bg-emerald-500/10' : ''}`}
                >
                  <p className="text-sm text-slate-100">{record.trace.operation}</p>
                  <p className="truncate text-xs text-slate-500">
                    {timeFormat.format(record.at)}
                    {record.subject && ` · ${record.subject}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className="card p-4 lg:col-span-2">
            <TraceView trace={selected.trace} />
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
        Server mengubah satu bit acak pada ciphertext, auth tag, IV, kunci AES terbungkus, isi file, dan signature secara
        bergantian, lalu mencoba memproses hasilnya. Percobaan dilakukan pada salinan di memori, jadi file asli tetap utuh.
      </Intro>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="tamper-file" className="label">
            File yang diuji
          </label>
          <select id="tamper-file" className="input" value={selectedId} onChange={(event) => setFileId(event.target.value)} disabled={files.length === 0}>
            {files.length === 0 && <option value="">Belum ada file</option>}
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.originalName}
                {file.signature ? ' (ditandatangani)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={() => setAsking(true)}>
          <Zap className="size-4" />
          Jalankan Simulasi
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">File yang sudah ditandatangani menambah tiga percobaan terhadap signature RSA-PSS.</p>
      <ErrorNote message={listError} />

      {report && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Hasil untuk "{report.fileName}"</h2>
          <TamperTable experiments={report.experiments} />
        </div>
      )}

      {asking && (
        <PasswordDialog
          title="Simulasi tamper"
          description="Password dibutuhkan untuk membuka private key, yang dipakai membuka kunci AES file ini."
          confirmLabel="Jalankan Simulasi"
          busyLabel="Menjalankan…"
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

  return (
    <>
      <Intro>
        Known-answer test: setiap algoritma dijalankan dengan masukan dari standar resminya (FIPS, NIST, RFC) dan keluarannya
        dibandingkan dengan jawaban yang tercantum di standar itu. RSA-OAEP dan RSA-PSS memakai nilai acak, jadi diuji lewat
        konsistensi berpasangan pada kunci yang baru dibangkitkan.
      </Intro>

      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
        {busy ? 'Menjalankan…' : 'Jalankan Self-Test'}
      </button>
      <ErrorNote message={error} />

      {report && (
        <div className="mt-6 space-y-4">
          <p className={`text-sm font-medium ${report.passed === report.total ? 'text-emerald-300' : 'text-rose-300'}`}>
            {report.passed} dari {report.total} pengujian lulus.
          </p>
          {algorithms.map((algorithm) => {
            const results = report.results.filter((result) => result.algorithm === algorithm);
            return (
              <section key={algorithm} className="card overflow-hidden">
                <h2 className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm font-semibold text-slate-100">
                  <span className="font-mono">{algorithm}</span>
                  <span className="text-xs font-normal text-slate-400">
                    {results.filter((result) => result.passed).length}/{results.length} lulus
                  </span>
                </h2>
                <ul className="divide-y divide-slate-800">
                  {results.map((result, index) => (
                    <li key={index} className="flex items-start gap-3 px-4 py-2.5">
                      {result.passed ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-label="Lulus" />
                      ) : (
                        <CircleX className="mt-0.5 size-4 shrink-0 text-rose-400" aria-label="Gagal" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-100">{result.name}</p>
                        <p className="text-xs text-slate-500">{result.source}</p>
                        {result.error && <p className="text-xs text-rose-300">{result.error}</p>}
                      </div>
                      <span className="font-mono text-xs whitespace-nowrap text-slate-400">{formatMs(result.ms)}</span>
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
        Mengukur kecepatan implementasi buatan sendiri di mesin ini. Angka di sini adalah dasar pemilihan batas ukuran file dan
        jumlah iterasi PBKDF2, dan memperlihatkan alasan dipakainya hybrid encryption.
      </Intro>

      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Gauge className="size-4" />}
        {busy ? 'Mengukur…' : 'Jalankan Benchmark'}
      </button>
      {busy && <p className="mt-2 text-xs text-slate-500">Pengukuran pertama juga membangkitkan satu kunci RSA, jadi butuh beberapa detik.</p>}
      <ErrorNote message={error} />

      {report && <BenchmarkResults report={report} />}
    </>
  );
}

function BenchmarkResults({ report }: { report: BenchmarkReport }) {
  const megabytes = (value: number) => `${value.toFixed(1)} MB/s`;
  const rows: [string, string, string][] = [
    ['SHA-256', megabytes(report.sha256.megabytesPerSecond), `${report.sha256.megabytes} MB dalam ${formatMs(report.sha256.ms)}`],
    ['AES-256-GCM enkripsi', megabytes(report.gcmEncrypt.megabytesPerSecond), `${report.gcmEncrypt.megabytes} MB dalam ${formatMs(report.gcmEncrypt.ms)}`],
    ['AES-256-GCM dekripsi', megabytes(report.gcmDecrypt.megabytesPerSecond), `${report.gcmDecrypt.megabytes} MB dalam ${formatMs(report.gcmDecrypt.ms)}`],
    ['PBKDF2-HMAC-SHA256', formatMs(report.pbkdf2.ms), `${report.pbkdf2.iterations.toLocaleString('id-ID')} iterasi, satu kali penurunan kunci`],
    [`Pembangkitan kunci RSA-${report.keygen.bits}`, formatMs(report.keygen.ms), 'Satu key pair, termasuk pencarian dua bilangan prima'],
    [`RSA-${report.rsa.bits} OAEP enkripsi`, formatMs(report.rsa.oaepEncryptMs), 'Operasi kunci publik, e = 65537'],
    [`RSA-${report.rsa.bits} OAEP dekripsi`, formatMs(report.rsa.oaepDecryptMs), 'Operasi kunci privat dengan CRT'],
    [`RSA-${report.rsa.bits} PSS tanda tangan`, formatMs(report.rsa.pssSignMs), 'Operasi kunci privat dengan CRT'],
    [`RSA-${report.rsa.bits} PSS verifikasi`, formatMs(report.rsa.pssVerifyMs), 'Operasi kunci publik, e = 65537'],
  ];

  const aesKilobytes = report.gcmDecrypt.megabytesPerSecond * 1024;
  const ratio = aesKilobytes / report.rsa.oaepDecryptKilobytesPerSecond;

  return (
    <div className="mt-6 space-y-6">
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-slate-950/60 text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Operasi</th>
              <th className="px-4 py-2 text-right font-medium">Hasil</th>
              <th className="px-4 py-2 font-medium">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(([operation, value, note]) => (
              <tr key={operation}>
                <td className="px-4 py-2.5 text-slate-100">{operation}</td>
                <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap text-emerald-300">{value}</td>
                <td className="px-4 py-2.5 text-slate-400">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-slate-100">Mengapa hybrid encryption</h2>
        <p className="mt-2 text-sm text-slate-300">
          RSA-OAEP {report.rsa.bits}-bit hanya bisa mengenkripsi {report.rsa.oaepMaxMessageBytes} byte per operasi. Jika dipakai
          langsung untuk isi file, laju dekripsinya sekitar{' '}
          <span className="font-mono text-emerald-300">{report.rsa.oaepDecryptKilobytesPerSecond.toFixed(1)} KB/s</span>, sedangkan
          AES-256-GCM mencapai <span className="font-mono text-emerald-300">{aesKilobytes.toFixed(0)} KB/s</span>: sekitar{' '}
          <span className="font-mono text-emerald-300">{Math.round(ratio).toLocaleString('id-ID')} kali</span> lebih cepat.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Karena itu isi file dienkripsi dengan AES, dan RSA hanya dipakai sekali per file untuk membungkus kunci AES 32 byte.
        </p>
      </section>
    </div>
  );
}
