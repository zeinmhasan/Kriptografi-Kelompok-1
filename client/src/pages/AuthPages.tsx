import { Lock, LoaderCircle, TriangleAlert } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInspector } from '../hooks/useInspector';
import { errorMessage } from '../services/api';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15">
            <Lock className="size-6 text-emerald-400" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="card p-6">{children}</div>
        <p className="mt-4 text-center text-sm text-slate-400">{footer}</p>
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </p>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (thrown) {
      setError(errorMessage(thrown));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Masuk ke Crypta"
      subtitle="Secure File Storage & Digital Signature Platform"
      footer={
        <>
          Belum punya akun?{' '}
          <Link to="/register" className="text-emerald-400 hover:underline">
            Daftar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-identifier" className="label">
            Username atau email
          </label>
          <input id="login-identifier" className="input" autoFocus autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        </div>
        <div>
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <input id="login-password" type="password" className="input" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !identifier || !password}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? 'Memeriksa password…' : 'Masuk'}
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const inspector = useInspector();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && !busy) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trace = await register(username, email, password);
      inspector.record(trace, `Akun ${username.trim().toLowerCase()}`);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Buat akun Crypta"
      subtitle="Dua pasang kunci RSA dibangkitkan khusus untuk Anda"
      footer={
        <>
          Sudah punya akun?{' '}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-username" className="label">
            Username
          </label>
          <input id="register-username" className="input" autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} />
          <p className="mt-1 text-xs text-slate-500">3-32 karakter: huruf kecil, angka, atau garis bawah.</p>
        </div>
        <div>
          <label htmlFor="register-email" className="label">
            Email
          </label>
          <input id="register-email" type="email" className="input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="register-password" className="label">
              Password
            </label>
            <input id="register-password" type="password" className="input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          </div>
          <div>
            <label htmlFor="register-confirmation" className="label">
              Ulangi password
            </label>
            <input id="register-confirmation" type="password" className="input" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Password melindungi private key Anda. Jika lupa, private key tidak bisa dibuka dan semua file hilang permanen.
        </p>

        <FormError message={error} />

        <button type="submit" className="btn btn-primary w-full" disabled={busy || !username || !email || password.length < 8 || !confirmation}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? 'Membangkitkan kunci RSA…' : 'Daftar'}
        </button>
        {busy && (
          <p className="text-center text-xs text-slate-400">
            Mencari bilangan prima acak dengan Miller-Rabin untuk dua pasang kunci. Biasanya beberapa detik.
          </p>
        )}
      </form>
    </AuthShell>
  );
}
