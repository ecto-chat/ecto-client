import type { SharedStorageQuota } from 'ecto-shared';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export function QuotaBar({ quota }: { quota: SharedStorageQuota | null }) {
  if (!quota) return null;

  const pct = quota.max_bytes > 0 ? Math.min((quota.used_bytes / quota.max_bytes) * 100, 100) : 0;
  const isHigh = pct > 80;

  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <div className="flex-1 h-1.5 bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-red-500' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap">
        {formatBytes(quota.used_bytes)} / {formatBytes(quota.max_bytes)}
      </span>
    </div>
  );
}
