import { Activity, X } from 'lucide-react';
import { useInspector } from '../hooks/useInspector';
import { TraceView } from './TraceView';

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeStyle: 'medium' });

// Crypto Inspector: panel samping yang menampilkan langkah kriptografi dari operasi terakhir.
export function InspectorDrawer() {
  const { records, selectedId, select, isOpen, setOpen, autoOpen, setAutoOpen, clear } = useInspector();
  if (!isOpen) return null;

  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <aside
      aria-label="Crypto Inspector"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl shadow-black/60"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-100">Crypto Inspector</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Tutup Inspector">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" className="accent-emerald-500" checked={autoOpen} onChange={(event) => setAutoOpen(event.target.checked)} />
          Buka otomatis setelah operasi
        </label>
        {records.length > 0 && (
          <button type="button" onClick={clear} className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
            Hapus riwayat
          </button>
        )}
      </div>

      {!selected ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Belum ada operasi. Upload, dekripsi, tanda tangani, atau bagikan file untuk melihat langkah kriptografinya di sini.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {records.length > 1 && (
            <div className="border-b border-slate-800 px-4 py-3">
              <label htmlFor="inspector-history" className="mb-1 block text-xs text-slate-500">
                Riwayat sesi ini
              </label>
              <select id="inspector-history" className="input" value={selected.id} onChange={(event) => select(Number(event.target.value))}>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {timeFormat.format(record.at)} · {record.trace.operation}
                    {record.subject ? ` · ${record.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="px-4 py-4">
            {selected.subject && <p className="mb-3 truncate text-xs text-slate-400">{selected.subject}</p>}
            <TraceView trace={selected.trace} />
          </div>
        </div>
      )}
    </aside>
  );
}
