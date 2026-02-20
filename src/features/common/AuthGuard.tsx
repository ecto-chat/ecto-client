import { useEffect, useRef, type ReactNode } from 'react';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth';
import { migrateFromLegacy } from '@/services/preference-migration';

import { SplashScreen } from './SplashScreen';

export function AuthGuard({ children }: { children: ReactNode }) {
  const authState = useAuthStore((s) => s.authState);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const navigate = useNavigate();
  const migrated = useRef(false);

  useEffect(() => {
    if (authState === 'idle') {
      // Run migration once before restoring session
      if (!migrated.current) {
        migrateFromLegacy();
        migrated.current = true;
      }
      restoreSession();
    }
  }, [authState, restoreSession]);

  useEffect(() => {
    if (authState === 'unauthenticated') {
      navigate('/landing', { replace: true });
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
