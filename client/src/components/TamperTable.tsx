import { CircleCheck, CircleX } from 'lucide-react';
import { formatMs } from '../lib/format';
import type { TamperExperiment } from '../types';

export function TamperTable({ experiments }: { experiments: TamperExperiment[] }) {
  const passed = experiments.filter((experiment) => experiment.passed).length;
  const allPassed = passed === experiments.length;

  return (
    <div>
      <p className={`mb-3 text-sm ${allPassed ? 'text-emerald-300' : 'text-rose-300'}`}>
        {passed} dari {experiments.length} percobaan berperilaku sesuai harapan.
        {allPassed && ' Setiap perubahan satu bit terdeteksi, dan data yang tidak diubah tetap diterima.'}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-950/60 text-xs text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Percobaan</th>
              <th className="px-3 py-2 font-medium">Hasil</th>
              <th className="px-3 py-2 font-medium">Dideteksi oleh</th>
              <th className="px-3 py-2 text-right font-medium">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {experiments.map((experiment, index) => (
              <tr key={index}>
                <td className="px-3 py-2.5 align-top">
                  <p className="text-slate-100">{experiment.title}</p>
                  <p className="hex mt-0.5 text-slate-400">{experiment.change}</p>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {experiment.passed ? <CircleCheck className="size-4 text-emerald-400" /> : <CircleX className="size-4 text-rose-400" />}
                    <span className={experiment.outcome === 'ditolak' ? 'text-amber-300' : 'text-emerald-300'}>
                      {experiment.outcome === 'ditolak' ? 'Ditolak' : 'Diterima'}
                    </span>
                  </span>
                  {!experiment.passed && <p className="mt-0.5 text-xs text-rose-300">Seharusnya {experiment.expected}</p>}
                </td>
                <td className="px-3 py-2.5 align-top text-slate-300">{experiment.detectedBy}</td>
                <td className="px-3 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap text-slate-400">{formatMs(experiment.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Semua perubahan dilakukan pada salinan di memori server. File di storage dan record di database tidak disentuh.
      </p>
    </div>
  );
}
