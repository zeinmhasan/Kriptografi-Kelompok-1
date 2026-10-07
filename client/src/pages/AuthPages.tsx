import { Lock, LoaderCircle, TriangleAlert } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInspector } from '../hooks/useInspector';
import { errorMessage } from '../services/api';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Crypta`;
  }, [title]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="well flex size-14 items-center justify-center rounded-full">
            <Lock className="size-6 text-stamp" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
        </div>
        <div className="card p-6">{children}</div>
        <p className="mt-4 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="alert alert-error">
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
      title="Log in to Crypta"
      subtitle="Secure File Storage & Digital Signature Platform"
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="rounded font-medium text-stamp hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-identifier" className="label">
            Username or email
          </label>
          <input
            id="login-identifier"
            className="input"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <input id="login-password" type="password" className="input" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !identifier || !password}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? 'Checking password…' : 'Log In'}
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
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trace = await register(username, email, password);
      inspector.record(trace, `Account ${username.trim().toLowerCase()}`);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create a Crypta account"
      subtitle="Two RSA key pairs are generated just for you"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="rounded font-medium text-stamp hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-username" className="label">
            Username
          </label>
          <input
            id="register-username"
            className="input"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="register-username-hint"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
          />
          <p id="register-username-hint" className="hint">
            3-32 characters: lowercase letters, digits, or underscores.
          </p>
        </div>
        <div>
          <label htmlFor="register-email" className="label">
            Email
          </label>
          <input id="register-email" type="email" className="input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
        </div>
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="register-password" className="label">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                className="input"
                autoComplete="new-password"
                aria-describedby="register-password-hint"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="register-confirmation" className="label">
                Repeat password
              </label>
              <input id="register-confirmation" type="password" className="input" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
            </div>
          </div>
          <p id="register-password-hint" className="hint">
            At least 8 characters.
          </p>
        </div>

        <p className="alert alert-warning text-xs">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Your password protects your private keys. If you forget it, the keys cannot be unlocked and all your files are permanently lost.
        </p>

        <FormError message={error} />

        <button type="submit" className="btn btn-primary w-full" disabled={busy || !username || !email || password.length < 8 || !confirmation}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? 'Generating RSA keys…' : 'Register'}
        </button>
        <p className="text-center text-xs text-ink-muted empty:hidden" aria-live="polite">
          {busy && 'Searching for random primes with Miller-Rabin for two key pairs. This usually takes a few seconds.'}
        </p>
      </form>
    </AuthShell>
  );
}
