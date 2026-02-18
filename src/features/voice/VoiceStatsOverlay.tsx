import { useCallback, useState } from 'react';

import { BarChart3, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { IconButton, Tooltip } from '@/ui';

import { cn } from '@/lib/cn';

import { useMediaStats } from './useMediaStats';

type VoiceStatsOverlayProps = {
  userId: string;
  source: 'video' | 'screen';
  label: string;
};

export function VoiceStatsOverlay({ userId, source, label }: VoiceStatsOverlayProps) {
  const [visible, setVisible] = useState(false);
  const stats = useMediaStats(userId, source, visible);

  const toggle = useCallback(() => setVisible((v) => !v), []);

  return (
    <>
      <div className="absolute bottom-1 right-1 z-10">
        <Tooltip content={visible ? 'Hide Stats' : 'Show Stats'} side="left">
          <IconButton size="sm" variant="ghost" onClick={toggle} className="bg-black/40 text-white hover:bg-black/60">
            <BarChart3 size={14} />
          </IconButton>
        </Tooltip>
      </div>

      <AnimatePresence>
        {visible && stats && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              'absolute top-2 left-2 z-20',
              'rounded-lg bg-black/75 backdrop-blur-sm',
              'border border-white/10 p-2.5 text-xs text-white',
              'min-w-[160px]',
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-white/90">
                {label} — {source === 'screen' ? 'Screen' : 'Camera'}
              </span>
              <IconButton size="sm" variant="ghost" onClick={() => setVisible(false)} className="text-white/70 hover:text-white -mr-1">
                <X size={12} />
              </IconButton>
            </div>

            <StatsRow label="Resolution" value={`${stats.resolution}@${stats.frameRate}`} />
            <StatsRow label="Codec" value={stats.codec || '\u2014'} />
            <StatsRow
              label="Bitrate"
              value={stats.bitrate >= 1000 ? `${(stats.bitrate / 1000).toFixed(1)} Mbps` : `${stats.bitrate} Kbps`}
            />
            {stats.packetsLost > 0 && <StatsRow label="Packets Lost" value={String(stats.packetsLost)} />}
            {stats.jitter > 0 && <StatsRow label="Jitter" value={`${(stats.jitter * 1000).toFixed(1)} ms`} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-white/50">{label}</span>
      <span className="font-mono text-white/90">{value}</span>
    </div>
  );
}
