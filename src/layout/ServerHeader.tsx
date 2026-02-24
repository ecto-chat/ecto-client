import { Settings } from 'lucide-react';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { usePermissions } from '@/hooks/usePermissions';
import { IconButton } from '@/ui/IconButton';

export function ServerHeader() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const server = useServerStore((s) =>
    activeServerId ? s.servers.get(activeServerId) : undefined,
  );
  const { canAccessSettings } = usePermissions(activeServerId);

  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between px-4 border-b-2 border-primary">
      <h2 className="text-base font-semibold text-primary truncate">
        {server?.server_name ?? 'Server'}
      </h2>
      {canAccessSettings && (
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="Server Settings"
          onClick={() => useUiStore.getState().openModal('server-settings')}
        >
          <Settings size={16} />
        </IconButton>
      )}
    </div>
  );
}
