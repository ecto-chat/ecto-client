import type { ReactNode } from 'react';

import { useAuthStore } from '@/stores/auth';

import { CentralSignInPrompt } from './CentralSignInPrompt';

type FeatureGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function FeatureGate({ children, fallback }: FeatureGateProps) {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  if (centralAuthState !== 'authenticated') {
    return <>{fallback ?? <CentralSignInPrompt />}</>;
  }

  return <>{children}</>;
}
