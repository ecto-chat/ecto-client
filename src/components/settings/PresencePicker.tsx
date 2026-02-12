import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { usePresenceStore } from '../../stores/presence.js';
import { connectionManager } from '../../services/connection-manager.js';

type PresenceOption = 'online' | 'idle' | 'dnd' | 'offline';

interface PresenceChoice {
  value: PresenceOption;
  label: string;
  color: string;
  description: string;
}

const PRESENCE_OPTIONS: PresenceChoice[] = [
  { value: 'online', label: 'Online', color: '#3ba55d', description: 'You are visible to others' },
  { value: 'idle', label: 'Idle', color: '#faa81a', description: 'You appear as away' },
  { value: 'dnd', label: 'Do Not Disturb', color: '#ed4245', description: 'Suppresses notifications' },
  { value: 'offline', label: 'Invisible', color: '#747f8d', description: 'You appear offline to others' },
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

  const handleStatusChange = (status: PresenceOption) => {
    setSelectedStatus(status);
    applyPresence(status, customText);
  };

  const handleCustomTextChange = (text: string) => {
    setCustomText(text);
  };

  const handleCustomTextBlur = () => {
    applyPresence(selectedStatus, customText);
  };

  const handleCustomTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyPresence(selectedStatus, customText);
    }
  };

  const applyPresence = (status: PresenceOption, text: string) => {
    // Update local store
    if (user) {
      setPresence(user.id, status, text || undefined);
    }

    // Send via Central WS
    const centralWs = connectionManager.getCentralWs();
    centralWs?.updatePresence(status, text || undefined);
  };

  const activeOption = PRESENCE_OPTIONS.find((o) => o.value === selectedStatus)!;

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Status</h2>

      <div className="presence-current">
        <div
          className="presence-dot"
          style={{ backgroundColor: activeOption.color }}
        />
        <span className="presence-current-label">{activeOption.label}</span>
        {customText && (
          <span className="presence-current-text"> &mdash; {customText}</span>
        )}
      </div>

      <div className="presence-options">
        {PRESENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`presence-option ${selectedStatus === option.value ? 'presence-option-active' : ''}`}
            onClick={() => handleStatusChange(option.value)}
          >
            <div
              className="presence-dot"
              style={{ backgroundColor: option.color }}
            />
            <div className="presence-option-info">
              <span className="presence-option-label">{option.label}</span>
              <span className="presence-option-desc">{option.description}</span>
            </div>
          </button>
        ))}
      </div>

      <label className="settings-label">
        Custom Status Text
        <input
          type="text"
          value={customText}
          onChange={(e) => handleCustomTextChange(e.target.value)}
          onBlur={handleCustomTextBlur}
          onKeyDown={handleCustomTextKeyDown}
          maxLength={128}
          placeholder="What are you up to?"
          className="settings-input"
        />
      </label>
    </div>
  );
}
