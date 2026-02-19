import { FolderOpen } from 'lucide-react';
import { Permissions, hasPermission } from 'ecto-shared';

import { usePermissions } from '@/hooks/usePermissions';
import { useUiStore } from '@/stores/ui';

import { cn } from '@/lib/cn';

export function ServerHub() {
  const serverId = useUiStore((s) => s.activeServerId);
  const hubSection = useUiStore((s) => s.hubSection);
  const { effectivePermissions, isAdmin } = usePermissions(serverId);
  const canBrowse = isAdmin || hasPermission(effectivePermissions, Permissions.BROWSE_FILES);

  return (
    <div className="border-b border-border py-3">
      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">
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
    </div>
  );
}
