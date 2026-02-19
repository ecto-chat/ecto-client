import { Modal } from '@/ui';
import { useUiStore } from '@/stores/ui';

type Contributor = {
  user_id: string;
  username: string;
};

type FolderContributorsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  contributors: Contributor[];
};

export function FolderContributorsModal({
  open,
  onOpenChange,
  folderName,
  contributors,
}: FolderContributorsModalProps) {
  const serverId = useUiStore((s) => s.activeServerId);

  const handleUserClick = (userId: string) => {
    onOpenChange(false);
    if (serverId) {
      useUiStore.getState().openModal('user-profile', { userId, serverId });
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Contributors — ${folderName}`} width="sm">
      {contributors.length === 0 ? (
        <p className="text-sm text-muted">No contributors yet.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {contributors.map((c) => (
            <button
              key={c.user_id}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-primary hover:bg-hover transition-colors text-left"
              onClick={() => handleUserClick(c.user_id)}
            >
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0">
                {c.username.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{c.username}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
