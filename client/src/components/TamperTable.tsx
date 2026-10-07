import { CircleCheck, CircleX } from 'lucide-react';
import { formatMs } from '../lib/format';
import type { TamperExperiment } from '../types';

// Nilai dari server tetap seperti kontrak API-nya; yang diterjemahkan hanya labelnya di layar.
const OUTCOME_LABEL: Record<TamperExperiment['outcome'], string> = {
  diterima: 'Accepted',
  ditolak: 'Rejected',
};

export function TamperTable({ experiments }: { experiments: TamperExperiment[] }) {
  const passed = experiments.filter((experiment) => experiment.passed).length;
  const allPassed = passed === experiments.length;

  return (
    <div>
      <p className={`mb-3 flex items-start gap-2 text-sm ${allPassed ? 'text-seal' : 'text-alert'}`}>
        {allPassed ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleX className="mt-0.5 size-4 shrink-0" />}
        <span>
          {passed} of {experiments.length} experiments behaved as expected.
          {allPassed && ' Every single-bit change was detected, and unmodified data was still accepted.'}
        </span>
      </p>
      <div className="well overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Experiment
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                Result
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                Detected by
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {experiments.map((experiment, index) => (
              <tr key={index}>
                <td className="px-3 py-2.5 align-top">
                  <p className="text-ink">{experiment.title}</p>
                  <p className="hex mt-0.5 text-ink-muted">{experiment.change}</p>
                  {/* Di layar sempit tiga kolom lain disembunyikan; isinya pindah ke sini. */}
                  <div className="mt-2 sm:hidden">
                    <Outcome experiment={experiment} />
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {experiment.detectedBy} · <span className="tabular-nums">{formatMs(experiment.ms)}</span>
                    </p>
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                  <Outcome experiment={experiment} />
                </td>
                <td className="hidden px-3 py-2.5 align-top text-ink-soft sm:table-cell">{experiment.detectedBy}</td>
                <td className="hidden px-3 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums sm:table-cell">
                  {formatMs(experiment.ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint mt-3">
        Every change is made on a copy in server memory. The file in storage and the database record are not touched.
      </p>
    </div>
  );
}

function Outcome({ experiment }: { experiment: TamperExperiment }) {
  return (
    <>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {experiment.passed ? <CircleCheck className="size-4 text-seal" /> : <CircleX className="size-4 text-alert" />}
        <span className={experiment.outcome === 'ditolak' ? 'text-warn' : 'text-seal'}>{OUTCOME_LABEL[experiment.outcome]}</span>
      </span>
      {!experiment.passed && <p className="mt-0.5 text-xs text-alert">Expected {OUTCOME_LABEL[experiment.expected].toLowerCase()}</p>}
    </>
  );
}
