import { Switch, Select } from '@/ui';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';

import { UPLOAD_SIZE_OPTIONS, type StepProps } from './wizard-types';

type ServerSettingsStepProps = Pick<StepProps, 'state' | 'updateState'>;

const uploadSizeSelectOptions = UPLOAD_SIZE_OPTIONS.map((opt) => ({
  value: String(opt.value),
  label: opt.label,
}));

export function ServerSettingsStep({ state, updateState }: ServerSettingsStepProps) {
  const serverId = useUiStore((s) => s.activeServerId);
  const isManaged = useServerStore((s) => serverId ? s.serverMeta.get(serverId)?.hosting_mode === 'managed' : false);

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-xl text-primary">Server Settings</h2>
        <p className="text-sm text-secondary">
          Configure how your server works. You can change these later in the admin panel.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Switch
          label="Require Invite to Join"
          description="When enabled, new members must have a valid invite code to join this server."
          checked={state.requireInvite}
          onCheckedChange={(checked) => updateState({ requireInvite: checked })}
        />

        {!isManaged && (
          <Switch
            label="Allow Local Accounts"
            description="Allow users to create accounts directly on this server without a central Ecto account."
            checked={state.allowLocalAccounts}
            onCheckedChange={(checked) => updateState({ allowLocalAccounts: checked })}
          />
        )}

        <Switch
          label="Allow Member DMs"
          description="Allow members to send direct messages to each other within this server."
          checked={state.allowMemberDms}
          onCheckedChange={(checked) => updateState({ allowMemberDms: checked })}
        />

        <Select
          label="Max Upload Size"
          options={uploadSizeSelectOptions}
          value={String(state.maxUploadSizeBytes)}
          onValueChange={(value) => updateState({ maxUploadSizeBytes: Number(value) })}
        />
      </div>
    </div>
  );
}
