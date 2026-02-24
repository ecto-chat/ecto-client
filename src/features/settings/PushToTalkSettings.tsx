import { useState, useCallback } from 'react';

import { Switch, Button } from '@/ui';

import { useVoiceStore } from '@/stores/voice';

export function PushToTalkSettings() {
  const pttEnabled = useVoiceStore((s) => s.pttEnabled);
  const pttKey = useVoiceStore((s) => s.pttKey);
  const setPttEnabled = useVoiceStore((s) => s.setPttEnabled);
  const setPttKey = useVoiceStore((s) => s.setPttKey);
  const [recording, setRecording] = useState(false);

  const pttKeyLabel = pttKey === ' ' ? 'Space' : pttKey;

  const handleRecordKey = useCallback(() => {
    setRecording(true);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      setPttKey(e.key);
      setRecording(false);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  }, [setPttKey]);

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-lg font-medium text-primary">Input Mode</h2>

      <Switch
        label="Push to Talk"
        description="Hold a key to transmit audio instead of always-on voice activity"
        checked={pttEnabled}
        onCheckedChange={setPttEnabled}
      />

      {pttEnabled && (
        <div className="flex items-center gap-3 pl-4">
          <span className="text-sm text-secondary">Push to Talk Key</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="flex-1 rounded-md bg-secondary border-2 border-primary px-3 py-1.5 text-sm text-primary text-center">
              {recording ? 'Press a key...' : pttKeyLabel}
            </span>
            <Button variant="secondary" size="sm" onClick={handleRecordKey} disabled={recording}>
              {recording ? 'Listening...' : 'Change Key'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
