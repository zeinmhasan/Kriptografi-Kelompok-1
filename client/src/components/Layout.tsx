import { Activity, FileCheck, FlaskConical, FolderLock, LayoutDashboard, Lock, LogOut, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="shrink-0 border-b border-slate-800 bg-slate-900/60 md:w-56 md:border-r md:border-b-0" aria-label="Navigasi utama">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
            <Lock className="size-4 text-emerald-400" />
          </span>
          <span className="text-lg font-semibold tracking-wide text-slate-100">Crypta</span>
        </div>
        <ul className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {NAVIGATION.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    isActive ? 'bg-emerald-500/15 font-medium text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
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
        <header className="flex items-center justify-end gap-2 border-b border-slate-800 px-4 py-3 sm:px-8">
          <button type="button" className="btn btn-secondary" onClick={() => inspector.setOpen(!inspector.isOpen)}>
            <Activity className="size-4 text-emerald-400" />
            Inspector
            {inspector.records.length > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 font-mono text-xs text-emerald-300">{inspector.records.length}</span>
            )}
          </button>
          <span className="hidden px-2 text-sm text-slate-300 sm:block">{user?.username}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            <LogOut className="size-4" />
            Keluar
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>

      <InspectorDrawer />
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}
