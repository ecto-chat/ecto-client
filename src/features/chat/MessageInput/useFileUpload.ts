import { useState, useRef, useCallback } from 'react';

import { connectionManager } from '@/services/connection-manager';

type UseFileUploadOptions = {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  getContent: () => string;
  getReplyId: () => string | undefined;
  onComplete: () => void;
};

export function useFileUpload({
  channelId,
  serverId,
  onSend,
  getContent,
  getReplyId,
  onComplete,
}: UseFileUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploading(true);
      try {
        const conn = connectionManager.getServerConnection(serverId);
        if (!conn) return;

        const attachmentIds: string[] = [];
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append('channel_id', channelId);
          formData.append('file', file);

          const res = await fetch(`${conn.address}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${conn.token}` },
            body: formData,
          });

          if (!res.ok) throw new Error('Upload failed');
          const result = (await res.json()) as { id: string };
          attachmentIds.push(result.id);
        }

        if (attachmentIds.length > 0) {
          await onSend(getContent().trim(), getReplyId(), attachmentIds);
          onComplete();
        }
      } catch {
        // Upload failed
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [channelId, serverId, onSend, getContent, getReplyId, onComplete],
  );

  return { uploading, fileInputRef, handleFileSelect };
}
