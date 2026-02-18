import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { LoginPage, RegisterPage, LandingPage, DirectConnectForm } from '@/features/auth';
import { AuthGuard } from '@/features/common';
import { AppLayout } from '@/layout/AppLayout';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipPrimitive.Provider delayDuration={300}>
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
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}
