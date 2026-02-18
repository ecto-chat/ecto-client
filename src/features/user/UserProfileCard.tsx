import { Avatar, Badge, Separator } from '@/ui';

import { cn } from '@/lib/cn';

import type { Role, PresenceStatus } from 'ecto-shared';

function presenceLabel(status: PresenceStatus): string {
  switch (status) {
    case 'online': return 'Online';
    case 'idle': return 'Idle';
    case 'dnd': return 'Do Not Disturb';
    default: return 'Offline';
  }
}

const statusDotColor: Record<PresenceStatus, string> = {
  online: 'bg-status-online',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-status-offline',
};

type UserProfileCardProps = {
  displayName: string;
  tag: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  status: PresenceStatus;
  createdAt?: string | null;
  joinedAt?: string | null;
  roles: Role[];
  isLocal: boolean;
};

export function UserProfileCard({
  displayName,
  tag,
  avatarUrl,
  bannerUrl,
  status,
  createdAt,
  joinedAt,
  roles,
  isLocal,
}: UserProfileCardProps) {
  return (
    <div className="-mx-5 -mt-5 flex flex-col">
      {/* Banner */}
      {bannerUrl ? (
        <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div className="h-24 bg-tertiary" />
      )}

      {/* Header: avatar + names */}
      <div className="flex items-center gap-4 px-5" style={{ marginTop: -50 }}>
        <div className="shrink-0 rounded-full bg-secondary p-1">
          <Avatar
            src={avatarUrl ?? undefined}
            username={displayName}
            size={72}
            status={status}
          />
        </div>
        <div style={{ marginTop: 50 }} className="min-w-0">
          <p className="truncate text-lg text-primary">{displayName}</p>
          {tag && <p className="truncate text-sm text-muted">{tag}</p>}
        </div>
      </div>

      <div className="px-5 py-3">
        <Separator />
      </div>

      {/* Member since (server join) */}
      {joinedAt && (
        <div className="px-5 pb-3">
          <p className="mb-1 text-xs text-muted uppercase tracking-wide">Member Since</p>
          <p className="text-sm text-secondary">
            {new Date(joinedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      )}

      {/* Account created */}
      {createdAt && (
        <div className="px-5 pb-3">
          <p className="mb-1 text-xs text-muted uppercase tracking-wide">Ecto Member Since</p>
          <p className="text-sm text-secondary">
            {new Date(createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      )}

      {/* Roles */}
      {roles.length > 0 && (
        <div className="px-5 pb-3">
          <p className="mb-1.5 text-xs text-muted uppercase tracking-wide">Roles</p>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-secondary"
                style={{
                  borderColor: role.color ?? undefined,
                  backgroundColor: role.color ? `${role.color}1a` : undefined,
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: role.color ?? undefined }}
                />
                {role.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Local badge */}
      {isLocal && (
        <div className="px-5 pb-3">
          <Badge variant="secondary">Local Account</Badge>
        </div>
      )}
    </div>
  );
}
