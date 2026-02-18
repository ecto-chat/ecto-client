import { useState, useRef, useCallback } from 'react';

import { AlertTriangle, Paperclip, Play, Music } from 'lucide-react';

import { Button, ConfirmDialog } from '@/ui';

import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

import type { Attachment } from 'ecto-shared';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.scr', '.ps1', '.sh', '.jar', '.app', '.dmg',
  '.vbs', '.com', '.pif', '.reg',
]);

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
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function VideoPreview({ src, filename }: { src: string; filename: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setHovering(true);
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovering(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, []);

  return (
    <button
      type="button"
      className="relative rounded-lg max-w-lg overflow-hidden cursor-pointer group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => useUiStore.getState().openModal('image-lightbox', { src, alt: filename, type: 'video' })}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        preload="metadata"
        className="rounded-lg max-w-lg max-h-80 pointer-events-none"
      />
      <div
        className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-all"
        style={{ opacity: hovering ? 0 : 1 }}
      >
        <div className="size-12 rounded-full bg-white/90 flex items-center justify-center">
          <Play size={22} className="text-black ml-0.5" fill="currentColor" />
        </div>
      </div>
    </button>
  );
}

type MessageAttachmentsProps = {
  attachments: Attachment[];
};

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [fileWarning, setFileWarning] = useState<{ url: string; filename: string } | null>(null);

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-1">
      {attachments.map((att) => {
        const ext = att.filename.slice(att.filename.lastIndexOf('.')).toLowerCase();
        const isDangerous = DANGEROUS_EXTENSIONS.has(ext);
        const fileUrl = resolveFileUrl(att.url);

        const isVideo = att.content_type?.startsWith('video/');
        const isAudio = att.content_type?.startsWith('audio/');

        return (
          <div key={att.id}>
            {att.content_type?.startsWith('image/') ? (
              <img
                src={fileUrl}
                alt={att.filename}
                className="rounded-lg max-w-sm cursor-pointer"
                loading="lazy"
                onClick={() => useUiStore.getState().openModal('image-lightbox', { src: fileUrl, alt: att.filename })}
              />
            ) : isVideo ? (
              <VideoPreview src={fileUrl} filename={att.filename} />
            ) : isAudio ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-3 cursor-pointer hover:bg-tertiary/80 transition-colors"
                onClick={() => useUiStore.getState().openModal('image-lightbox', { src: fileUrl, alt: att.filename, type: 'audio' })}
              >
                <Music size={18} className="text-accent" />
                <span className="text-sm text-primary">{att.filename}</span>
                <span className="text-xs text-secondary">({formatBytes(att.size_bytes)})</span>
              </button>
            ) : isDangerous ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFileWarning({ url: fileUrl, filename: att.filename })}
              >
                <AlertTriangle size={16} />
                {att.filename} ({formatBytes(att.size_bytes)})
              </Button>
            ) : (
              <a
                href={fileUrl}
                download={att.filename}
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <Paperclip size={16} />
                {att.filename} ({formatBytes(att.size_bytes)})
              </a>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={fileWarning !== null}
        onOpenChange={(open) => { if (!open) setFileWarning(null); }}
        title="Potentially Dangerous File"
        description={`"${fileWarning?.filename ?? ''}" could be harmful to your computer. Only download files from sources you trust.`}
        confirmLabel="Download Anyway"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (fileWarning) {
            const a = document.createElement('a');
            a.href = fileWarning.url;
            a.download = fileWarning.filename;
            a.click();
          }
          setFileWarning(null);
        }}
      />
    </div>
  );
}
