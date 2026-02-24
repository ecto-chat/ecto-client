import { useRef, useState, type ChangeEvent } from 'react';

import { ImagePlus, Trash2 } from 'lucide-react';

import { Button, ImageCropModal } from '@/ui';

type BannerUploadProps = {
  currentSrc: string | null;
  previewSrc: string | null;
  onFileReady: (file: File) => void;
  onRemove: () => void;
  onError: (msg: string) => void;
};

const MAX_BANNER_SIZE = 800 * 1024; // 800KB

export function BannerUpload({ currentSrc, previewSrc, onFileReady, onRemove, onError }: BannerUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const displaySrc = previewSrc ?? currentSrc;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('Please select an image file.');
      return;
    }

    if (file.size > MAX_BANNER_SIZE) {
      onError('Banner must be under 800 KB.');
      return;
    }

    // GIFs skip crop (canvas can't preserve animation)
    if (file.type === 'image/gif') {
      onFileReady(file);
      return;
    }

    // Static images → open crop modal
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
    onFileReady(file);
    setCropSrc(null);
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">Banner</label>
        <div
          className="relative w-full overflow-hidden rounded-lg border-2 border-primary"
          style={{ aspectRatio: '5 / 1' }}
        >
          {displaySrc ? (
            <img src={displaySrc} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-tertiary" />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={14} />
            Change Banner
          </Button>
          {(displaySrc) && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onRemove}
            >
              <Trash2 size={14} />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {cropSrc && (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={5}
          title="Crop Banner"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}
