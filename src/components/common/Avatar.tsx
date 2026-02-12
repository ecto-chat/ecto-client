interface AvatarProps {
  src?: string | null;
  username?: string;
  size?: number;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#3ba55d',
  idle: '#faa81a',
  dnd: '#ed4245',
  offline: '#747f8d',
};

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#5865f2', '#eb459e', '#fee75c', '#57f287', '#ed4245', '#3ba55d'];
  return colors[Math.abs(hash) % colors.length]!;
}

export function Avatar({ src, username = '?', size = 40, status, className }: AvatarProps) {
  return (
    <div className={`avatar ${className ?? ''}`} style={{ position: 'relative', width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={username}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: hashColor(username),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: size * 0.45,
            fontWeight: 600,
          }}
        >
          {getInitials(username)}
        </div>
      )}
      {status && (
        <div
          className="avatar-status"
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS[status],
            border: `2px solid var(--bg-primary, #36393f)`,
          }}
        />
      )}
    </div>
  );
}
