import { useState, useMemo, useCallback, type ReactNode } from 'react';
import {
  Folder,
  File,
  Image,
  Film,
  Music,
  FileCode,
  FileText,
  FileArchive,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Loader2,
  Lock,
} from 'lucide-react';
import { zip } from 'fflate';

import {
  IconButton,
  ConfirmDialog,
  EmptyState,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/ui';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';

// ── Types ──

export interface TableFolder {
  kind: 'folder';
  id: string;
  name: string;
  icon?: ReactNode;
  date?: string;
  size?: number;
  subtitle?: string;
  /** ReactNode content for the contributor column (e.g., role badges) */
  contributorNode?: ReactNode;
  onOpen: () => void;
  onDelete?: () => void;
  /** Files to zip-download; if provided, the download button appears */
  downloadFiles?: { url: string; filename: string }[];
  /** Async loader for download files when not preloaded */
  loadDownloadFiles?: () => Promise<{ url: string; filename: string }[]>;
  /** Whether this item has permission overrides (shows lock icon) */
  hasOverrides?: boolean;
  /** Callback to open the permissions editor for this item */
  onEditPermissions?: () => void;
}

export interface TableFile {
  kind: 'file';
  id: string;
  name: string;
  url: string;
  contentType: string;
  date: string;
  size: number;
  contributor: string;
  /** ReactNode content for the contributor column (e.g., clickable badge) */
  contributorNode?: ReactNode;
  onDelete?: () => void;
  onGoToMessage?: () => void;
  /** Whether this item has permission overrides (shows lock icon) */
  hasOverrides?: boolean;
  /** Callback to open the permissions editor for this item */
  onEditPermissions?: () => void;
}

export type TableRow = TableFolder | TableFile;

export interface ColumnLabels {
  name?: string;
  date?: string;
  size?: string;
  contributor?: string;
}

interface FileBrowserTableProps {
  rows: TableRow[];
  columnLabels?: ColumnLabels;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

// ── Constants ──

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.scr', '.ps1', '.sh', '.jar', '.app', '.dmg',
  '.vbs', '.com', '.pif', '.reg',
]);

// ── Helpers ──

function resolveFileUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http')) return relativeUrl;
  const serverId = useUiStore.getState().activeServerId;
  if (!serverId) return relativeUrl;
  const conn = connectionManager.getServerConnection(serverId);
  if (!conn) return relativeUrl;
  return `${conn.address}${relativeUrl}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function isDangerous(filename: string): boolean {
  return DANGEROUS_EXTENSIONS.has(getFileExtension(filename));
}

function getMediaType(contentType: string): 'image' | 'video' | 'audio' | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return null;
}

function FileIcon({ contentType, className }: { contentType: string; className?: string }) {
  const base = className ?? 'text-muted';
  if (contentType.startsWith('image/')) return <Image size={18} className="text-green-400" />;
  if (contentType.startsWith('video/')) return <Film size={18} className="text-purple-400" />;
  if (contentType.startsWith('audio/')) return <Music size={18} className="text-yellow-400" />;
  if (contentType.includes('zip') || contentType.includes('tar') || contentType.includes('gzip') || contentType.includes('rar'))
    return <FileArchive size={18} className="text-orange-400" />;
  if (contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('html') || contentType.includes('css'))
    return <FileCode size={18} className="text-blue-400" />;
  if (contentType.includes('text') || contentType.includes('pdf') || contentType.includes('document'))
    return <FileText size={18} className="text-sky-400" />;
  return <File size={18} className={base} />;
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = resolveFileUrl(url);
  a.download = filename;
  a.click();
}

function zipAsync(entries: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// ── Sort ──

type SortField = 'name' | 'date' | 'size' | 'contributor';
type SortDir = 'asc' | 'desc';

function getSortValue(row: TableRow, field: SortField): string | number {
  switch (field) {
    case 'name':
      return row.kind === 'folder' ? row.name : row.name;
    case 'date':
      if (row.kind === 'file') return row.date;
      return row.date ?? '';
    case 'size':
      if (row.kind === 'file') return row.size;
      return row.size ?? 0;
    case 'contributor':
      if (row.kind === 'file') return row.contributor;
      return row.subtitle ?? '';
  }
}

function compare(a: TableRow, b: TableRow, field: SortField, dir: SortDir): number {
  const aVal = getSortValue(a, field);
  const bVal = getSortValue(b, field);

  let result: number;
  if (typeof aVal === 'string' && typeof bVal === 'string') {
    result = aVal.localeCompare(bVal);
  } else {
    result = (aVal as number) - (bVal as number);
  }
  return dir === 'asc' ? result : -result;
}

// ── Component ──

export function FileBrowserTable({
  rows,
  columnLabels,
  hasMore,
  onLoadMore,
  emptyTitle = 'No files',
  emptyDescription = 'Nothing here yet.',
}: FileBrowserTableProps) {
  const labels = {
    name: columnLabels?.name ?? 'Name',
    date: columnLabels?.date ?? 'Date',
    size: columnLabels?.size ?? 'Size',
    contributor: columnLabels?.contributor ?? 'Contributors',
  };
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [execWarning, setExecWarning] = useState<{ url: string; filename: string } | null>(null);
  const [zippingId, setZippingId] = useState<string | null>(null);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const folders = rows.filter((r): r is TableFolder => r.kind === 'folder');
    const files = rows.filter((r): r is TableFile => r.kind === 'file');
    folders.sort((a, b) => compare(a, b, sortField, sortDir));
    files.sort((a, b) => compare(a, b, sortField, sortDir));
    return [...folders, ...files];
  }, [rows, sortField, sortDir]);

  const handleFileClick = useCallback((row: TableFile) => {
    if (isDangerous(row.name)) {
      setExecWarning({ url: row.url, filename: row.name });
      return;
    }
    const mediaType = getMediaType(row.contentType);
    if (mediaType) {
      useUiStore.getState().openModal('image-lightbox', {
        src: resolveFileUrl(row.url),
        alt: row.name,
        type: mediaType,
      });
      return;
    }
    downloadFile(row.url, row.name);
  }, []);

  const handleFileDownload = useCallback((row: TableFile) => {
    if (isDangerous(row.name)) {
      setExecWarning({ url: row.url, filename: row.name });
      return;
    }
    downloadFile(row.url, row.name);
  }, []);

  const handleFolderDownload = useCallback(async (folder: TableFolder) => {
    let files = folder.downloadFiles;
    if (!files && folder.loadDownloadFiles) {
      setZippingId(folder.id);
      try {
        files = await folder.loadDownloadFiles();
      } catch {
        setZippingId(null);
        return;
      }
    }
    if (!files || files.length === 0) {
      setZippingId(null);
      return;
    }

    setZippingId(folder.id);
    try {
      const entries: Record<string, Uint8Array> = {};
      await Promise.all(
        files.map(async (f) => {
          const res = await fetch(resolveFileUrl(f.url));
          const buf = await res.arrayBuffer();
          entries[f.filename] = new Uint8Array(buf);
        }),
      );
      const zipped = await zipAsync(entries);
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZippingId(null);
    }
  }, []);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="grid grid-cols-[1fr_140px_100px_120px_80px] border-b-2 border-primary">
        <SortHeader field="name" label={labels.name} active={sortField} dir={sortDir} onClick={toggleSort} />
        <SortHeader field="date" label={labels.date} active={sortField} dir={sortDir} onClick={toggleSort} />
        <SortHeader field="size" label={labels.size} active={sortField} dir={sortDir} onClick={toggleSort} />
        <SortHeader field="contributor" label={labels.contributor} active={sortField} dir={sortDir} onClick={toggleSort} />
        <div />
      </div>

      {/* Rows */}
      {sortedRows.map((row) =>
        row.kind === 'folder' ? (
          <FolderRowItem
            key={row.id}
            row={row}
            zipping={zippingId === row.id}
            onDownload={() => handleFolderDownload(row)}
          />
        ) : (
          <FileRowItem
            key={row.id}
            row={row}
            onClick={() => handleFileClick(row)}
            onDownload={() => handleFileDownload(row)}
          />
        ),
      )}

      {/* Load more */}
      {hasMore && onLoadMore && (
        <button
          type="button"
          className="w-full border-b-2 border-primary py-2.5 text-sm text-accent hover:bg-hover transition-colors"
          onClick={onLoadMore}
        >
          Load more
        </button>
      )}

      {/* Executable warning dialog */}
      <ConfirmDialog
        open={execWarning !== null}
        onOpenChange={(open) => { if (!open) setExecWarning(null); }}
        title="Potentially Dangerous File"
        description={`"${execWarning?.filename ?? ''}" could be harmful to your computer. Only download files from sources you trust.`}
        confirmLabel="Download Anyway"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (execWarning) downloadFile(execWarning.url, execWarning.filename);
          setExecWarning(null);
        }}
      />
    </div>
  );
}

// ── Sub-components ──

function SortHeader({
  field,
  label,
  active,
  dir,
  onClick,
}: {
  field: SortField;
  label: string;
  active: SortField;
  dir: SortDir;
  onClick: (field: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <button
      type="button"
      className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted hover:text-primary transition-colors text-left"
      onClick={() => onClick(field)}
    >
      {label}
      {isActive &&
        (dir === 'asc' ? (
          <ChevronUp size={12} className="flex-shrink-0" />
        ) : (
          <ChevronDown size={12} className="flex-shrink-0" />
        ))}
    </button>
  );
}

function FolderRowItem({
  row,
  zipping,
  onDownload,
}: {
  row: TableFolder;
  zipping: boolean;
  onDownload: () => void;
}) {
  const hasDownload = row.downloadFiles || row.loadDownloadFiles;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="group grid grid-cols-[1fr_140px_100px_120px_80px] border-b-2 border-primary hover:bg-hover transition-colors cursor-pointer"
          onClick={() => row.onOpen()}
        >
          {/* Name */}
          <div className="flex items-center gap-3 px-3 py-2.5 min-w-0">
            {row.icon ?? <Folder size={18} className="text-accent flex-shrink-0" />}
            <span className="text-sm font-medium text-primary truncate">{row.name}</span>
            {row.hasOverrides && <Lock size={14} className="text-muted flex-shrink-0" />}
          </div>

          {/* Date */}
          <div className="flex items-center px-3 py-2.5 text-sm text-muted">
            {row.date ? formatDate(row.date) : '\u2014'}
          </div>

          {/* Size */}
          <div className="flex items-center px-3 py-2.5 text-sm text-muted">
            {row.size != null && row.size > 0 ? formatBytes(row.size) : '\u2014'}
          </div>

          {/* Contributors */}
          <div className="flex items-center gap-1 px-3 py-2.5 text-sm text-muted overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {row.contributorNode ?? row.subtitle ?? '\u2014'}
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {hasDownload && (
              <IconButton
                size="sm"
                variant="ghost"
                tooltip="Download as ZIP"
                disabled={zipping}
                onClick={onDownload}
              >
                {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              </IconButton>
            )}
            {row.onDelete && (
              <IconButton
                size="sm"
                variant="ghost"
                tooltip="Delete"
                onClick={() => row.onDelete!()}
              >
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => row.onOpen()}>Open</ContextMenuItem>
        {hasDownload && <ContextMenuItem onClick={onDownload}>Download as ZIP</ContextMenuItem>}
        {row.onEditPermissions && (
          <ContextMenuItem onClick={row.onEditPermissions}>Edit Permissions</ContextMenuItem>
        )}
        {row.onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem danger onClick={() => row.onDelete!()}>Delete</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FileRowItem({
  row,
  onClick,
  onDownload,
}: {
  row: TableFile;
  onClick: () => void;
  onDownload: () => void;
}) {
  const dangerous = isDangerous(row.name);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="group grid grid-cols-[1fr_140px_100px_120px_80px] border-b-2 border-primary hover:bg-hover transition-colors cursor-pointer"
          onClick={onClick}
        >
          {/* Name */}
          <div className="flex items-center gap-3 px-3 py-2.5 min-w-0">
            {dangerous ? (
              <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <FileIcon contentType={row.contentType} />
            )}
            <span className="text-sm text-primary truncate">{row.name}</span>
            {row.hasOverrides && <Lock size={14} className="text-muted flex-shrink-0" />}
          </div>

          {/* Date */}
          <div className="flex items-center px-3 py-2.5 text-sm text-muted">
            {formatDate(row.date)}
          </div>

          {/* Size */}
          <div className="flex items-center px-3 py-2.5 text-sm text-muted">
            {formatBytes(row.size)}
          </div>

          {/* Contributors */}
          <div className="flex items-center gap-1 px-3 py-2.5 text-sm text-muted overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {row.contributorNode ?? row.contributor}
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {row.onGoToMessage && (
              <IconButton
                size="sm"
                variant="ghost"
                tooltip="Go to message"
                onClick={() => row.onGoToMessage!()}
              >
                <ExternalLink size={14} />
              </IconButton>
            )}
            <IconButton
              size="sm"
              variant="ghost"
              tooltip="Download"
              onClick={onDownload}
            >
              <Download size={14} />
            </IconButton>
            {row.onDelete && (
              <IconButton
                size="sm"
                variant="ghost"
                tooltip="Delete"
                onClick={() => row.onDelete!()}
              >
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClick}>Open</ContextMenuItem>
        <ContextMenuItem onClick={onDownload}>Download</ContextMenuItem>
        {row.onEditPermissions && (
          <ContextMenuItem onClick={row.onEditPermissions}>Edit Permissions</ContextMenuItem>
        )}
        {row.onGoToMessage && (
          <ContextMenuItem onClick={() => row.onGoToMessage!()}>Go to Message</ContextMenuItem>
        )}
        {row.onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem danger onClick={() => row.onDelete!()}>Delete</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
