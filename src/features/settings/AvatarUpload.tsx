import { useRef, type ChangeEvent } from 'react';

import { Upload } from 'lucide-react';

import { Avatar, Button } from '@/ui';

type AvatarUploadProps = {
  currentSrc: string | null;
  username: string;
  onFileSelected: (file: File) => void;
  previewActive: boolean;
  error?: string;
  onError: (msg: string) => void;
};

export function AvatarUpload({ currentSrc, username, onFileSelected, previewActive, onError }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('Please select an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      onError('Avatar must be under 4 MB.');
      return;
    }

    onFileSelected(file);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar src={currentSrc} username={username} size={80} />
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          Change Avatar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        {previewActive && (
          <span className="text-xs text-success">New avatar selected</span>
        )}
      </div>
    </div>
  );
}
