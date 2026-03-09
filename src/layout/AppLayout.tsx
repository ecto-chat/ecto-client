import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';

// layout
import { ServerSidebar } from '../layout/ServerSidebar';
import { ChannelSidebar } from '../layout/ChannelSidebar';
import { MemberList } from '../layout/MemberList';
import { ServerFallback } from '../layout/ServerFallback';

// features (eager — needed immediately or always visible)
import { SetupWizard } from '@/features/admin';
import { CentralSignInModal, AddAccountModal } from '@/features/auth';
import { IncomingCallOverlay, CallBanner } from '@/features/call';
import { ChannelView } from '@/features/chat';
import { SearchSidebar } from '@/features/search';
import { NotificationPrompt, NotificationToast } from '@/features/common';
import { ActivityPanel, ActivityView } from '@/features/activity';
import { DiscoverSidebar } from '@/features/discover/DiscoverSidebar';
import { FriendList, DMView, DMSidebar } from '@/features/friends';
import { FloatingMediaWindow, SnappedMediaSidebar, ResizeHandle } from '@/features/media-window';
import { AddServerModal, LeaveServerModal, ServerJoinModal } from '@/features/servers';
import { FileBrowserView } from '@/features/hub/FileBrowserView';
import { ServerDmView } from '@/features/server-dm/ServerDmView';
import { VoiceControls, VoiceBanner } from '@/features/voice';

// features (lazy — opened on demand)
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage').then(m => ({ default: m.DiscoverPage })));

// features (lazy — opened on demand, heavy import trees)
const ServerSettings = lazy(() => import('@/features/admin/ServerSettings').then(m => ({ default: m.ServerSettings })));
const ChannelSettingsModal = lazy(() => import('@/features/admin/ChannelSettingsModal').then(m => ({ default: m.ChannelSettingsModal })));
const UserSettingsModal = lazy(() => import('@/features/settings/UserSettingsModal').then(m => ({ default: m.UserSettingsModal })));
const UserProfileModal = lazy(() => import('@/features/user/UserProfileModal').then(m => ({ default: m.UserProfileModal })));
const ActiveCallOverlay = lazy(() => import('@/features/call/ActiveCallOverlay').then(m => ({ default: m.ActiveCallOverlay })));
const ImageLightbox = lazy(() => import('@/features/chat/ImageLightbox').then(m => ({ default: m.ImageLightbox })));

// stores, hooks, services, ui
import {
  useUiStore,
  useVoiceStore,
  useConnectionStore,
  useCallStore,
  connectionManager,
  getPlatform,
} from 'ecto-core';
import { useNotifications } from '@/hooks/useNotifications';
import { useInitializeCentral } from '@/hooks/useInitializeCentral';
import { useInitializeLocal } from '@/hooks/useInitializeLocal';
import { startIdleDetection, stopIdleDetection } from '@/services/idle-detector';
import { consumePendingJoin } from '@/hooks/useJoinParams';
import { EmptyState } from '@/ui/EmptyState';
import { ToastContainer } from '@/ui/Toast';
import { blurToClear, easePage } from '@/lib/animations';

export function AppLayout() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const hubSection = useUiStore((s) => s.hubSection);
  const memberListVisible = useUiStore((s) => s.memberListVisible);
  const searchSidebarOpen = useUiStore((s) => s.searchSidebarOpen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const mediaViewMode = useUiStore((s) => s.mediaViewMode);
  const snappedSidebarWidth = useUiStore((s) => s.snappedSidebarWidth);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const showVoiceBanner = voiceServerId !== null && voiceServerId !== activeServerId;
  const callState = useCallStore((s) => s.callState);
  const answeredElsewhere = useCallStore((s) => s.answeredElsewhere);
  const navigate = useNavigate();
  const location = useLocation();

  useNotifications();
  useInitializeCentral();
  useInitializeLocal();

  // Check for pending join from URL params (e.g. server browser redirect)
  useEffect(() => {
    const pending = consumePendingJoin();
    if (pending) {
      useUiStore.getState().openModal('server-join', pending);
    }
  }, []);

  useEffect(() => {
    startIdleDetection();
    return () => stopIdleDetection();
  }, []);

  useEffect(() => {
    return getPlatform().notification.onNotificationClick((data: Record<string, string>) => {
      if (data.serverId && data.conversationId) {
        useUiStore.getState().setActiveServer(data.serverId);
        useUiStore.getState().setHubSection('server-dms');
        connectionManager.switchServer(data.serverId).catch(() => {});
        navigate(`/servers/${data.serverId}/dms/${data.conversationId}`);
      } else if (data.serverId && data.channelId) {
        useUiStore.getState().setActiveServer(data.serverId);
        useUiStore.getState().setActiveChannel(data.channelId);
        connectionManager.switchServer(data.serverId).catch(() => {});
        navigate(`/servers/${data.serverId}/channels/${data.channelId}`);
      } else if (data.peerId) {
        navigate(`/dms/${data.peerId}`);
      }
    });
  }, [navigate]);

  const isActivityRoute = location.pathname.startsWith('/activity');
  const isDiscoverRoute = location.pathname.startsWith('/discover');
  const isHomeRoute =
    location.pathname.startsWith('/dms') || location.pathname.startsWith('/friends');
  const isHomeMode = isHomeRoute || isActivityRoute || isDiscoverRoute || activeServerId === null;
  const showSidebar = true;
  const activeServerStatus = useConnectionStore((s) =>
    activeServerId ? s.connections.get(activeServerId) : undefined,
  );
  const isServerOffline =
    !isHomeMode && activeServerId != null &&
    (!activeServerStatus || activeServerStatus === 'disconnected');

  const isSnappedLeft = mediaViewMode === 'snapped-left';
  const isSnappedRight = mediaViewMode === 'snapped-right';

  // Choose sidebar content based on route
  const sidebarContent = isDiscoverRoute
    ? <DiscoverSidebar />
    : isActivityRoute
      ? <ActivityPanel />
      : isHomeMode
        ? <DMSidebar />
        : <ChannelSidebar />;

  return (
    <div className="flex h-full w-full">
      <ServerSidebar />
      <div className="flex flex-1 min-w-0 py-2 pr-2">
        {!sidebarCollapsed && !isServerOffline && showSidebar && (
          <div className="flex w-[240px] min-w-[240px] flex-col bg-tertiary rounded-l-md overflow-hidden border-r-3 border-primary">
            {sidebarContent}
            <VoiceControls />
          </div>
        )}
        {isSnappedLeft && (
          <>
            <SnappedMediaSidebar />
            <ResizeHandle side="left" />
          </>
        )}
        <main className={`flex flex-1 flex-col min-w-0 bg-secondary overflow-hidden ${showSidebar ? 'rounded-r-md' : 'rounded-md'}`}>
          {showVoiceBanner && <VoiceBanner />}
          {(callState === 'active' || answeredElsewhere) && <CallBanner />}
          {isServerOffline ? (
            <EmptyState
              icon={<WifiOff />}
              title="Server is offline"
              description="Please contact the server admin to bring it back online."
              className="flex-1"
            />
          ) : !isHomeMode && hubSection === 'file-browser' ? (
            <FileBrowserView />
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
                  <Route path="activity" element={<ActivityView />} />
                  <Route path="discover" element={<Suspense><DiscoverPage /></Suspense>} />
                  <Route path="friends" element={<FriendList />} />
                  <Route path="dms/:userId" element={<DMView />} />
                  <Route path="servers/:serverId/channels/:channelId" element={<ChannelView />} />
                  <Route path="servers/:serverId/dms/:conversationId?" element={<ServerDmView />} />
                  <Route
                    path="*"
                    element={
                      isHomeMode ? <Navigate to="/discover" replace /> : <ServerFallback />
                    }
                  />
                </Routes>
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        {isSnappedRight && (
          <>
            <ResizeHandle side="right" />
            <SnappedMediaSidebar />
          </>
        )}
        <AnimatePresence mode="wait">
          {searchSidebarOpen ? (
            <SearchSidebar key="search" />
          ) : (
            !isHomeMode && !isServerOffline && memberListVisible && <MemberList key="members" />
          )}
        </AnimatePresence>
      </div>
      <SetupWizard />
      <AddServerModal />
      <LeaveServerModal />
      <ServerJoinModal />
      <CentralSignInModal />
      <AddAccountModal />
      <IncomingCallOverlay />
      <FloatingMediaWindow />
      <NotificationToast />
      <NotificationPrompt />
      <ToastContainer />
      <Suspense>
        <UserProfileModal />
        <ServerSettings />
        <ChannelSettingsModal />
        <UserSettingsModal />
        <ActiveCallOverlay />
        <ImageLightbox />
      </Suspense>
    </div>
  );
}
