import { Activity, FileCheck, FlaskConical, FolderLock, LayoutDashboard, Lock, LogOut, Settings, User, Users } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInspector } from '../hooks/useInspector';
import { InspectorDrawer } from './InspectorDrawer';

const NAVIGATION = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/files', label: 'My Files', icon: FolderLock, end: false },
  { to: '/shared', label: 'Shared', icon: Users, end: false },
  { to: '/verify', label: 'Verify', icon: FileCheck, end: false },
  { to: '/lab', label: 'Crypto Lab', icon: FlaskConical, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function Layout() {
  const { user, logout } = useAuth();
  const inspector = useInspector();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-[10px] focus:bg-stamp focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      {/* Rel navigasi berada di lembar yang sama dengan halaman; pemisahnya hanya sebuah alur. */}
      <nav
        className="shrink-0 border-b border-line shadow-[0_1px_0_var(--relief-light)] md:sticky md:top-0 md:h-dvh md:w-56 md:overflow-y-auto md:border-r md:border-b-0 md:shadow-[1px_0_0_var(--relief-light)]"
        aria-label="Main"
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="well flex size-9 items-center justify-center rounded-full">
            <Lock className="size-4 text-stamp" />
          </span>
          <span className="text-lg font-semibold tracking-wide text-ink">Crypta</span>
        </div>
        {/* Di layar sempit daftar ini bergulir ke samping; tepi kanannya memudar sebagai penanda. */}
        <ul className="flex gap-1.5 overflow-x-auto px-3 pt-1.5 pb-3 [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] max-md:pr-10 md:flex-col md:overflow-visible">
          {NAVIGATION.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              {/* Halaman yang sedang dibuka adalah tuts yang tertekan masuk. */}
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm whitespace-nowrap transition-[box-shadow,color] duration-150 focus-visible:-outline-offset-2 ${
                    isActive ? 'bg-well font-medium text-stamp shadow-sunk' : 'text-ink-soft hover:text-ink hover:shadow-key'
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="groove-b sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 bg-ground px-4 sm:px-8">
          {/* Demo memakai dua akun di dua jendela, jadi nama akun selalu terlihat. */}
          <p className="mr-auto flex min-w-0 items-center gap-2 text-sm text-ink-soft">
            <User className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="sr-only">Logged in as</span>
            <span className="truncate font-medium text-ink">{user?.username}</span>
          </p>
          <button
            type="button"
            className="btn"
            aria-expanded={inspector.isOpen}
            aria-controls="crypto-inspector"
            onClick={() => inspector.setOpen(!inspector.isOpen)}
          >
            <Activity className="size-4 text-stamp" />
            Inspector
            {inspector.records.length > 0 && (
              <span className="font-mono text-xs font-semibold text-stamp tabular-nums">{inspector.records.length}</span>
            )}
          </button>
          <button type="button" className="btn" aria-label="Log out" onClick={() => void logout()}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 focus:outline-none sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>

      <InspectorDrawer />
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Crypta`;
  }, [title]);

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1.5 max-w-[68ch] text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
