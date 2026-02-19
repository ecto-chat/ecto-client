import { useNavigate } from 'react-router-dom';

import { Volume2, MicOff, VolumeX, Settings } from 'lucide-react';
import { Permissions } from 'ecto-shared';

import { Avatar, Button } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useUiStore } from '@/stores/ui';
import { useMemberStore } from '@/stores/member';
import { usePermissions } from '@/hooks/usePermissions';

import { cn } from '@/lib/cn';

import type { Channel } from 'ecto-shared';

type VoiceChannelProps = {
  channel: Channel;
  isActive?: boolean;
};

export function VoiceChannel({ channel, isActive }: VoiceChannelProps) {
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);
  const audioLevels = useVoiceStore((s) => s.audioLevels);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const members = useMemberStore((s) => (activeServerId ? s.members.get(activeServerId) : undefined));
  const { isAdmin, effectivePermissions } = usePermissions(activeServerId);
  const canManageChannels = isAdmin || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;
  const navigate = useNavigate();

  const isConnected = currentChannelId === channel.id;

  const channelParticipants = [...participants.values()].filter(
    (p) => p.channel_id === channel.id,
  );

  const handleClick = () => {
    if (!activeServerId) return;
    useUiStore.getState().setActiveChannel(channel.id);
    navigate(`/servers/${activeServerId}/channels/${channel.id}`);
  };

  return (
    <div
      className={cn(
        'group transition-colors duration-150',
        isConnected && 'bg-primary border-l-4 border-[#6f53ef]',
        !isConnected && isActive && 'bg-primary border-l-4 border-[#6f53ef]',
        !isConnected && !isActive && 'border-l-4 border-transparent',
      )}
    >
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 px-2 py-1.5 h-auto min-w-0',
            'text-sm text-secondary hover:text-primary hover:bg-primary rounded-none',
            'justify-start font-normal',
          )}
        >
          <Volume2 size={16} className="shrink-0 text-muted" />
          <span className="truncate font-medium">{channel.name}</span>
        </Button>
        {canManageChannels && (
          <span
            className="shrink-0 pr-2 text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-primary"
            title="Channel Settings"
            onClick={(e) => {
              e.stopPropagation();
              useUiStore.getState().setChannelSettingsId(channel.id);
            }}
          >
            <Settings size={14} />
          </span>
        )}
      </div>

      {channelParticipants.length > 0 && (
        <div className="flex flex-col gap-0.5 pb-1.5 pl-6 pr-2">
          {channelParticipants.map((p) => {
            const member = members?.get(p.user_id);
            const isSpeaking = speaking.has(p.user_id);

            const handleUserClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!activeServerId) return;
              useUiStore.getState().openModal('user-profile', {
                userId: p.user_id,
                serverId: activeServerId,
              });
            };

            return (
              <Button
                type="button"
                variant="ghost"
                key={p.user_id}
                className={cn(
                  'flex items-center gap-2 rounded-none px-1.5 py-1 h-auto',
                  'text-xs text-secondary hover:text-primary hover:bg-primary',
                  'justify-start font-normal',
                )}
                onClick={handleUserClick}
              >
                <div className="relative flex items-center justify-center">
                  <Avatar
                    src={member?.avatar_url}
                    username={member?.display_name ?? member?.username ?? '?'}
                    size={24}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-success transition-opacity duration-100"
                    style={{ margin: -2, opacity: isSpeaking ? 0.4 + (audioLevels.get(p.user_id) ?? 0) * 0.6 : 0 }}
                  />
                </div>
                <span className="truncate">
                  {member?.display_name ?? member?.username ?? 'Unknown'}
                </span>
                {p.self_mute && <MicOff size={14} className="shrink-0 text-muted" />}
                {p.self_deaf && <VolumeX size={14} className="shrink-0 text-muted" />}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
