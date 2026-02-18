/**
 * Shared media utility functions used by both useVoice and useCall hooks.
 */

/** Detect speaking activity on an audio stream. Returns a cleanup function. */
export function startSpeakingDetection(
  stream: MediaStream,
  onSpeaking: (speaking: boolean) => void,
  onAudioLevel?: (level: number) => void,
): () => void {
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

    // Emit normalized audio level (0-1) when speaking
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
}

/** Switch audio output device on one or more audio/video elements. */
export async function switchAudioOutputDevice(
  elements: Iterable<HTMLAudioElement | HTMLVideoElement>,
  deviceId: string,
): Promise<void> {
  for (const el of elements) {
    if ('setSinkId' in el) {
      await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId).catch(() => {});
    }
  }
}

/** Get audio stream from user's microphone, respecting a saved device preference. */
export async function getAudioStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  });
}

/** Get video stream from user's camera with quality preset constraints. */
export async function getVideoStream(
  constraints: MediaTrackConstraints,
  deviceId?: string,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { ...constraints, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
  });
}
