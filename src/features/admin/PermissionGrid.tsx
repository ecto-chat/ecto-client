import { Permissions } from 'ecto-shared';

import { Switch, ScrollArea } from '@/ui';

type PermissionKey = keyof typeof Permissions;

const PERMISSION_LABELS: { key: PermissionKey; label: string; category: string }[] = [
  { key: 'ADMINISTRATOR', label: 'Administrator', category: 'Server' },
  { key: 'MANAGE_SERVER', label: 'Manage Server', category: 'Server' },
  { key: 'MANAGE_CHANNELS', label: 'Manage Channels', category: 'Server' },
  { key: 'MANAGE_ROLES', label: 'Manage Roles', category: 'Server' },
  { key: 'KICK_MEMBERS', label: 'Kick Members', category: 'Server' },
  { key: 'BAN_MEMBERS', label: 'Ban Members', category: 'Server' },
  { key: 'CREATE_INVITES', label: 'Create Invites', category: 'Server' },
  { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log', category: 'Server' },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages', category: 'Server' },
  { key: 'MANAGE_WEBHOOKS', label: 'Manage Webhooks', category: 'Server' },
  { key: 'VIEW_SERVER_HUB', label: 'View Server Hub', category: 'Server' },
  { key: 'BROWSE_FILES', label: 'Browse Files', category: 'Server' },
  { key: 'UPLOAD_SHARED_FILES', label: 'Upload Shared Files', category: 'Server' },
  { key: 'MANAGE_FILES', label: 'Manage Files', category: 'Server' },
  { key: 'READ_MESSAGES', label: 'Read Messages', category: 'Channel' },
  { key: 'SEND_MESSAGES', label: 'Send Messages', category: 'Channel' },
  { key: 'ATTACH_FILES', label: 'Attach Files', category: 'Channel' },
  { key: 'EMBED_LINKS', label: 'Embed Links', category: 'Channel' },
  { key: 'ADD_REACTIONS', label: 'Add Reactions', category: 'Channel' },
  { key: 'CONNECT_VOICE', label: 'Connect to Voice', category: 'Voice' },
  { key: 'SPEAK_VOICE', label: 'Speak in Voice', category: 'Voice' },
  { key: 'USE_VIDEO', label: 'Use Video', category: 'Voice' },
  { key: 'SCREEN_SHARE', label: 'Screen Share', category: 'Voice' },
  { key: 'MUTE_MEMBERS', label: 'Mute Members', category: 'Voice' },
  { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', category: 'Voice' },
  { key: 'USE_VOICE_ACTIVITY', label: 'Use Voice Activity', category: 'Voice' },
];

const CATEGORIES = [...new Set(PERMISSION_LABELS.map((p) => p.category))];

type PermissionGridProps = {
  permissions: number;
  onChange: (permissions: number) => void;
};

export function PermissionGrid({ permissions, onChange }: PermissionGridProps) {
  const togglePermission = (permKey: PermissionKey) => {
    const bit = Permissions[permKey];
    onChange((permissions & bit) ? (permissions & ~bit) : (permissions | bit));
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">{cat}</h4>
            <div className="space-y-1">
              {PERMISSION_LABELS
                .filter((p) => p.category === cat)
                .map((perm) => {
                  const bit = Permissions[perm.key];
                  const checked = (permissions & bit) === bit;
                  return (
                    <Switch
                      key={perm.key}
                      label={perm.label}
                      checked={checked}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
