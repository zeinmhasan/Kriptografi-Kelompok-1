import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Trace } from '../types';

export interface TraceRecord {
  id: number;
  at: Date;
  subject: string;
  trace: Trace;
}

interface InspectorContextValue {
  records: TraceRecord[];
  selectedId: number | null;
  select: (id: number) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  autoOpen: boolean;
  setAutoOpen: (enabled: boolean) => void;
  // Mencatat jejak satu operasi kripto. subject adalah nama file atau akun yang dikenai.
  record: (trace: Trace | null | undefined, subject?: string) => void;
  clear: () => void;
}

const AUTO_OPEN_KEY = 'crypta.inspector.autoOpen';
const HISTORY_LIMIT = 30;

const InspectorContext = createContext<InspectorContextValue | null>(null);

function readAutoOpen(): boolean {
  try {
    return localStorage.getItem(AUTO_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

let nextId = 1;

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<TraceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [autoOpen, setAutoOpenState] = useState(readAutoOpen);

  const setAutoOpen = useCallback((enabled: boolean) => {
    setAutoOpenState(enabled);
    try {
      localStorage.setItem(AUTO_OPEN_KEY, String(enabled));
    } catch {
      // Tanpa localStorage, pilihan hanya berlaku selama halaman terbuka.
    }
  }, []);

  const record = useCallback(
    (trace: Trace | null | undefined, subject: string = '') => {
      if (!trace) return;
      const entry: TraceRecord = { id: nextId++, at: new Date(), subject, trace };
      setRecords((previous) => [entry, ...previous].slice(0, HISTORY_LIMIT));
      setSelectedId(entry.id);
      if (autoOpen) setOpen(true);
    },
    [autoOpen],
  );

  const clear = useCallback(() => {
    setRecords([]);
    setSelectedId(null);
  }, []);

  const value = useMemo(
    () => ({ records, selectedId, select: setSelectedId, isOpen, setOpen, autoOpen, setAutoOpen, record, clear }),
    [records, selectedId, isOpen, autoOpen, setAutoOpen, record, clear],
  );
  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

export function useInspector(): InspectorContextValue {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('useInspector must be used inside InspectorProvider');
  return context;
}
