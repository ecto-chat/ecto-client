import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
const Router = isElectron ? HashRouter : BrowserRouter;
import { MotionConfig } from 'motion/react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { LoginPage, RegisterPage, LandingPage, DirectConnectForm } from '@/features/auth';
import { AuthGuard } from '@/features/common';
import { AppLayout } from '@/layout/AppLayout';
import { useJoinParams } from '@/hooks/useJoinParams';

function ElectronTitleBar() {
  return (
    <div
      style={{
        height: 36,
        WebkitAppRegion: 'drag',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 500,
        userSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      } as React.CSSProperties}
    >
      Ecto
    </div>
  );
}

export function App() {
  useJoinParams();

  return (
    <MotionConfig reducedMotion="user">
      <TooltipPrimitive.Provider delayDuration={300}>
      {isElectron && <ElectronTitleBar />}
      <div className="h-full w-full" style={isElectron ? { paddingTop: 36 } : undefined}>
      <Router>
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
      </Router>
      </div>
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}
