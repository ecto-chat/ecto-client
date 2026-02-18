import { ShieldAlert } from 'lucide-react';
import { Button } from '@/ui';
import { useUiStore } from '@/stores/ui';

type NsfwWarningProps = {
  channelId: string;
  onGoBack: () => void;
};

export function NsfwWarning({ channelId, onGoBack }: NsfwWarningProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <ShieldAlert size={48} className="text-warning" />
        <h2 className="text-lg font-medium text-primary">Age-Restricted Channel</h2>
        <p className="text-sm text-muted">
          This channel is marked as age-restricted (18+). You must confirm you want to view this content.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onGoBack}>
            Go Back
          </Button>
          <Button onClick={() => useUiStore.getState().dismissNsfw(channelId)}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
