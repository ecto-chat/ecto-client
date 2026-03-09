/**
 * Web/Electron platform implementation for ecto-core.
 *
 * Provides browser-native implementations of all Platform interfaces:
 * localStorage, WebSocket, Notification, AudioContext, etc.
 */

import type {
  Platform,
  PlatformStorage,
  PlatformSecureStorage,
  PlatformWebSocketFactory,
  PlatformVisibility,
  PlatformNotification,
  PlatformAudio,
  PlatformMediaAudio,
  PlatformConfig,
  PlatformConcurrency,
  PlatformNetwork,
  AudioSink,
} from 'ecto-core';

// ── Storage ──────────────────────────────────────────────

const webStorage: PlatformStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
  keys: () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) keys.push(k);
    }
    return keys;
  },
};

// ── Secure Storage ───────────────────────────────────────

const webSecureStorage: PlatformSecureStorage = {
  get: async (key) => localStorage.getItem(key),
  set: async (key, value) => localStorage.setItem(key, value),
  delete: async (key) => localStorage.removeItem(key),
  deleteByPrefix: async (prefix) => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  },
};

// ── WebSocket Factory ────────────────────────────────────

const webWsFactory: PlatformWebSocketFactory = {
  create: (url) => new WebSocket(url) as unknown as ReturnType<PlatformWebSocketFactory['create']>,
};

// ── Visibility ───────────────────────────────────────────

const webVisibility: PlatformVisibility = {
  onVisibilityChange: (callback) => {
    const handler = () => callback(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
  isVisible: () => document.visibilityState === 'visible',
  hasFocus: () => document.hasFocus(),
};

// ── Notifications ────────────────────────────────────────

const webNotification: PlatformNotification = {
  show: (title, body, data) => {
    if (document.hasFocus()) return;

    if (window.electronAPI) {
      window.electronAPI.notifications.showNotification(title, body, data);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, { body, tag: data?.type ?? 'ecto' });
      n.onclick = () => {
        window.focus();
        if (data && notificationClickHandler) {
          notificationClickHandler(data);
        }
      };
    }
  },
  onNotificationClick: (handler) => {
    notificationClickHandler = handler;

    // Wire up Electron IPC if available
    let electronCleanup: (() => void) | undefined;
    if (window.electronAPI) {
      electronCleanup = window.electronAPI.notifications.onNotificationClick(handler);
    }

    return () => {
      notificationClickHandler = null;
      electronCleanup?.();
    };
  },
  requestPermission: async () => {
    if (window.electronAPI) return true;
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },
};

let notificationClickHandler: ((data: Record<string, string>) => void) | null = null;

// ── Audio (notification sounds + ringtones) ──────────────

type SynthesizeFn = (ctx: AudioContext) => void;
type OscType = OscillatorType;

function createTone(freq: number, duration: number, volume: number, waveform: OscType = 'triangle'): SynthesizeFn {
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

function createDualTone(freq1: number, freq2: number, gap: number, duration: number, volume: number, waveform: OscType = 'triangle'): SynthesizeFn {
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

const SOUND_SYNTHS: Record<string, Record<string, SynthesizeFn>> = {
  default: {
    message: createTone(880, 0.15, 0.15),
    mention: createDualTone(880, 1100, 0.1, 0.25, 0.18),
    dm: createDualTone(660, 880, 0.12, 0.25, 0.12, 'sine'),
  },
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

interface RingtoneHandle { stop: () => void }
let activeRingtone: RingtoneHandle | null = null;

function playIncomingRingtone(): RingtoneHandle {
  const ctx = getAudioCtx();
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const activeNodes: AudioNode[] = [];

  const melody = [523.25, 659.25, 783.99, 1046.50];
  const noteDur = 0.13;
  const noteGap = 0.07;

  function playPattern() {
    if (stopped) return;
    const now = ctx.currentTime;
    for (let i = 0; i < melody.length; i++) {
      const t = now + i * (noteDur + noteGap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = melody[i]!;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
      gain.gain.setValueAtTime(0.15, t + noteDur - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + noteDur + 0.01);
      activeNodes.push(osc, gain);
    }
    timerId = setTimeout(() => { activeNodes.length = 0; playPattern(); }, 2500);
  }

  playPattern();

  return {
    stop() {
      stopped = true;
      if (timerId !== null) clearTimeout(timerId);
      for (const node of activeNodes) {
        try { if (node instanceof OscillatorNode) node.stop(); } catch { /* already stopped */ }
      }
      activeNodes.length = 0;
    },
  };
}

function playOutgoingRingback(): RingtoneHandle {
  const ctx = getAudioCtx();
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const activeNodes: AudioNode[] = [];

  function playRing() {
    if (stopped) return;
    const now = ctx.currentTime;
    const tones = [392, 493.88];
    for (let i = 0; i < tones.length; i++) {
      const t = now + i * 0.3;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tones[i]!;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.setValueAtTime(0.1, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
      activeNodes.push(osc, gain);
    }
    timerId = setTimeout(() => { activeNodes.length = 0; playRing(); }, 3000);
  }

  playRing();

  return {
    stop() {
      stopped = true;
      if (timerId !== null) clearTimeout(timerId);
      for (const node of activeNodes) {
        try { if (node instanceof OscillatorNode) node.stop(); } catch { /* already stopped */ }
      }
      activeNodes.length = 0;
    },
  };
}

const webAudio: PlatformAudio = {
  playSound: (name) => {
    try {
      if (name === 'call') {
        activeRingtone?.stop();
        activeRingtone = playIncomingRingtone();
        return;
      }
      if (name === 'ringtone') {
        activeRingtone?.stop();
        activeRingtone = playOutgoingRingback();
        return;
      }
      const ctx = getAudioCtx();
      const synths = SOUND_SYNTHS['default']!;
      const fn = synths[name];
      if (fn) fn(ctx);
    } catch { /* AudioContext may not be available */ }
  },
  stopSound: () => {
    activeRingtone?.stop();
    activeRingtone = null;
  },
};

// ── Media Audio (voice/call audio playback + speaking detection) ──

const audioSinks = new Map<string, WebAudioSink>();

class WebAudioSink implements AudioSink {
  private el: HTMLAudioElement;

  constructor(public readonly id: string) {
    this.el = document.createElement('audio');
    this.el.autoplay = true;
    this.el.setAttribute('data-sink-id', id);
    // Append off-screen so it plays
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  play(stream: MediaStream): void {
    this.el.srcObject = stream;
    this.el.play().catch(() => {});
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if ('setSinkId' in this.el) {
      await (this.el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId).catch(() => {});
    }
  }

  destroy(): void {
    this.el.srcObject = null;
    this.el.remove();
  }
}

const webMediaAudio: PlatformMediaAudio = {
  createAudioSink: (id) => {
    const existing = audioSinks.get(id);
    if (existing) return existing;
    const sink = new WebAudioSink(id);
    audioSinks.set(id, sink);
    return sink;
  },
  getAudioSink: (id) => audioSinks.get(id) ?? null,
  removeAudioSink: (id) => {
    const sink = audioSinks.get(id);
    if (sink) {
      sink.destroy();
      audioSinks.delete(id);
    }
  },
  removeAllAudioSinks: () => {
    Array.from(audioSinks.values()).forEach((sink) => sink.destroy());
    audioSinks.clear();
  },
  startSpeakingDetection: (stream, onSpeaking, onAudioLevel) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;
      const THRESHOLD = 15;

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]!;
        const avg = sum / data.length;
        const isSpeaking = avg > THRESHOLD;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          onSpeaking(isSpeaking);
        }

        if (onAudioLevel) {
          const normalized = isSpeaking ? Math.min(avg / 80, 1) : 0;
          onAudioLevel(normalized);
        }
      }, 100);

      return () => {
        clearInterval(interval);
        source.disconnect();
        audioCtx.close().catch(() => {});
      };
    } catch {
      return () => {};
    }
  },
  switchOutputDevice: async (deviceId) => {
    const sinks = Array.from(audioSinks.values());
    for (let i = 0; i < sinks.length; i++) {
      await sinks[i]!.setOutputDevice(deviceId);
    }
  },
};

// ── Config ───────────────────────────────────────────────

const webConfig: PlatformConfig = {
  centralUrl: import.meta.env.VITE_CENTRAL_URL ?? '',
  isDev: import.meta.env.DEV ?? false,
  gatewayUrl: import.meta.env.VITE_GATEWAY_URL,
  klipyApiKey: import.meta.env.VITE_KLIPY_APP_KEY,
};

// ── Concurrency ──────────────────────────────────────────

const broadcastChannels = new Map<string, BroadcastChannel>();

const webConcurrency: PlatformConcurrency = {
  withLock: async (name, fn) => {
    if ('locks' in navigator) {
      return navigator.locks.request(name, fn);
    }
    // Fallback: just run directly (single tab / no support)
    return fn();
  },
  broadcast: (channel, data) => {
    try {
      let bc = broadcastChannels.get(channel);
      if (!bc) {
        bc = new BroadcastChannel(channel);
        broadcastChannels.set(channel, bc);
      }
      bc.postMessage(data);
    } catch { /* BroadcastChannel not supported */ }
  },
  onBroadcast: (channel, handler) => {
    try {
      const bc = new BroadcastChannel(channel);
      bc.onmessage = (ev) => handler(ev.data);
      return () => bc.close();
    } catch {
      return () => {};
    }
  },
};

// ── Network ──────────────────────────────────────────────

const webNetwork: PlatformNetwork = {
  onOnline: (callback) => {
    window.addEventListener('online', callback);
    return () => window.removeEventListener('online', callback);
  },
};

// ── Aggregate ────────────────────────────────────────────

export function createWebPlatform(): Platform {
  return {
    storage: webStorage,
    secureStorage: webSecureStorage,
    wsFactory: webWsFactory,
    visibility: webVisibility,
    notification: webNotification,
    audio: webAudio,
    mediaAudio: webMediaAudio,
    config: webConfig,
    concurrency: webConcurrency,
    network: webNetwork,
    base64Decode: (encoded) => atob(encoded),
  };
}
