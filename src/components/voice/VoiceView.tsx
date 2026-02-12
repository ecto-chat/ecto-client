import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voice.js';
import { useMemberStore } from '../../stores/member.js';
import { useChannelStore } from '../../stores/channel.js';
import { useUiStore } from '../../stores/ui.js';
import { useVoice } from '../../hooks/useVoice.js';
import { Avatar } from '../common/Avatar.js';

function VideoRenderer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="voice-card-video"
    />
  );
}

function DeviceSelector({
  kind,
  onClose,
  onSelect,
}: {
  kind: 'audioinput' | 'videoinput';
  onClose: () => void;
  onSelect: (deviceId: string) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const storageKey = kind === 'audioinput' ? 'ecto-audio-device' : 'ecto-video-device';
  const selectedId = localStorage.getItem(storageKey);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setDevices(all.filter((d) => d.kind === kind));
    });
  }, [kind]);

  const handleSelect = (deviceId: string) => {
    localStorage.setItem(storageKey, deviceId);
    onSelect(deviceId);
    onClose();
  };

  return (
    <div className="device-selector">
      <div className="device-selector-header">
        {kind === 'audioinput' ? 'Audio Input' : 'Video Input'}
      </div>
      {devices.length === 0 ? (
        <div className="device-selector-empty">No devices found</div>
      ) : (
        devices.map((d) => {
          const isSelected = selectedId
            ? d.deviceId === selectedId
            : d.deviceId === 'default' || d.deviceId === '';

          return (
            <button
              key={d.deviceId}
              className={`device-selector-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(d.deviceId)}
            >
              {isSelected && <span className="device-check">&#10003;</span>}
              {d.label || `${kind === 'audioinput' ? 'Microphone' : 'Camera'} ${d.deviceId.slice(0, 8)}`}
            </button>
          );
        })
      )}
    </div>
  );
}

export function VoiceView() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channel = useChannelStore((s) =>
    activeServerId ? s.channels.get(activeServerId)?.get(activeChannelId ?? '') : undefined,
  );
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);
  const videoStreams = useVoiceStore((s) => s.videoStreams);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const members = useMemberStore((s) =>
    activeServerId ? s.members.get(activeServerId) : undefined,
  );

  const {
    selfMuted,
    selfDeafened,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    switchAudioDevice,
    switchVideoDevice,
  } = useVoice();

  const [deviceMenu, setDeviceMenu] = useState<'audio' | 'video' | null>(null);

  const isConnectedHere = currentChannelId === activeChannelId && voiceStatus !== 'disconnected';

  const channelParticipants = [...participants.values()].filter(
    (p) => p.channel_id === activeChannelId,
  );

  const handleJoin = useCallback(() => {
    if (!activeServerId || !activeChannelId) return;
    joinVoice(activeServerId, activeChannelId);
  }, [activeServerId, activeChannelId, joinVoice]);

  // Close device menu on outside click
  useEffect(() => {
    if (!deviceMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.device-selector') && !target.closest('.voice-bar-device-btn')) {
        setDeviceMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deviceMenu]);

  return (
    <div className="voice-view">
      <div className="voice-view-header">
        <span className="channel-header-prefix">&#128266;</span>
        <span className="channel-header-name">{channel?.name ?? 'Voice Channel'}</span>
      </div>

      <div className="voice-view-body">
        {channelParticipants.length === 0 ? (
          <div className="voice-view-empty">No one is in this voice channel</div>
        ) : (
          <div className="voice-view-grid">
            {channelParticipants.map((p) => {
              const member = members?.get(p.user_id);
              const isSpeaking = speaking.has(p.user_id);
              const displayName = member?.display_name ?? member?.username ?? 'Unknown';
              const videoStream = videoStreams.get(p.user_id);

              return (
                <div
                  key={p.user_id}
                  className={`voice-card ${isSpeaking ? 'speaking' : ''} ${videoStream ? 'has-video' : ''}`}
                >
                  {videoStream ? (
                    <VideoRenderer stream={videoStream} />
                  ) : (
                    <Avatar
                      src={member?.avatar_url}
                      username={displayName}
                      size={80}
                    />
                  )}
                  <span className="voice-card-name">{displayName}</span>
                  <div className="voice-card-icons">
                    {p.self_mute && <span title="Muted">&#128263;</span>}
                    {p.self_deaf && <span title="Deafened">&#128264;</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="voice-view-bar">
        {isConnectedHere ? (
          <div className="voice-bar-controls">
            <div className="voice-bar-group">
              <button
                className={`voice-bar-btn ${selfMuted ? 'active' : ''}`}
                onClick={toggleMute}
                title={selfMuted ? 'Unmute' : 'Mute'}
              >
                {selfMuted ? '\u{1F507}' : '\u{1F3A4}'}
              </button>
              <button
                className="voice-bar-device-btn"
                onClick={() => setDeviceMenu(deviceMenu === 'audio' ? null : 'audio')}
                title="Select audio device"
              >
                &#9650;
              </button>
              {deviceMenu === 'audio' && (
                <DeviceSelector kind="audioinput" onClose={() => setDeviceMenu(null)} onSelect={switchAudioDevice} />
              )}
            </div>

            <button
              className={`voice-bar-btn ${selfDeafened ? 'active' : ''}`}
              onClick={toggleDeafen}
              title={selfDeafened ? 'Undeafen' : 'Deafen'}
            >
              {selfDeafened ? '\u{1F508}' : '\u{1F50A}'}
            </button>

            <div className="voice-bar-group">
              <button
                className="voice-bar-btn"
                onClick={toggleCamera}
                title="Toggle Camera"
              >
                &#127909;
              </button>
              <button
                className="voice-bar-device-btn"
                onClick={() => setDeviceMenu(deviceMenu === 'video' ? null : 'video')}
                title="Select video device"
              >
                &#9650;
              </button>
              {deviceMenu === 'video' && (
                <DeviceSelector kind="videoinput" onClose={() => setDeviceMenu(null)} onSelect={switchVideoDevice} />
              )}
            </div>

            <button
              className="voice-bar-btn disconnect"
              onClick={leaveVoice}
              title="Leave Voice"
            >
              &#128222;
            </button>
          </div>
        ) : (
          <button
            className="voice-join-btn"
            onClick={handleJoin}
            disabled={voiceStatus === 'connecting'}
          >
            {voiceStatus === 'connecting' ? 'Connecting...' : 'Join Voice'}
          </button>
        )}
      </div>
    </div>
  );
}
