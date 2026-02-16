const STORAGE_KEY = 'ecto-notification-settings';

type SoundType = 'message' | 'mention' | 'dm';

interface NotificationPrefs {
  enabled: boolean;
  soundEnabled: boolean;
}

function getPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as NotificationPrefs;
  } catch {
    // ignore
  }
  return { enabled: true, soundEnabled: true };
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Synthesize a short notification tone using the Web Audio API.
 * Different tones for different event types.
 */
function synthesize(type: SoundType) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.connect(gain);

  switch (type) {
    case 'message':
      // Single short ping
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'mention':
      // Two-tone ping (more urgent)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1100, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;

    case 'dm':
      // Softer two-tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;
  }
}

/**
 * Play a notification sound if the user has sounds enabled.
 */
export function playNotificationSound(type: SoundType = 'message') {
  const prefs = getPrefs();
  if (!prefs.enabled || !prefs.soundEnabled) return;

  try {
    synthesize(type);
  } catch {
    // AudioContext may not be available
  }
}
