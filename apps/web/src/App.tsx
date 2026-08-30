import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { WorkspacePage } from './pages/WorkspacePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return user === null ? <Navigate replace to="/login" /> : children;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return user === null ? children : <Navigate replace to="/board" />;
}

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07130f] text-stone-100">
        <div className="flex items-center gap-4" role="status">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-300 opacity-70" />
            <span className="relative inline-flex size-3 rounded-full bg-lime-300" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-stone-300">
            Restoring your workspace…
          </span>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="login" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="register" />
          </PublicOnlyRoute>
        }
      />
      <Route path="/" element={<Navigate replace to="/board" />} />
      <Route
        path="/teams"
        element={
          <ProtectedRoute>
            <WorkspacePage view="teams" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <WorkspacePage view="projects" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board"
        element={
          <ProtectedRoute>
            <WorkspacePage view="board" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to="/board" />} />
    </Routes>
  );
}
