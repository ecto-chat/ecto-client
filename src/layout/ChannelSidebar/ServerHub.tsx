import { FolderOpen, Mail } from 'lucide-react';
import { Permissions, hasPermission } from 'ecto-shared';

import { usePermissions } from '@/hooks/usePermissions';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useServerDmStore } from '@/stores/server-dm';
import { Badge } from '@/ui/Badge';

import { cn } from '@/lib/cn';

export function ServerHub() {
  const serverId = useUiStore((s) => s.activeServerId);
  const hubSection = useUiStore((s) => s.hubSection);
  const { effectivePermissions, isAdmin } = usePermissions(serverId);
  const canBrowse = isAdmin || hasPermission(effectivePermissions, Permissions.BROWSE_FILES);
  const allowMemberDms = useServerStore((s) =>
    serverId ? s.serverMeta.get(serverId)?.allow_member_dms ?? false : false,
  );
  const dmUnreadCount = useServerDmStore((s) =>
    serverId ? s.serverDmUnreads.get(serverId) ?? 0 : 0,
  );

  return (
    <div className="border-b-2 border-primary py-3">
      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2 pl-3">
        Server Hub
      </h3>
      {canBrowse && (
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 w-full px-2 py-1.5 text-sm transition-colors duration-150 border-l-4',
            hubSection === 'file-browser'
              ? 'bg-primary text-primary border-[#6f53ef]'
              : 'text-secondary hover:bg-primary border-transparent',
          )}
          onClick={() => useUiStore.getState().setHubSection('file-browser')}
        >
          <FolderOpen size={16} className="shrink-0 text-muted" />
          File Browser
        </button>
      )}
      {allowMemberDms && (
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 w-full px-2 py-1.5 text-sm transition-colors duration-150 border-l-4',
            hubSection === 'server-dms'
              ? 'bg-primary text-primary border-[#6f53ef]'
              : 'text-secondary hover:bg-primary border-transparent',
          )}
          onClick={() => useUiStore.getState().setHubSection('server-dms')}
        >
          <Mail size={16} className="shrink-0 text-muted" />
          Private Messages
          {dmUnreadCount > 0 && (
            <Badge variant="default" size="sm" className="ml-auto bg-[#7c5cfc]">{dmUnreadCount}</Badge>
          )}
        </button>
      )}
    </div>
  );
}
