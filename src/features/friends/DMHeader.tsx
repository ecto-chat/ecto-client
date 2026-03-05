import { Pin, Search, Phone, Video } from 'lucide-react';

import { Avatar, IconButton } from '@/ui';

import { useUiStore } from '@/stores/ui';

import type { PresenceStatus } from 'ecto-shared';

type DMHeaderProps = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  status: PresenceStatus;
  pinsOpen: boolean;
  onTogglePins: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  isInCall: boolean;
};

export function DMHeader({
  userId,
  username,
  avatarUrl,
  status,
  pinsOpen,
  onTogglePins,
  onVoiceCall,
  onVideoCall,
  isInCall,
}: DMHeaderProps) {
  const searchActive = useUiStore((s) => s.searchSidebarOpen && s.searchContext?.type === 'dm');

  return (
    <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
      <Avatar src={avatarUrl} username={username} size={28} status={status} />
      <span className="text-sm font-medium text-primary">{username}</span>

      <div className="ml-auto flex items-center gap-1">
        <IconButton
          variant="ghost"
          size="sm"
          tooltip={pinsOpen ? 'Hide Pinned Messages' : 'Pinned Messages'}
          onClick={onTogglePins}
          className={pinsOpen ? 'text-accent' : undefined}
        >
          <Pin size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="Search Messages"
          onClick={() => {
            if (searchActive) {
              useUiStore.getState().closeSearchSidebar();
            } else {
              useUiStore.getState().openSearchSidebar({ type: 'dm', userId });
            }
          }}
          className={searchActive ? 'text-accent' : undefined}
        >
          <Search size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip={isInCall ? 'Already in a call' : 'Voice Call'}
          disabled={isInCall}
          onClick={onVoiceCall}
        >
          <Phone size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip={isInCall ? 'Already in a call' : 'Video Call'}
          disabled={isInCall}
          onClick={onVideoCall}
        >
          <Video size={16} />
        </IconButton>
      </div>
    </div>
  );
}
