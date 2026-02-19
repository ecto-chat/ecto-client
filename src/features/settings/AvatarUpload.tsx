import { useRef, useState, type ChangeEvent } from 'react';

import { Upload } from 'lucide-react';

import { Avatar, Button, ImageCropModal } from '@/ui';

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
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('Please select an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      onError('Avatar must be under 4 MB.');
      return;
    }

    // GIFs skip crop (canvas can't preserve animation)
    if (file.type === 'image/gif') {
      onFileSelected(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    onFileSelected(file);
    setCropSrc(null);
  };

  return (
    <>
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

      {cropSrc && (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          title="Crop Avatar"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}
