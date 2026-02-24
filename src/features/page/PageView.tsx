import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Pencil, History, X, Bold, Italic, Heading, Link, ImageIcon, AtSign, HashIcon, Upload, Trash2, Video } from 'lucide-react';
import { Permissions } from 'ecto-shared';

import { Button, IconButton, Spinner, EmptyState, ImageCropModal } from '@/ui';
import { ScrollArea } from '@/ui/ScrollArea';

import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';
import { useMemberStore } from '@/stores/member';
import { usePermissions } from '@/hooks/usePermissions';
import { usePage } from '@/hooks/usePage';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/cn';
import { connectionManager } from '@/services/connection-manager';

import { PageHistory } from './PageHistory';

export function PageView() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channel = useChannelStore((s) =>
    activeServerId ? s.channels.get(activeServerId)?.get(activeChannelId ?? '') : undefined,
  );

  const { page, loading, error, refetch } = usePage(activeChannelId ?? '');
  const { isAdmin, effectivePermissions } = usePermissions(activeServerId);
  const canEdit = isAdmin || (effectivePermissions & Permissions.EDIT_PAGES) !== 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [debouncedDraft, setDebouncedDraft] = useState('');

  // Build mention resolver for markdown rendering
  const members = useMemberStore((s) =>
    activeServerId ? s.members.get(activeServerId) : undefined,
  );
  const channels = useChannelStore((s) =>
    activeServerId ? s.channels.get(activeServerId) : undefined,
  );

  const navigate = useNavigate();

  // Handle clicks on elements with data-channel or channel mention spans
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-channel], .mention[data-type="channel"]');
    if (!target) return;
    const channelId = target.dataset.channel ?? target.dataset.id;
    if (channelId && activeServerId) {
      e.preventDefault();
      useUiStore.getState().setActiveChannel(channelId);
      navigate(`/servers/${activeServerId}/channels/${channelId}`);
    }
  }, [activeServerId, navigate]);

  const mentionResolver = useMemo(() => {
    const memberMap = new Map<string, string>();
    if (members) {
      for (const [userId, member] of members) {
        memberMap.set(userId, member.display_name ?? member.username);
      }
    }
    const channelMap = new Map<string, string>();
    if (channels) {
      for (const [channelId, ch] of channels) {
        channelMap.set(channelId, ch.name);
      }
    }
    return { members: memberMap, channels: channelMap };
  }, [members, channels]);

  // Debounce preview updates
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const renderedPreview = useMemo(
    () => renderMarkdown(debouncedDraft, mentionResolver, { allowHtml: true }),
    [debouncedDraft, mentionResolver],
  );

  const renderedContent = useMemo(
    () => page ? renderMarkdown(page.content, mentionResolver, { allowHtml: true }) : '',
    [page, mentionResolver],
  );

  const handleStartEdit = useCallback(() => {
    setDraft(page?.content ?? '');
    setDebouncedDraft(page?.content ?? '');
    setSaveError(null);
    setEditing(true);
  }, [page]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeServerId || !activeChannelId || !page) return;
    setSaving(true);
    setSaveError(null);
    try {
      const trpc = connectionManager.getServerTrpc(activeServerId);
      if (!trpc) throw new Error('Not connected');
      await trpc.pages.updateContent.mutate({
        channel_id: activeChannelId,
        content: draft,
        version: page.version,
      });
      setEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      if (msg.includes('conflict') || msg.includes('Version conflict')) {
        setSaveError('Version conflict — someone else edited this page. Reload to see their changes, or overwrite.');
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [activeServerId, activeChannelId, page, draft]);

  const handleOverwrite = useCallback(async () => {
    if (!activeServerId || !activeChannelId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const trpc = connectionManager.getServerTrpc(activeServerId);
      if (!trpc) throw new Error('Not connected');
      // Refetch to get current version, then overwrite
      const current = await trpc.pages.getContent.query({ channel_id: activeChannelId });
      await trpc.pages.updateContent.mutate({
        channel_id: activeChannelId,
        content: draft,
        version: current.version,
      });
      setEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [activeServerId, activeChannelId, draft]);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);

  const handleBannerUpload = useCallback(async (file: File) => {
    if (!activeServerId || !activeChannelId) return;
    setBannerUploading(true);
    try {
      const conn = connectionManager.getServerConnection(activeServerId);
      if (!conn) throw new Error('Not connected');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${conn.address}/upload/page-banner/${activeChannelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }
      // The page.update WS event will refresh the banner automatically
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setBannerUploading(false);
    }
  }, [activeServerId, activeChannelId]);

  const handleBannerRemove = useCallback(async () => {
    if (!activeServerId || !activeChannelId) return;
    setBannerUploading(true);
    try {
      const trpc = connectionManager.getServerTrpc(activeServerId);
      if (!trpc) throw new Error('Not connected');
      await trpc.pages.updateBanner.mutate({
        channel_id: activeChannelId,
        banner_url: null,
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to remove banner');
    } finally {
      setBannerUploading(false);
    }
  }, [activeServerId, activeChannelId]);

  const insertFormatting = useCallback((prefix: string, suffix: string) => {
    const textarea = document.getElementById('page-editor') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newDraft = draft.substring(0, start) + replacement + draft.substring(end);
    setDraft(newDraft);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + prefix.length + (selected || 'text').length;
      textarea.setSelectionRange(
        start + prefix.length,
        cursorPos,
      );
    });
  }, [draft]);

  if (!activeChannelId || !channel) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={<FileText />} title="Select a channel" description="Pick a channel from the sidebar." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={<FileText />} title="Error" description={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
        <FileText size={18} className="text-muted" />
        <span className="text-sm text-primary">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <span className="truncate text-xs text-muted">{channel.topic}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {canEdit && !editing && (
            <>
              <IconButton variant="ghost" size="sm" tooltip="Upload Banner" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}>
                <Upload size={16} />
              </IconButton>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (e.target) e.target.value = '';
                  if (!file) return;
                  if (file.type === 'image/gif') {
                    handleBannerUpload(file);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setBannerCropSrc(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <IconButton variant="ghost" size="sm" tooltip="Edit Page" onClick={handleStartEdit}>
                <Pencil size={16} />
              </IconButton>
            </>
          )}
          <IconButton variant="ghost" size="sm" tooltip="Revision History" onClick={() => setHistoryOpen(true)}>
            <History size={16} />
          </IconButton>
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Editor pane */}
          <div className="flex flex-1 flex-col border-r-2 border-primary">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-0.5 border-b-2 border-primary px-2 py-1">
              <IconButton variant="ghost" size="sm" tooltip="Bold" onClick={() => insertFormatting('**', '**')}>
                <Bold size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="Italic" onClick={() => insertFormatting('*', '*')}>
                <Italic size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="Heading" onClick={() => insertFormatting('## ', '')}>
                <Heading size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="Link" onClick={() => insertFormatting('[', '](url)')}>
                <Link size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="Image" onClick={() => insertFormatting('![alt](', ')')}>
                <ImageIcon size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="User Mention" onClick={() => insertFormatting('<@', '>')}>
                <AtSign size={14} />
              </IconButton>
              <IconButton variant="ghost" size="sm" tooltip="Channel Reference" onClick={() => insertFormatting('<#', '>')}>
                <HashIcon size={14} />
              </IconButton>
              <div className="mx-1 h-4 w-px bg-border" />
              <IconButton variant="ghost" size="sm" tooltip="YouTube / Vimeo Embed" onClick={() => insertFormatting('https://www.youtube.com/watch?v=', '')}>
                <Video size={14} />
              </IconButton>
            </div>
            <textarea
              id="page-editor"
              className="flex-1 resize-none bg-primary p-4 font-mono text-sm text-primary outline-none placeholder:text-muted"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your page content in markdown..."
              spellCheck
            />
          </div>

          {/* Preview pane */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center border-b-2 border-primary px-3 py-1">
              <span className="text-xs font-medium text-muted">Preview</span>
            </div>
            <ScrollArea className="flex-1">
              <div
                ref={previewRef}
                className="page-markdown max-w-7xl mx-auto px-8 py-6"
                dangerouslySetInnerHTML={{ __html: renderedPreview }}
                onClick={handleContentClick}
              />
            </ScrollArea>
          </div>

          {/* Save/Cancel bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border-2 border-primary bg-secondary px-4 py-2 shadow-lg">
            {saveError && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger max-w-xs truncate">{saveError}</span>
                {saveError.includes('conflict') && (
                  <Button variant="danger" size="sm" onClick={handleOverwrite} loading={saving}>
                    Overwrite
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={refetch}>
                  Reload
                </Button>
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {/* Banner image */}
          {page?.banner_url && (
            <div className="relative w-full max-h-60 overflow-hidden">
              <img
                src={page.banner_url}
                alt="Page banner"
                className="w-full h-60 object-cover"
              />
              {canEdit && (
                <button
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                  onClick={handleBannerRemove}
                  disabled={bannerUploading}
                  title="Remove banner"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
          {page && page.content ? (
            <div
              className="page-markdown max-w-7xl mx-auto px-8 py-6"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
              onClick={handleContentClick}
            />
          ) : (
            <div className="flex items-center justify-center py-20">
              <EmptyState
                icon={<FileText />}
                title="Empty Page"
                description={canEdit ? 'Click the edit button to start writing.' : 'This page has no content yet.'}
              />
            </div>
          )}
        </ScrollArea>
      )}

      {bannerCropSrc && (
        <ImageCropModal
          open
          imageSrc={bannerCropSrc}
          aspect={5}
          title="Crop Page Banner"
          onConfirm={(blob) => {
            const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
            handleBannerUpload(file);
            setBannerCropSrc(null);
          }}
          onCancel={() => setBannerCropSrc(null)}
        />
      )}

      {/* History panel */}
      <PageHistory
        channelId={activeChannelId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
