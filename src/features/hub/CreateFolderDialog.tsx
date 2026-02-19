import { useState } from 'react';
import { Button, Input } from '@/ui';

type CreateFolderDialogProps = {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
};

export function CreateFolderDialog({ onSubmit, onCancel }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        className="flex-1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={!name.trim()}>
        Create
      </Button>
      <Button size="sm" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
