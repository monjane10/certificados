import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RouteProgress } from './components/feedback/RouteProgress';
import { PublicLayout } from './layouts/PublicLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoutes, UserRoutes } from './routes/AppRoutes';
import { HomePage } from './pages/public/Home';
import { VerifyPage } from './pages/public/Verify';
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';
import { ForbiddenPage, NotFoundPage } from './pages/Status';

export default function App() {
  return (
    <BrowserRouter>
      <RouteProgress />
      <AuthProvider>
        <Routes>
          {/* Públicas */}
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="verificar" element={<VerifyPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="registo" element={<RegisterPage />} />
            <Route path="nao-autorizado" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Privadas */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/*" element={<AdminRoutes />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'user']} />}>
            <Route path="/app/*" element={<UserRoutes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
