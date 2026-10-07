import { Activity, X } from 'lucide-react';
import { useEffect } from 'react';
import { useInspector } from '../hooks/useInspector';
import { formatTime } from '../lib/format';
import { TraceView } from './TraceView';

// Crypto Inspector: panel samping yang menampilkan langkah kriptografi dari operasi terakhir.
// Di layar lebar panel ini berdampingan dengan halaman, di lembar yang sama dan dipisah alur;
// di layar sempit ia terangkat dan menutupi halaman.
export function InspectorDrawer() {
  const { records, selectedId, select, isOpen, setOpen, autoOpen, setAutoOpen, clear } = useInspector();

  // Escape menutup panel, kecuali saat sebuah dialog terbuka: dialog itu yang ditutup lebih dulu.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <aside
      id="crypto-inspector"
      aria-label="Crypto Inspector"
      className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-ground shadow-float xl:sticky xl:top-0 xl:h-dvh xl:w-[26rem] xl:shrink-0 xl:border-l xl:border-line xl:shadow-[inset_1px_0_0_var(--relief-light)]"
    >
      <header className="groove-b flex h-16 shrink-0 items-center justify-between gap-3 pr-3 pl-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-stamp" />
          <h2 className="text-sm font-semibold text-ink">Crypto Inspector</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="Close Inspector">
          <X className="size-5" />
        </button>
      </header>

      <div className="groove-b flex items-center justify-between gap-3 px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={autoOpen} onChange={(event) => setAutoOpen(event.target.checked)} />
          Open automatically after each operation
        </label>
        {records.length > 0 && (
          <button type="button" onClick={clear} className="cursor-pointer rounded text-xs whitespace-nowrap text-ink-muted hover:text-ink">
            Clear history
          </button>
        )}
      </div>

      {!selected ? (
        <p className="px-6 py-10 text-center text-sm text-ink-muted">
          No operations yet. Upload, decrypt, sign, or share a file to see its cryptographic steps here.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {records.length > 1 && (
            <div className="groove-b px-4 py-3">
              <label htmlFor="inspector-history" className="term mb-1.5 block">
                History for this session
              </label>
              <select id="inspector-history" className="input appearance-none pr-9" value={selected.id} onChange={(event) => select(Number(event.target.value))}>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {formatTime(record.at)} · {record.trace.operation}
                    {record.subject ? ` · ${record.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="px-4 py-4">
            <TraceView key={selected.id} trace={selected.trace} />
          </div>
        </div>
      )}
    </aside>
  );
}
