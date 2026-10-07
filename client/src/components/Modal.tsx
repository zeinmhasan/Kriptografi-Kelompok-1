import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  // Selama operasi berjalan, dialog tidak bisa ditutup dengan cara apa pun.
  busy?: boolean;
}

const WIDTH = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, size = 'md', busy = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Fokus pindah ke dialog saat dibuka dan kembali ke pemicunya saat ditutup.
  // Halaman di belakangnya tidak ikut bergulir; padding menggantikan lebar scrollbar
  // yang hilang supaya isi halaman tidak bergeser.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Menandai Escape sudah ditangani, supaya panel Inspector tidak ikut tertutup.
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Tab berputar di dalam dialog.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, busy]);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`animate-pop w-full ${WIDTH[size]} rounded-2xl bg-ground shadow-[12px_16px_38px_oklch(0.34_0.045_200/0.45)] focus:outline-none sm:my-auto`}
      >
        <div className="flex items-center justify-between gap-4 groove-b py-3 pr-3 pl-5">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
