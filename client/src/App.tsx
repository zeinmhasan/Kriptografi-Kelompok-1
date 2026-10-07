import { LoaderCircle } from 'lucide-react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { InspectorProvider } from './hooks/useInspector';
import { ToastProvider } from './hooks/useToast';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CryptoLabPage } from './pages/CryptoLabPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyFilesPage, SharedPage } from './pages/FilesPages';
import { SettingsPage } from './pages/SettingsPage';
import { VerifyPage } from './pages/VerifyPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <p className="flex min-h-dvh items-center justify-center gap-2 text-sm text-ink-muted" role="status">
        <LoaderCircle className="size-4 animate-spin" />
        Loading…
      </p>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <InspectorProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="files" element={<MyFilesPage />} />
                  <Route path="shared" element={<SharedPage />} />
                  <Route path="verify" element={<VerifyPage />} />
                  <Route path="lab" element={<CryptoLabPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </InspectorProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
