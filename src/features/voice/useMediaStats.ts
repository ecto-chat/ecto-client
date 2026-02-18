import { useEffect, useRef, useState } from 'react';

import { useVoiceStore } from '@/stores/voice';
import { useAuthStore } from '@/stores/auth';

export type MediaStats = {
  resolution: string;
  frameRate: number;
  codec: string;
  bitrate: number;
  packetsLost: number;
  jitter: number;
  timestamp: number;
};

export function useMediaStats(
  userId: string,
  source: 'video' | 'screen',
  active: boolean,
): MediaStats | null {
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

        const settings = producer.track?.getSettings();
        if (settings) {
          resolution = `${settings.width ?? 0}x${settings.height ?? 0}`;
          frameRate = Math.round(settings.frameRate ?? 0);
        }

        const rtcStats = await producer.getStats();
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
        let rtcStats: RTCStatsReport | undefined;
        for (const [cid, meta] of store.consumerMeta.entries()) {
          if (
            meta.userId === userId &&
            ((source === 'screen' && meta.source === 'screen') ||
              (source === 'video' && meta.source !== 'screen' && meta.source !== 'mic'))
          ) {
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
