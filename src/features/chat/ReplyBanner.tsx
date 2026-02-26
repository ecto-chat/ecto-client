import { CornerDownRight, X } from 'lucide-react';
import { IconButton } from '@/ui';

type ReplyBannerProps = {
  author: string;
  onCancel: () => void;
};

export function ReplyBanner({ author, onCancel }: ReplyBannerProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary border-b-2 border-primary text-sm text-secondary shrink-0">
      <CornerDownRight size={14} className="text-muted" />
      <span>
        Replying to <span className="font-medium text-primary">{author}</span>
      </span>
      <IconButton
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="ml-auto"
        tooltip="Cancel reply"
      >
        <X size={14} />
      </IconButton>
    </div>
  );
}
