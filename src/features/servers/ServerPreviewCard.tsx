import { Users, Wifi } from 'lucide-react';

import { Avatar } from '@/ui';

type ServerPreviewCardProps = {
  name: string;
  iconUrl: string | null;
  memberCount: number;
  onlineCount: number;
};

export function ServerPreviewCard({ name, iconUrl, memberCount, onlineCount }: ServerPreviewCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-tertiary border-2 border-primary p-3 mb-4">
      <Avatar src={iconUrl} username={name} size={48} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-primary">{name}</span>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users size={12} />
            {memberCount} members
          </span>
          <span className="inline-flex items-center gap-1">
            <Wifi size={12} />
            {onlineCount} online
          </span>
        </div>
      </div>
    </div>
  );
}
