import { Avatar } from '@/ui/Avatar';
import { usePresence } from '@/hooks/usePresence';

type ServerDmHeaderProps = {
  peerId: string;
  peerName: string;
  avatarUrl: string | null;
};

export function ServerDmHeader({ peerId, peerName, avatarUrl }: ServerDmHeaderProps) {
  const { status } = usePresence(peerId);

  return (
    <div className="flex h-12 items-center gap-3 border-b border-border px-4 shrink-0">
      <Avatar
        src={avatarUrl ?? undefined}
        username={peerName}
        size={28}
        status={status}
      />
      <h2 className="text-sm font-semibold text-primary truncate">{peerName}</h2>
    </div>
  );
}
