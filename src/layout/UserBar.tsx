import { Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/IconButton';

export function UserBar() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex items-center gap-2 border-t border-border bg-[rgba(18,18,30,0.8)] p-2">
      <Avatar
        src={user?.avatar_url ?? undefined}
        username={user?.username ?? '?'}
        size={32}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="text-sm font-medium text-primary truncate">
          {user?.display_name ?? user?.username ?? 'User'}
        </div>
        <div className="text-2xs text-muted">
          #{user?.discriminator ?? '0000'}
        </div>
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        tooltip="User Settings"
        onClick={() => useUiStore.getState().openModal('user-settings')}
      >
        <Settings size={16} />
      </IconButton>
    </div>
  );
}
