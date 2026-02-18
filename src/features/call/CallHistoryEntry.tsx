import { ArrowUpRight, ArrowDownLeft, Phone, Trash2 } from 'lucide-react';

import {
  Avatar,
  IconButton,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/ui';
import { cn } from '@/lib/cn';

import type { CallRecord } from 'ecto-shared';

type CallHistoryEntryProps = {
  record: CallRecord;
  onCallBack: (userId: string) => void;
  onDelete: (recordId: string) => void;
};

export function CallHistoryEntry({ record, onCallBack, onDelete }: CallHistoryEntryProps) {
  const isMissed = record.status === 'missed';
  const DirectionIcon = record.direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;

  const statusLabel = (() => {
    switch (record.status) {
      case 'missed': return 'Missed';
      case 'rejected': return 'Declined';
      case 'busy': return 'Busy';
      case 'unavailable': return 'Unavailable';
      case 'ended': return record.duration_seconds
        ? formatDuration(record.duration_seconds)
        : 'Ended';
      default: return record.status;
    }
  })();

  const timeAgo = getRelativeTime(record.created_at);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-hover',
          isMissed && 'text-danger',
        )}>
          <Avatar src={record.peer.avatar_url} username={record.peer.username} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <DirectionIcon className={cn('size-3.5 shrink-0', isMissed ? 'text-danger' : 'text-muted')} />
              <span className="truncate">{record.peer.display_name ?? record.peer.username}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className={cn(isMissed && 'text-danger')}>{statusLabel}</span>
              <span>{timeAgo}</span>
            </div>
          </div>
          <IconButton
            tooltip="Call"
            variant="ghost"
            size="sm"
            onClick={() => onCallBack(record.peer.user_id)}
          >
            <Phone className="size-4" />
          </IconButton>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem danger onSelect={() => onDelete(record.id)}>
          <Trash2 className="mr-2 size-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getRelativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
