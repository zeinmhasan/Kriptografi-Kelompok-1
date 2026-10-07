import { formatMs } from '../lib/format';
import type { Trace } from '../types';

// Nama field dari server ditulis camelCase; di layar ditampilkan sebagai kata biasa.
function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function TraceView({ trace }: { trace: Trace }) {
  const slowest = Math.max(...trace.steps.map((step) => step.ms), 0.001);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{trace.operation}</h3>
        <span className="font-mono text-xs text-slate-400">total {formatMs(trace.totalMs)}</span>
      </div>

      <ol className="mt-3 space-y-2.5">
        {trace.steps.map((step, index) => (
          <li key={index} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[11px] font-semibold text-emerald-300">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-100">{step.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="badge bg-sky-500/15 font-mono text-sky-300">{step.algorithm}</span>
                  <span className="font-mono text-xs text-slate-400">{formatMs(step.ms)}</span>
                </div>
                {/* Batang proporsional terhadap langkah paling lambat: terlihat langkah mana yang mahal. */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                  <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max((step.ms / slowest) * 100, 1.5)}%` }} />
                </div>
              </div>
            </div>

            {Object.keys(step.values).length > 0 && (
              <dl className="mt-2.5 space-y-1.5 border-t border-slate-800 pt-2.5">
                {Object.entries(step.values).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-[11px] tracking-wide text-slate-500 uppercase">{humanize(key)}</dt>
                    <dd className="hex">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
