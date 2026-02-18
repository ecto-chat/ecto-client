import { useState, useCallback } from 'react';

import { Button, TextArea } from '@/ui';

type MessageEditFormProps = {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
};

export function MessageEditForm({ initialContent, onSave, onCancel }: MessageEditFormProps) {
  const [content, setContent] = useState(initialContent);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (content.trim() && content !== initialContent) {
          onSave(content.trim());
        }
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [content, initialContent, onSave, onCancel],
  );

  return (
    <div className="mt-1">
      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        maxRows={6}
        className="text-base"
      />
      <div className="text-xs text-muted mt-1">
        escape to{' '}
        <Button type="button" variant="ghost" size="sm" className="text-xs text-muted underline p-0 h-auto font-normal" onClick={onCancel}>
          cancel
        </Button>
        {' \u00B7 '}
        enter to{' '}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted underline p-0 h-auto font-normal"
          onClick={() => {
            if (content.trim() && content !== initialContent) onSave(content.trim());
          }}
        >
          save
        </Button>
      </div>
    </div>
  );
}
