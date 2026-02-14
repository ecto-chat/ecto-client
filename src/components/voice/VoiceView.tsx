import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '../../stores/voice.js';
import { useAuthStore } from '../../stores/auth.js';
import { useMemberStore } from '../../stores/member.js';
import { useChannelStore } from '../../stores/channel.js';
import { useUiStore } from '../../stores/ui.js';
import { useVoice } from '../../hooks/useVoice.js';
import { Avatar } from '../common/Avatar.js';
import { DeviceSelector } from '../common/DeviceSelector.js';
import { QualitySelector } from '../common/QualitySelector.js';

interface MediaStats {
  resolution: string;
  frameRate: number;
  codec: string;
  bitrate: number;
  packetsLost: number;
  jitter: number;
  timestamp: number;
}

function useMediaStats(userId: string, source: 'video' | 'screen', active: boolean): MediaStats | null {
  const [stats, setStats] = useState<MediaStats | null>(null);
  const prevRef = useRef<{ bytes: number; ts: number } | null>(null);

  useEffect(() => {
    if (!active) {
      setStats(null);
      prevRef.current = null;
      return;
    }

    const interval = setInterval(async () => {
      const store = useVoiceStore.getState();
      const myUserId = useAuthStore.getState().user?.id;
      const isLocal = userId === myUserId;

      let resolution = '';
      let frameRate = 0;
      let codec = '';
      let totalBytes = 0;
      let packetsLost = 0;
      let jitter = 0;
      let ts = 0;

      if (isLocal) {
        const producerKey = source === 'screen' ? 'screen' : 'video';
        const producer = store.producers.get(producerKey);
        if (!producer || producer.closed) return;

        // Use track.getSettings() for reliable local resolution/fps
        const settings = producer.track?.getSettings();
        if (settings) {
          resolution = `${settings.width ?? 0}x${settings.height ?? 0}`;
          frameRate = Math.round(settings.frameRate ?? 0);
        }

        const rtcStats = await producer.getStats();
        // Sum bytesSent across all outbound-rtp entries (simulcast has multiple)
        for (const report of rtcStats.values()) {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            totalBytes += (report.bytesSent ?? 0) as number;
            ts = report.timestamp;
            if (!codec && report.codecId) {
              const codecReport = rtcStats.get(report.codecId);
              if (codecReport) codec = (codecReport.mimeType as string)?.replace('video/', '') ?? '';
            }
          }
        }
      } else {
        // Find consumer for this user + source
        let rtcStats: RTCStatsReport | undefined;
        for (const [cid, meta] of store.consumerMeta.entries()) {
          if (meta.userId === userId && ((source === 'screen' && meta.source === 'screen') || (source === 'video' && meta.source !== 'screen' && meta.source !== 'mic'))) {
            const consumer = store.consumers.get(cid);
            if (consumer && !consumer.closed) {
              rtcStats = await consumer.getStats();
            }
            break;
          }
        }
        if (!rtcStats) return;

        for (const report of rtcStats.values()) {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            resolution = `${report.frameWidth ?? 0}x${report.frameHeight ?? 0}`;
            frameRate = Math.round(report.framesPerSecond ?? 0);
            totalBytes = report.bytesReceived ?? 0;
            packetsLost = report.packetsLost ?? 0;
            jitter = report.jitter ?? 0;
            ts = report.timestamp;
            if (report.codecId) {
              const codecReport = rtcStats.get(report.codecId);
              if (codecReport) codec = (codecReport.mimeType as string)?.replace('video/', '') ?? '';
            }
          }
        }
      }

      if (!ts) return;

      let bitrate = 0;
      if (prevRef.current && ts > prevRef.current.ts) {
        const dtSec = (ts - prevRef.current.ts) / 1000;
        bitrate = Math.round(((totalBytes - prevRef.current.bytes) * 8) / dtSec / 1000);
      }
      prevRef.current = { bytes: totalBytes, ts };

      setStats({ resolution, frameRate, codec, bitrate, packetsLost, jitter, timestamp: ts });
    }, 1000);

    return () => clearInterval(interval);
  }, [userId, source, active]);

  return stats;
}

function StatsOverlay({ userId, source, label }: { userId: string; source: 'video' | 'screen'; label: string }) {
  const [visible, setVisible] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const stats = useMediaStats(userId, source, visible);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!menuPos) return;
    const handler = () => setMenuPos(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [menuPos]);

  return (
    <>
      <div
        className="stats-overlay-container"
        onContextMenu={handleContextMenu}
      />
      {menuPos && createPortal(
        <div
          className="stats-context-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            className="stats-context-menu-item"
            onClick={() => { setVisible((v) => !v); setMenuPos(null); }}
          >
            {visible ? 'Hide Stats' : 'Show Stats'}
          </button>
        </div>,
        document.body,
      )}
      {visible && stats && createPortal(
        <div className="stats-overlay">
          <div className="stats-overlay-header">
            <span>{label} — {source === 'screen' ? 'Screen' : 'Camera'}</span>
            <button className="stats-overlay-close" onClick={() => setVisible(false)}>&#10005;</button>
          </div>
          <div className="stats-overlay-row">
            <span className="stats-label">Resolution</span>
            <span className="stats-value">{stats.resolution}@{stats.frameRate}</span>
          </div>
          <div className="stats-overlay-row">
            <span className="stats-label">Codec</span>
            <span className="stats-value">{stats.codec || '—'}</span>
          </div>
          <div className="stats-overlay-row">
            <span className="stats-label">Bitrate</span>
            <span className="stats-value">{stats.bitrate >= 1000 ? `${(stats.bitrate / 1000).toFixed(1)} Mbps` : `${stats.bitrate} Kbps`}</span>
          </div>
          {stats.packetsLost > 0 && (
            <div className="stats-overlay-row">
              <span className="stats-label">Packets Lost</span>
              <span className="stats-value">{stats.packetsLost}</span>
            </div>
          )}
          {stats.jitter > 0 && (
            <div className="stats-overlay-row">
              <span className="stats-label">Jitter</span>
              <span className="stats-value">{(stats.jitter * 1000).toFixed(1)} ms</span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/** Find audio elements for a user's consumers by source type */
function getAudioElements(userId: string, source: 'mic' | 'screen-audio'): HTMLAudioElement[] {
  const store = useVoiceStore.getState();
  const elements: HTMLAudioElement[] = [];
  for (const [cid, meta] of store.consumerMeta.entries()) {
    if (meta.userId === userId && meta.source === source) {
      const el = document.querySelector(`audio[data-consumer-id="${cid}"]`) as HTMLAudioElement | null;
      if (el) elements.push(el);
    }
  }
  return elements;
}

function VolumeControl({
  userId,
  source,
  className,
}: {
  userId: string;
  source: 'mic' | 'screen-audio';
  className?: string;
}) {
  const storageKey = `ecto-volume:${source}:${userId}`;
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [preMuteVolume, setPreMuteVolume] = useState(1);
  const myUserId = useAuthStore((s) => s.user?.id);
  const producers = useVoiceStore((s) => s.producers);
  const { toggleScreenAudioMute } = useVoice();

  const isMuted = volume === 0;
  const isOwner = userId === myUserId;

  const applyVolume = useCallback((v: number) => {
    const els = getAudioElements(userId, source);
    for (const el of els) {
      el.volume = v;
      el.muted = v === 0;
    }
    setVolume(v);
    localStorage.setItem(storageKey, String(v));
  }, [userId, source, storageKey]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOwner && source === 'screen-audio') {
      // Owner: pause/resume producer for everyone
      toggleScreenAudioMute(userId);
    }
    if (isMuted) {
      applyVolume(preMuteVolume || 1);
    } else {
      setPreMuteVolume(volume);
      applyVolume(0);
    }
  }, [isMuted, volume, preMuteVolume, applyVolume, isOwner, source, toggleScreenAudioMute, userId]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = parseFloat(e.target.value);
    applyVolume(v);
  }, [applyVolume]);

  // Apply stored volume when consumers appear
  useEffect(() => {
    if (volume !== 1) applyVolume(volume);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const icon = isMuted ? '\u{1F507}' : volume < 0.5 ? '\u{1F509}' : '\u{1F50A}';

  return (
    <div className={`volume-control ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="volume-slider-popup">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleSliderChange}
          className="volume-slider"
        />
        <span className="volume-pct">{Math.round(volume * 100)}%</span>
      </div>
      <button className="volume-icon-btn" onClick={handleMuteToggle} title={isMuted ? 'Unmute' : 'Mute'}>
        {icon}
      </button>
    </div>
  );
}

function ScreenAudioControl({ userId }: { userId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const producers = useVoiceStore((s) => s.producers);
  const consumerMeta = useVoiceStore((s) => s.consumerMeta);

  const isOwner = userId === myUserId;
  let hasScreenAudio = false;
  if (isOwner) {
    hasScreenAudio = producers.has('screen-audio');
  } else {
    for (const meta of consumerMeta.values()) {
      if (meta.userId === userId && meta.source === 'screen-audio') {
        hasScreenAudio = true;
        break;
      }
    }
  }

  if (!hasScreenAudio) return null;

  return <VolumeControl userId={userId} source="screen-audio" className="screen-volume" />;
}

function UserVolumeControl({ userId }: { userId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const consumerMeta = useVoiceStore((s) => s.consumerMeta);

  // Don't show volume control for self
  if (userId === myUserId) return null;

  // Check if this user has a mic consumer
  let hasMicAudio = false;
  for (const meta of consumerMeta.values()) {
    if (meta.userId === userId && meta.source === 'mic') {
      hasMicAudio = true;
      break;
    }
  }

  if (!hasMicAudio) return null;

  return <VolumeControl userId={userId} source="mic" className="user-volume" />;
}

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

// DeviceSelector and QualitySelector imported from ../common/

export function VoiceView() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channel = useChannelStore((s) =>
    activeServerId ? s.channels.get(activeServerId)?.get(activeChannelId ?? '') : undefined,
  );
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);
  const videoStreams = useVoiceStore((s) => s.videoStreams);
  const screenStreams = useVoiceStore((s) => s.screenStreams);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const producers = useVoiceStore((s) => s.producers);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const members = useMemberStore((s) =>
    activeServerId ? s.members.get(activeServerId) : undefined,
  );

  const {
    selfMuted,
    selfDeafened,
    pendingTransfer,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    switchAudioDevice,
    switchAudioOutput,
    switchVideoDevice,
    confirmTransfer,
    cancelTransfer,
  } = useVoice();

  const [deviceMenu, setDeviceMenu] = useState<'audio' | 'video' | 'output' | 'video-quality' | 'screen-quality' | null>(null);

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
              const screenStream = screenStreams.get(p.user_id);

              const handleCardClick = () => {
                if (!activeServerId) return;
                useUiStore.getState().openModal('user-profile', { userId: p.user_id, serverId: activeServerId });
              };

              return (
                <div key={p.user_id} className="voice-card-wrapper">
                  <div
                    className={`voice-card ${isSpeaking ? 'speaking' : ''} ${videoStream ? 'has-video' : ''}`}
                    onClick={handleCardClick}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {videoStream ? (
                      <>
                        <VideoRenderer stream={videoStream} />
                        <StatsOverlay userId={p.user_id} source="video" label={displayName} />
                      </>
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
                    <UserVolumeControl userId={p.user_id} />
                  </div>
                  {screenStream && (
                    <div className="voice-card-screen" style={{ position: 'relative' }}>
                      <VideoRenderer stream={screenStream} />
                      <StatsOverlay userId={p.user_id} source="screen" label={displayName} />
                      <ScreenAudioControl userId={p.user_id} />
                      <span className="voice-card-screen-label">{displayName}'s screen</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="voice-view-bar">
        {pendingTransfer && (
          <div className="voice-transfer-confirm">
            <p>
              {pendingTransfer.currentChannelId === 'call'
                ? "You're in a call. End call and join voice?"
                : pendingTransfer.sameSession
                  ? 'Switch voice channel?'
                  : "You're connected on another session. Transfer here?"}
            </p>
            <div className="voice-transfer-actions">
              <button onClick={cancelTransfer} className="btn-secondary">Cancel</button>
              <button onClick={confirmTransfer} className="auth-button">
                {pendingTransfer.currentChannelId === 'call' ? 'End Call & Join' : 'Transfer'}
              </button>
            </div>
          </div>
        )}
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

            <div className="voice-bar-group">
              <button
                className={`voice-bar-btn ${selfDeafened ? 'active' : ''}`}
                onClick={toggleDeafen}
                title={selfDeafened ? 'Undeafen' : 'Deafen'}
              >
                {selfDeafened ? '\u{1F508}' : '\u{1F50A}'}
              </button>
              <button
                className="voice-bar-device-btn"
                onClick={() => setDeviceMenu(deviceMenu === 'output' ? null : 'output')}
                title="Select audio output"
              >
                &#9650;
              </button>
              {deviceMenu === 'output' && (
                <DeviceSelector kind="audiooutput" onClose={() => setDeviceMenu(null)} onSelect={switchAudioOutput} />
              )}
            </div>

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
              <button
                className="voice-bar-device-btn"
                onClick={() => setDeviceMenu(deviceMenu === 'video-quality' ? null : 'video-quality')}
                title="Camera quality"
              >
                &#9881;
              </button>
              {deviceMenu === 'video' && (
                <DeviceSelector kind="videoinput" onClose={() => setDeviceMenu(null)} onSelect={switchVideoDevice} />
              )}
              {deviceMenu === 'video-quality' && (
                <QualitySelector kind="video" onClose={() => setDeviceMenu(null)} />
              )}
            </div>

            <div className="voice-bar-group">
              <button
                className={`voice-bar-btn ${producers.has('screen') ? 'screen-active' : ''}`}
                onClick={toggleScreenShare}
                title={producers.has('screen') ? 'Stop Screen Share' : 'Share Screen'}
              >
                &#128187;
              </button>
              <button
                className="voice-bar-device-btn"
                onClick={() => setDeviceMenu(deviceMenu === 'screen-quality' ? null : 'screen-quality')}
                title="Screen share quality"
              >
                &#9881;
              </button>
              {deviceMenu === 'screen-quality' && (
                <QualitySelector kind="screen" onClose={() => setDeviceMenu(null)} />
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
