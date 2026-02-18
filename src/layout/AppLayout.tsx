import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Hash, WifiOff } from 'lucide-react';

// layout
import { ServerSidebar } from '../layout/ServerSidebar';
import { ChannelSidebar } from '../layout/ChannelSidebar';
import { MemberList } from '../layout/MemberList';

// features
import { ServerSettings, SetupWizard } from '@/features/admin';
import { CentralSignInModal } from '@/features/auth';
import { IncomingCallOverlay, ActiveCallOverlay, CallBanner } from '@/features/call';
import { ChannelView, ImageLightbox } from '@/features/chat';
import { NotificationPrompt, NotificationToast } from '@/features/common';
import { FriendList, DMView, DMSidebar } from '@/features/friends';
import { AddServerModal, LeaveServerModal } from '@/features/servers';
import { UserSettingsModal } from '@/features/settings';
import { UserProfileModal } from '@/features/user';
import { VoiceControls, VoiceBanner } from '@/features/voice';

// stores, hooks, services, ui
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { useVoiceStore } from '@/stores/voice';
import { useConnectionStore } from '@/stores/connection';
import { useCallStore } from '@/stores/call';
import { useNotifications } from '@/hooks/useNotifications';
import { useInitializeCentral } from '@/hooks/useInitializeCentral';
import { useInitializeLocal } from '@/hooks/useInitializeLocal';
import { connectionManager } from '@/services/connection-manager';
import { setNotificationClickHandler } from '@/services/notification-service';
import { startIdleDetection, stopIdleDetection } from '@/services/idle-detector';
import { EmptyState } from '@/ui/EmptyState';
import { ToastContainer } from '@/ui/Toast';
import { blurToClear, easePage } from '@/lib/animations';

/** Redirects to the default channel if one is set, otherwise shows empty state */
function ServerFallback() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const serverMeta = useServerStore(
    (s) => activeServerId ? s.serverMeta.get(activeServerId) ?? null : null,
  );
  const defaultChannelId = serverMeta?.default_channel_id ?? null;
  const navigate = useNavigate();

  useEffect(() => {
    if (activeServerId && defaultChannelId) {
      useUiStore.getState().setActiveChannel(defaultChannelId);
      navigate(`/servers/${activeServerId}/channels/${defaultChannelId}`, { replace: true });
    }
  }, [activeServerId, defaultChannelId, navigate]);

  if (activeServerId && defaultChannelId) return null;
  return <EmptyState icon={<Hash />} title="Select a channel" />;
}

export function AppLayout() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const memberListVisible = useUiStore((s) => s.memberListVisible);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const showVoiceBanner = voiceServerId !== null && voiceServerId !== activeServerId;
  const callState = useCallStore((s) => s.callState);
  const answeredElsewhere = useCallStore((s) => s.answeredElsewhere);
  const showSetupWizard = useUiStore((s) => s.activeModal === 'setup-wizard');
  const navigate = useNavigate();
  const location = useLocation();

  useNotifications();
  useInitializeCentral();
  useInitializeLocal();

  useEffect(() => {
    startIdleDetection();
    return () => stopIdleDetection();
  }, []);

  useEffect(() => {
    return setNotificationClickHandler((data) => {
      if (data.serverId && data.channelId) {
        useUiStore.getState().setActiveServer(data.serverId);
        useUiStore.getState().setActiveChannel(data.channelId);
        connectionManager.switchServer(data.serverId).catch(() => {});
        navigate(`/servers/${data.serverId}/channels/${data.channelId}`);
      } else if (data.peerId) {
        navigate(`/dms/${data.peerId}`);
      }
    });
  }, [navigate]);

  const isHomeRoute =
    location.pathname.startsWith('/dms') || location.pathname.startsWith('/friends');
  const isHomeMode = isHomeRoute || activeServerId === null;
  const activeServerStatus = useConnectionStore((s) =>
    activeServerId ? s.connections.get(activeServerId) : undefined,
  );
  const isServerOffline =
    !isHomeMode && activeServerId != null &&
    (!activeServerStatus || activeServerStatus === 'disconnected');

  return (
    <div className="flex h-full w-full">
      <ServerSidebar />
      {!sidebarCollapsed && !isServerOffline && (
        <div className="flex w-[240px] min-w-[240px] flex-col border-r border-border bg-secondary">
          {isHomeMode ? <DMSidebar /> : <ChannelSidebar />}
          <VoiceControls />
        </div>
      )}
      <main className="flex flex-1 flex-col min-w-0 bg-primary">
        {showVoiceBanner && <VoiceBanner />}
        {(callState === 'active' || answeredElsewhere) && <CallBanner />}
        {showSetupWizard ? (
          <SetupWizard onClose={() => useUiStore.getState().closeModal()} />
        ) : isServerOffline ? (
          <EmptyState
            icon={<WifiOff />}
            title="Server is offline"
            description="Please contact the server admin to bring it back online."
            className="flex-1"
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={blurToClear}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={easePage}
              className="flex flex-1 flex-col min-h-0"
            >
              <Routes location={location}>
                <Route path="friends" element={<FriendList />} />
                <Route path="dms/:userId" element={<DMView />} />
                <Route path="servers/:serverId/channels/:channelId" element={<ChannelView />} />
                <Route
                  path="*"
                  element={
                    isHomeMode ? <FriendList /> : <ServerFallback />
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!isHomeMode && !isServerOffline && memberListVisible && <MemberList />}
      <AddServerModal />
      <LeaveServerModal />
      <UserProfileModal />
      <CentralSignInModal />
      <ServerSettings />
      <UserSettingsModal />
      <IncomingCallOverlay />
      <ActiveCallOverlay />
      <ImageLightbox />
      <NotificationToast />
      <NotificationPrompt />
      <ToastContainer />
    </div>
  );
}
