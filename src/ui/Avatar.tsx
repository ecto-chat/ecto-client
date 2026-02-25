import { type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const FALLBACK_COLORS = [
  '#5865f2',
  '#eb459e',
  '#fee75c',
  '#57f287',
  '#ed4245',
  '#3ba55d',
] as const;

const STATUS_COLORS = {
  online: '#2ecc71',
  idle: '#f39c12',
  dnd: '#e74c3c',
  offline: '#5a5a6e',
} as const;

type Status = keyof typeof STATUS_COLORS;

type AvatarProps = {
  src?: string | null;
  username?: string;
  size?: number;
  status?: Status;
  className?: string;
};

function hashColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]!;
}

export function Avatar({
  src,
  username = '?',
  size = 40,
  status,
  className,
}: AvatarProps) {
  const initial = username[0]?.toUpperCase() ?? '?';
  const dotSize = Math.round(size * 0.3);

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={username}
          className="block rounded-full object-cover"
          style={{ width: size, height: size }}
          draggable={false}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full font-semibold text-white select-none"
          style={{
            width: size,
            height: size,
            backgroundColor: hashColor(username),
            fontSize: size * 0.4,
          }}
        >
          {initial}
        </div>
      )}

      {status && (
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: STATUS_COLORS[status],
            borderWidth: Math.max(2, Math.round(size * 0.05)),
            borderStyle: 'solid',
            borderColor: 'var(--color-bg-primary)',
          }}
        />
      )}
    </div>
  );
}
