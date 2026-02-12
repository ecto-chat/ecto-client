import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.js';
import { SplashScreen } from './SplashScreen.js';

export function AuthGuard({ children }: { children: ReactNode }) {
  const authState = useAuthStore((s) => s.authState);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const navigate = useNavigate();

  useEffect(() => {
    if (authState === 'idle') {
      restoreSession();
    }
  }, [authState, restoreSession]);

  useEffect(() => {
    if (authState === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [authState, navigate]);

  if (authState === 'idle' || authState === 'loading') {
    return <SplashScreen />;
  }

  if (authState === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
