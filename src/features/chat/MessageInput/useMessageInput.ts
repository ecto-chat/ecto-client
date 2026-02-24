import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';

import { Permissions } from 'ecto-shared';
import { connectionManager } from '@/services/connection-manager';
import { useChannelStore } from '@/stores/channel';
import { useUiStore } from '@/stores/ui';
import { usePermissions } from '@/hooks/usePermissions';

import { useFileUpload } from './useFileUpload';
import { useAutocomplete } from './useAutocomplete';

type UseMessageInputOptions = {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
};

export function useMessageInput({ channelId, serverId, onSend, replyTo, onCancelReply }: UseMessageInputOptions) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slowmode
  const channel = useChannelStore((s) => s.channels.get(serverId)?.get(channelId));
  const slowmodeSeconds = channel?.slowmode_seconds ?? 0;
  const { isAdmin, effectivePermissions } = usePermissions(useUiStore.getState().activeServerId);
  const canBypassSlowmode = isAdmin || (effectivePermissions & Permissions.MANAGE_MESSAGES) !== 0 || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;
  const [slowmodeRemaining, setSlowmodeRemaining] = useState(0);
  const slowmodeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowmodeDisabled = slowmodeSeconds > 0 && !canBypassSlowmode && slowmodeRemaining > 0;

  // Clear slowmode timer on unmount or channel change
  useEffect(() => {
    setSlowmodeRemaining(0);
    if (slowmodeTimerRef.current) {
      clearInterval(slowmodeTimerRef.current);
      slowmodeTimerRef.current = null;
    }
  }, [channelId]);

  const getContent = useCallback(() => content, [content]);
  const getReplyId = useCallback(() => replyTo?.id, [replyTo]);
  const onUploadComplete = useCallback(() => {
    setContent('');
    onCancelReply?.();
  }, [onCancelReply]);

  const { uploading, fileInputRef, handleFileSelect } = useFileUpload({
    channelId,
    serverId,
    onSend,
    getContent,
    getReplyId,
    onComplete: onUploadComplete,
  });

  const {
    autocomplete,
    selectedIndex,
    filteredItems,
    selectItem,
    updateAutocomplete,
    handleAutocompleteKey,
  } = useAutocomplete({ serverId, textareaRef, content, setContent });

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text && !replyTo) return;
    if (slowmodeDisabled) return;

    const ws = connectionManager.getMainWs(serverId);
    ws?.send('typing.stop', { channel_id: channelId });

    try {
      await onSend(text, replyTo?.id);
      setContent('');
      onCancelReply?.();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // Start slowmode countdown
      if (slowmodeSeconds > 0 && !canBypassSlowmode) {
        setSlowmodeRemaining(slowmodeSeconds);
        if (slowmodeTimerRef.current) clearInterval(slowmodeTimerRef.current);
        slowmodeTimerRef.current = setInterval(() => {
          setSlowmodeRemaining((prev) => {
            if (prev <= 1) {
              if (slowmodeTimerRef.current) clearInterval(slowmodeTimerRef.current);
              slowmodeTimerRef.current = null;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      // Error handling done in hook
    }
  }, [content, replyTo, onSend, onCancelReply, channelId, serverId, slowmodeSeconds, canBypassSlowmode, slowmodeDisabled]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    updateAutocomplete(e.target.value, e.target.selectionStart);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleAutocompleteKey(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    const ws = connectionManager.getMainWs(serverId);
    ws?.sendTyping(channelId);
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  return {
    content,
    uploading,
    autocomplete,
    selectedIndex,
    filteredItems,
    textareaRef,
    fileInputRef,
    selectItem,
    handleChange,
    handleKeyDown,
    handleInput,
    handleFileSelect,
    handleSend,
    slowmodeDisabled,
    slowmodeRemaining,
  };
}
