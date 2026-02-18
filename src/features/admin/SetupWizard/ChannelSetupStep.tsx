import { Plus, X, CheckCircle2 } from 'lucide-react';

import { Button, Input, Select, IconButton } from '@/ui';

import type { StepProps } from './wizard-types';
import { TemplatePreview } from './TemplatePreview';

type ChannelSetupStepProps = Pick<StepProps, 'state' | 'updateState'>;

const channelTypeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'voice', label: 'Voice' },
];

export function ChannelSetupStep({ state, updateState }: ChannelSetupStepProps) {
  const template = state.selectedTemplate;

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-xl text-primary">Create Channels</h2>
        <p className="text-sm text-secondary">
          {template
            ? `Pre-filled from "${template.name}" template. Modify as needed.`
            : 'Add the channels for your server.'}
        </p>
      </div>

      {template && template.categories.length > 0 ? (
        <TemplatePreview template={template} />
      ) : (
        <FlatChannelEditor state={state} updateState={updateState} />
      )}

      {state.channelsCreated && (
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-3 text-sm text-accent">
          <CheckCircle2 size={16} />
          Channels and roles created successfully.
        </div>
      )}
    </div>
  );
}

function FlatChannelEditor({ state, updateState }: Pick<StepProps, 'state' | 'updateState'>) {
  return (
    <div className="flex flex-col gap-2">
      {state.channels.map((ch, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-24 shrink-0">
            <Select
              options={channelTypeOptions}
              value={ch.type}
              onValueChange={(val) => {
                const channels = [...state.channels];
                channels[i] = { ...ch, type: val as 'text' | 'voice' };
                updateState({ channels });
              }}
            />
          </div>
          <Input
            value={ch.name}
            placeholder="channel-name"
            onChange={(e) => {
              const channels = [...state.channels];
              channels[i] = { ...ch, name: e.target.value };
              updateState({ channels });
            }}
          />
          {state.channels.length > 1 && (
            <IconButton
              variant="ghost"
              size="sm"
              tooltip="Remove channel"
              onClick={() => {
                const channels = state.channels.filter((_, idx) => idx !== i);
                updateState({ channels });
              }}
            >
              <X size={14} />
            </IconButton>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start mt-1"
        onClick={() => updateState({ channels: [...state.channels, { name: '', type: 'text' }] })}
      >
        <Plus size={14} />
        Add Channel
      </Button>
    </div>
  );
}
