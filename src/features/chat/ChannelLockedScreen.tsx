import { Lock } from 'lucide-react';
import { Button } from '@/ui';

type ChannelLockedScreenProps = {
  onGoBack: () => void;
};

export function ChannelLockedScreen({ onGoBack }: ChannelLockedScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <Lock size={48} className="text-muted" />
        <h2 className="text-lg font-medium text-primary">Channel No Longer Available</h2>
        <p className="text-sm text-muted">
          You no longer have access to this channel.
        </p>
        <Button variant="secondary" onClick={onGoBack}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
