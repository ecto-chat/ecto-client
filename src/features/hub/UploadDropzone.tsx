import { useState, useCallback, useRef, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/ui';

type UploadDropzoneProps = {
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  disabled?: boolean;
};

export function UploadDropzone({ onUpload, disabled }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const doUpload = useCallback(
    async (file: File) => {
      if (disabled || uploading) return;
      setUploading(true);
      setProgress(0);
      try {
        await onUpload(file, (pct) => setProgress(pct));
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Upload failed', 'danger');
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onUpload, disabled, uploading, toast],
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) await doUpload(file);
    },
    [doUpload],
  );

  const handleFileSelect = useCallback(async () => {
    const file = inputRef.current?.files?.[0];
    if (file) await doUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [doUpload]);

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
        dragging ? 'border-accent bg-accent/10' : 'border-primary hover:border-accent/50',
        (disabled || uploading) && 'opacity-50 cursor-not-allowed',
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
    >
      <Upload size={20} className="mx-auto text-muted mb-1" />
      <p className="text-sm text-muted">
        {uploading ? `Uploading\u2026 ${progress}%` : 'Drop a file here or click to upload'}
      </p>
      {uploading && (
        <div className="mt-2 h-1.5 w-full bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
