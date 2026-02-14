import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/auth/LoginPage.js';
import { RegisterPage } from './components/auth/RegisterPage.js';
import { LandingPage } from './components/auth/LandingPage.js';
import { DirectConnectForm } from './components/auth/DirectConnectForm.js';
import { AuthGuard } from './components/common/AuthGuard.js';
import { AppLayout } from './components/layout/AppLayout.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/direct-connect" element={<DirectConnectForm />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
