let audioContext: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export type RingtoneHandle = { stop: () => void };

/**
 * Play a fun melodic ringtone for incoming calls.
 * A bright ascending arpeggio (C5→E5→G5→C6) that repeats every 2.5s.
 */
export function playIncomingRingtone(): RingtoneHandle {
  const ctx = getCtx();
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

    timerId = setTimeout(() => {
      activeNodes.length = 0;
      playPattern();
    }, 2500);
  }

  playPattern();

  return {
    stop() {
      stopped = true;
      if (timerId !== null) clearTimeout(timerId);
      for (const node of activeNodes) {
        try {
          if (node instanceof OscillatorNode) node.stop();
        } catch { /* already stopped */ }
      }
      activeNodes.length = 0;
    },
  };
}

/**
 * Play a gentle ringback tone for the outgoing caller.
 * Two soft ascending notes (G4→B4) repeating every 3s.
 */
export function playOutgoingRingback(): RingtoneHandle {
  const ctx = getCtx();
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

    timerId = setTimeout(() => {
      activeNodes.length = 0;
      playRing();
    }, 3000);
  }

  playRing();

  return {
    stop() {
      stopped = true;
      if (timerId !== null) clearTimeout(timerId);
      for (const node of activeNodes) {
        try {
          if (node instanceof OscillatorNode) node.stop();
        } catch { /* already stopped */ }
      }
      activeNodes.length = 0;
    },
  };
}
