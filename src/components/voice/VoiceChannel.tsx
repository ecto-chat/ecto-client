import { useNavigate } from 'react-router-dom';
import { useVoice } from '../../hooks/useVoice.js';
import { useVoiceStore } from '../../stores/voice.js';
import { useUiStore } from '../../stores/ui.js';
import { useMemberStore } from '../../stores/member.js';
import { Avatar } from '../common/Avatar.js';
import type { Channel } from 'ecto-shared';

interface VoiceChannelProps {
  channel: Channel;
  isActive?: boolean;
}

export function VoiceChannel({ channel, isActive }: VoiceChannelProps) {
  const { joinVoice, isInVoice, currentChannelId } = useVoice();
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const members = useMemberStore((s) => (activeServerId ? s.members.get(activeServerId) : undefined));
  const navigate = useNavigate();

  const isConnected = currentChannelId === channel.id;

  // Get participants in this voice channel
  const channelParticipants = [...participants.values()].filter(
    (p) => p.channel_id === channel.id,
  );

  const handleClick = () => {
    if (!activeServerId) return;
    useUiStore.getState().setActiveChannel(channel.id);
    navigate(`/servers/${activeServerId}/channels/${channel.id}`);
  };

  return (
    <div className={`voice-channel ${isConnected ? 'connected' : ''} ${isActive ? 'active' : ''}`}>
      <div className="voice-channel-header" onClick={handleClick}>
        <span className="channel-prefix">&#128266;</span>
        <span className="channel-name">{channel.name}</span>
      </div>

      {channelParticipants.length > 0 && (
        <div className="voice-channel-users">
          {channelParticipants.map((p) => {
            const member = members?.get(p.user_id);
            const isSpeaking = speaking.has(p.user_id);

            return (
              <div
                key={p.user_id}
                className={`voice-user ${isSpeaking ? 'speaking' : ''}`}
              >
                <Avatar
                  src={member?.avatar_url}
                  username={member?.display_name ?? member?.username ?? '?'}
                  size={24}
                />
                <span className="voice-user-name">
                  {member?.display_name ?? member?.username ?? 'Unknown'}
                </span>
                {p.self_mute && <span className="voice-user-muted" title="Muted">&#128263;</span>}
                {p.self_deaf && <span className="voice-user-deaf" title="Deafened">&#128264;</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
