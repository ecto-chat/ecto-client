import type { types as mediasoupTypes } from 'mediasoup-client';

export type VideoQuality = 'low' | 'medium' | 'high' | 'source';
export type ScreenQuality = 'low' | 'medium' | 'high' | 'source';

export const CAMERA_PRESETS: Record<VideoQuality, {
  constraints: MediaTrackConstraints;
  encodings: mediasoupTypes.RtpEncodingParameters[];
}> = {
  low: {
    constraints: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
    encodings: [{ maxBitrate: 500_000, maxFramerate: 15 }],
  },
  medium: {
    constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    encodings: [{ maxBitrate: 2_500_000, maxFramerate: 30 }],
  },
  high: {
    constraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    encodings: [{ maxBitrate: 6_000_000, maxFramerate: 30 }],
  },
  source: {
    constraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
    encodings: [{ maxBitrate: 12_000_000, maxFramerate: 60 }],
  },
};

export const SCREEN_PRESETS: Record<ScreenQuality, {
  constraints: DisplayMediaStreamOptions;
  encodings: mediasoupTypes.RtpEncodingParameters[];
  contentHint: 'detail' | 'motion';
}> = {
  low: {
    constraints: { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 10 } }, audio: true },
    encodings: [{ maxBitrate: 1_500_000, maxFramerate: 10 }],
    contentHint: 'detail',
  },
  medium: {
    constraints: { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true },
    encodings: [{ maxBitrate: 5_000_000, maxFramerate: 30 }],
    contentHint: 'detail',
  },
  high: {
    constraints: { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: true },
    encodings: [{ maxBitrate: 10_000_000, maxFramerate: 60 }],
    contentHint: 'motion',
  },
  source: {
    constraints: { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: true },
    encodings: [{ maxBitrate: 15_000_000, maxFramerate: 60 }],
    contentHint: 'motion',
  },
};

export function getVideoQuality(): VideoQuality {
  return (localStorage.getItem('ecto-video-quality') as VideoQuality) || 'medium';
}

export function getScreenQuality(): ScreenQuality {
  return (localStorage.getItem('ecto-screen-quality') as ScreenQuality) || 'high';
}

export function setVideoQuality(quality: VideoQuality): void {
  localStorage.setItem('ecto-video-quality', quality);
}

export function setScreenQuality(quality: ScreenQuality): void {
  localStorage.setItem('ecto-screen-quality', quality);
}

export const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: 'low', label: '360p' },
  { value: 'medium', label: '720p' },
  { value: 'high', label: '1080p' },
  { value: 'source', label: '1080p60' },
];

export const SCREEN_QUALITY_OPTIONS: { value: ScreenQuality; label: string }[] = [
  { value: 'low', label: '720p 5fps' },
  { value: 'medium', label: '1080p 10fps' },
  { value: 'high', label: '1080p 30fps' },
  { value: 'source', label: '1080p60 Source' },
];
