import { useRef, useState } from 'react';

import { Upload, Camera } from 'lucide-react';

import { Button, Input, TextArea, ImageCropModal } from '@/ui';

import { cn } from '@/lib/cn';

import type { StepProps } from './wizard-types';

type ServerInfoStepProps = Pick<StepProps, 'state' | 'updateState'> & {
  onIconUpload: (file: File) => void;
};

export function ServerInfoStep({ state, updateState, onIconUpload }: ServerInfoStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [iconCropSrc, setIconCropSrc] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-xl text-primary">Server Identity</h2>
        <p className="text-sm text-secondary">
          Give your server a name and description so people know what it is about.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'relative flex h-20 w-20 items-center justify-center rounded-full p-0',
            'bg-tertiary border-2 border-dashed border-border',
            'hover:border-accent/40 hover:bg-hover',
            'overflow-hidden',
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          {state.serverIconUrl ? (
            <img
              src={state.serverIconUrl}
              alt="Server icon"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl text-muted">
              {state.serverName ? state.serverName.charAt(0).toUpperCase() : '?'}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-150">
            <Camera size={18} className="text-white" />
          </div>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (e.target) e.target.value = '';
            if (!file) return;
            if (file.type === 'image/gif') {
              onIconUpload(file);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setIconCropSrc(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
        <span className="flex items-center gap-1 text-xs text-muted">
          <Upload size={12} />
          Click to upload an icon
        </span>
      </div>

      <Input
        label="Server Name"
        value={state.serverName}
        onChange={(e) => updateState({ serverName: e.target.value })}
        placeholder="My Awesome Server"
        required
        autoFocus
      />

      <TextArea
        label="Description (optional)"
        value={state.serverDescription}
        onChange={(e) => updateState({ serverDescription: e.target.value })}
        placeholder="A place for friends to hang out"
        maxRows={3}
      />

      {iconCropSrc && (
        <ImageCropModal
          open
          imageSrc={iconCropSrc}
          aspect={1}
          cropShape="round"
          title="Crop Server Icon"
          onConfirm={(blob) => {
            const file = new File([blob], 'icon.jpg', { type: 'image/jpeg' });
            onIconUpload(file);
            setIconCropSrc(null);
          }}
          onCancel={() => setIconCropSrc(null)}
        />
      )}
    </div>
  );
}
