import { preferenceManager } from '../services/preference-manager.js';

export type SoundType = 'message' | 'mention' | 'dm';

interface NotificationPrefs {
  enabled: boolean;
  soundEnabled: boolean;
  selectedSounds?: { message: string; mention: string; dm: string };
}

function getPrefs(): NotificationPrefs {
  return preferenceManager.getUser<NotificationPrefs>('notification-settings', { enabled: true, soundEnabled: true });
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

type SynthesizeFn = (ctx: AudioContext) => void;

interface SoundVariant {
  id: string;
  name: string;
  synthesize: Record<SoundType, SynthesizeFn>;
}

function createTone(freq: number, duration: number, volume: number, waveform: OscillatorType = 'triangle'): SynthesizeFn {
  return (ctx) => {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.connect(gain);
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  };
}

function createDualTone(freq1: number, freq2: number, gap: number, duration: number, volume: number, waveform: OscillatorType = 'triangle'): SynthesizeFn {
  return (ctx) => {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.connect(gain);
    osc.frequency.setValueAtTime(freq1, now);
    osc.frequency.setValueAtTime(freq2, now + gap);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  };
}

export const SOUND_LIBRARY: SoundVariant[] = [
  {
    id: 'default',
    name: 'Default',
    synthesize: {
      message: createTone(880, 0.15, 0.15),
      mention: createDualTone(880, 1100, 0.1, 0.25, 0.18),
      dm: createDualTone(660, 880, 0.12, 0.25, 0.12, 'sine'),
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    synthesize: {
      message: createTone(523, 0.2, 0.1, 'sine'),
      mention: createDualTone(523, 659, 0.15, 0.3, 0.12, 'sine'),
      dm: createDualTone(440, 523, 0.12, 0.28, 0.08, 'sine'),
    },
  },
  {
    id: 'bright',
    name: 'Bright',
    synthesize: {
      message: createTone(1047, 0.12, 0.14),
      mention: createDualTone(1047, 1319, 0.08, 0.2, 0.16),
      dm: createDualTone(784, 1047, 0.1, 0.22, 0.12),
    },
  },
  {
    id: 'chime',
    name: 'Chime',
    synthesize: {
      message: createTone(698, 0.25, 0.12, 'sine'),
      mention: createDualTone(698, 880, 0.12, 0.35, 0.15, 'sine'),
      dm: createDualTone(587, 698, 0.15, 0.3, 0.1, 'sine'),
    },
  },
  {
    id: 'sharp',
    name: 'Sharp',
    synthesize: {
      message: createTone(1175, 0.08, 0.16, 'square'),
      mention: createDualTone(1175, 1397, 0.06, 0.15, 0.14, 'square'),
      dm: createDualTone(988, 1175, 0.08, 0.18, 0.1, 'square'),
    },
  },
];

function getSoundVariant(soundId: string): SoundVariant {
  return SOUND_LIBRARY.find((s) => s.id === soundId) ?? SOUND_LIBRARY[0]!;
}

/**
 * Play a specific sound variant for a given event type.
 */
export function playSoundVariant(soundId: string, type: SoundType) {
  try {
    const ctx = getAudioContext();
    const variant = getSoundVariant(soundId);
    variant.synthesize[type](ctx);
  } catch {
    // AudioContext may not be available
  }
}

/**
 * Play a notification sound if the user has sounds enabled.
 * Uses the user's selected sound variant for the given event type.
 */
export function playNotificationSound(type: SoundType = 'message') {
  const prefs = getPrefs();
  if (!prefs.enabled || !prefs.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const soundId = prefs.selectedSounds?.[type] ?? 'default';
    const variant = getSoundVariant(soundId);
    variant.synthesize[type](ctx);
  } catch {
    // AudioContext may not be available
  }
}
