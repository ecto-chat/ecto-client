import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

import { connectionManager } from '@/services/connection-manager';

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

    const ws = connectionManager.getMainWs(serverId);
    ws?.send('typing.stop', { channel_id: channelId });

    try {
      await onSend(text, replyTo?.id);
      setContent('');
      onCancelReply?.();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch {
      // Error handling done in hook
    }
  }, [content, replyTo, onSend, onCancelReply, channelId, serverId]);

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
  };
}
