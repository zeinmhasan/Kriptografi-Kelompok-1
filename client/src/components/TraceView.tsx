import { formatMs } from '../lib/format';
import type { Trace } from '../types';

const ACRONYMS = new Set(['aad', 'aes', 'iv', 'kek', 'rsa']);

// Nama field dari server ditulis camelCase; di layar ditampilkan sebagai kata biasa.
function humanize(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function TraceView({ trace }: { trace: Trace }) {
  const slowest = Math.max(...trace.steps.map((step) => step.ms), 0.001);
  const lastIndex = trace.steps.length - 1;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{trace.operation}</h3>
        <span className="font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums">total {formatMs(trace.totalMs)}</span>
      </div>

      <ol className="mt-4">
        {trace.steps.map((step, index) => (
          <li key={index} className="relative pb-6 pl-10 last:pb-0">
            {index < lastIndex && (
              <span className="absolute top-8 bottom-1 left-[0.8125rem] w-px bg-line shadow-[1px_0_0_var(--relief-light)]" aria-hidden="true" />
            )}
            {/* Nomor langkah dicetak masuk ke kertas, seperti nomor urut pada formulir. */}
            <span
              className="well absolute top-0 left-0 flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold text-ink-soft tabular-nums"
              aria-hidden="true"
            >
              {index + 1}
            </span>

            <p className="pt-1 text-sm text-ink">{step.label}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="badge font-mono text-ink-soft">{step.algorithm}</span>
              <span className="font-mono text-xs text-ink-muted tabular-nums">{formatMs(step.ms)}</span>
            </div>
            {/* Batang proporsional terhadap langkah paling lambat: terlihat langkah mana yang mahal. */}
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-well shadow-sunk" aria-hidden="true">
              <div
                className="animate-grow h-full origin-left rounded-full bg-stamp"
                style={{ width: `${Math.max((step.ms / slowest) * 100, 2)}%` }}
              />
            </div>

            {Object.keys(step.values).length > 0 && (
              <dl className="mt-3 space-y-2">
                {Object.entries(step.values).map(([key, value]) => (
                  <div key={key}>
                    <dt className="term">{humanize(key)}</dt>
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
