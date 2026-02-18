import { useState, useEffect, useMemo } from 'react';
import { History, FileText } from 'lucide-react';
import type { PageRevision } from 'ecto-shared';

import { Modal, Spinner, EmptyState, ScrollArea, Button } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useMemberStore } from '@/stores/member';
import { connectionManager } from '@/services/connection-manager';
import { renderMarkdown } from '@/lib/markdown';

type PageHistoryProps = {
  channelId: string;
  open: boolean;
  onClose: () => void;
};

export function PageHistory({ channelId, open, onClose }: PageHistoryProps) {
  const [revisions, setRevisions] = useState<PageRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [viewingRevision, setViewingRevision] = useState<PageRevision | null>(null);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const members = useMemberStore((s) =>
    activeServerId ? s.members.get(activeServerId) : undefined,
  );

  useEffect(() => {
    if (!open || !activeServerId) return;
    setLoading(true);
    setRevisions([]);
    setViewingRevision(null);
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;

    trpc.pages.getHistory.query({ channel_id: channelId })
      .then((result) => {
        setRevisions(result.revisions);
        setHasMore(result.has_more);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, channelId, activeServerId]);

  const loadMore = async () => {
    if (!activeServerId || revisions.length === 0) return;
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;
    const lastRevision = revisions[revisions.length - 1];
    if (!lastRevision) return;
    const result = await trpc.pages.getHistory.query({
      channel_id: channelId,
      cursor: lastRevision.id,
    });
    setRevisions((prev) => [...prev, ...result.revisions]);
    setHasMore(result.has_more);
  };

  const getEditorName = (userId: string) => {
    const member = members?.get(userId);
    return member?.display_name ?? member?.username ?? 'Unknown';
  };

  const renderedRevisionContent = useMemo(
    () => viewingRevision ? renderMarkdown(viewingRevision.content) : '',
    [viewingRevision],
  );

  if (viewingRevision) {
    return (
      <Modal
        open={open}
        onOpenChange={(v) => { if (!v) onClose(); }}
        title={`Revision v${viewingRevision.version}`}
        width="lg"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted">
            by {getEditorName(viewingRevision.edited_by)} &middot;{' '}
            {new Date(viewingRevision.created_at).toLocaleString()}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setViewingRevision(null)}>
            Back to list
          </Button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div
            className="prose prose-invert max-w-none px-4 py-3"
            dangerouslySetInnerHTML={{ __html: renderedRevisionContent }}
          />
        </ScrollArea>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Revision History"
      width="lg"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : revisions.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No revisions"
          description="Revision history will appear here after edits are made."
        />
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-1">
            {revisions.map((rev) => (
              <button
                key={rev.id}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-hover transition-colors"
                onClick={() => setViewingRevision(rev)}
              >
                <FileText size={16} className="shrink-0 text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary">Version {rev.version}</div>
                  <div className="text-xs text-muted truncate">
                    {getEditorName(rev.edited_by)} &middot;{' '}
                    {new Date(rev.created_at).toLocaleString()}
                  </div>
                </div>
              </button>
            ))}
            {hasMore && (
              <div className="flex justify-center py-2">
                <Button variant="secondary" size="sm" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </Modal>
  );
}
