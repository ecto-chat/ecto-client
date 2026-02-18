import { useState } from 'react';

import { Button, Input } from '@/ui';

import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';

import { connectionManager } from '@/services/connection-manager';

import { cn } from '@/lib/cn';

type PresenceOption = 'online' | 'idle' | 'dnd' | 'offline';

type PresenceChoice = {
  value: PresenceOption;
  label: string;
  dotClass: string;
  description: string;
};

const PRESENCE_OPTIONS: PresenceChoice[] = [
  { value: 'online', label: 'Online', dotClass: 'bg-status-online', description: 'You are visible to others' },
  { value: 'idle', label: 'Idle', dotClass: 'bg-status-idle', description: 'You appear as away' },
  { value: 'dnd', label: 'Do Not Disturb', dotClass: 'bg-status-dnd', description: 'Suppresses notifications' },
  { value: 'offline', label: 'Invisible', dotClass: 'bg-status-offline', description: 'You appear offline to others' },
];

export function PresencePicker() {
  const user = useAuthStore((s) => s.user);
  const presences = usePresenceStore((s) => s.presences);
  const setPresence = usePresenceStore((s) => s.setPresence);

  const currentPresence = user ? presences.get(user.id) : undefined;
  const currentStatus = currentPresence?.status ?? 'online';
  const currentCustomText = currentPresence?.custom_text ?? '';

  const [customText, setCustomText] = useState(currentCustomText);
  const [selectedStatus, setSelectedStatus] = useState<PresenceOption>(
    currentStatus === 'offline' ? 'online' : (currentStatus as PresenceOption),
  );

  const applyPresence = (status: PresenceOption, text: string) => {
    if (user) setPresence(user.id, status, text || undefined);
    const centralWs = connectionManager.getCentralWs();
    centralWs?.updatePresence(status, text || undefined);
  };

  const handleStatusChange = (status: PresenceOption) => {
    setSelectedStatus(status);
    applyPresence(status, customText);
  };

  const handleCustomTextBlur = () => applyPresence(selectedStatus, customText);

  const handleCustomTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyPresence(selectedStatus, customText);
  };

  const activeOption = PRESENCE_OPTIONS.find((o) => o.value === selectedStatus)!;

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-lg font-medium text-primary">Status</h2>

      <div className="flex items-center gap-2">
        <span className={cn('size-3 rounded-full', activeOption.dotClass)} />
        <span className="text-sm text-primary">{activeOption.label}</span>
        {customText && <span className="text-sm text-muted"> &mdash; {customText}</span>}
      </div>

      <div className="flex flex-col gap-1">
        {PRESENCE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 h-auto justify-start font-normal',
              selectedStatus === option.value ? 'bg-active' : 'hover:bg-hover',
            )}
            onClick={() => handleStatusChange(option.value)}
          >
            <span className={cn('size-3 rounded-full', option.dotClass)} />
            <div className="flex flex-col items-start">
              <span className="text-sm text-primary">{option.label}</span>
              <span className="text-xs text-muted">{option.description}</span>
            </div>
          </Button>
        ))}
      </div>

      <Input
        label="Custom Status Text"
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        onBlur={handleCustomTextBlur}
        onKeyDown={handleCustomTextKeyDown}
        maxLength={128}
        placeholder="What are you up to?"
      />
    </div>
  );
}
