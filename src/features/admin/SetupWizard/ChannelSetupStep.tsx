import { Plus, X, FolderPlus } from 'lucide-react';

import { Button, Input, IconButton } from '@/ui';

import { ChannelTypeSelector, type ChannelType } from '../ChannelTypeSelector';

import type { StepProps } from './wizard-types';

type ChannelSetupStepProps = Pick<StepProps, 'state' | 'updateState'>;

const DEFAULT_ROLE_COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#e67e22', '#f1c40f', '#1abc9c'];

export function ChannelSetupStep({ state, updateState }: ChannelSetupStepProps) {
  const template = state.selectedTemplate;

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-xl text-primary">Create Channels & Roles</h2>
        <p className="text-sm text-secondary">
          {template
            ? `Pre-filled from "${template.name}" template. Modify as needed.`
            : 'Add the channels and roles for your server.'}
        </p>
      </div>

      <CategoryEditor state={state} updateState={updateState} />
      <FlatChannelEditor state={state} updateState={updateState} />
      <RoleEditor state={state} updateState={updateState} />

      {state.channelsCreated && (
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-3 text-sm text-accent">
          Channels and roles created successfully.
        </div>
      )}
    </div>
  );
}

function CategoryEditor({ state, updateState }: Pick<StepProps, 'state' | 'updateState'>) {
  const { categories } = state;

  const addCategory = () => {
    updateState({
      categories: [...categories, { name: '', channels: [{ name: '', type: 'text' }] }],
    });
  };

  const removeCategory = (catIndex: number) => {
    updateState({ categories: categories.filter((_, i) => i !== catIndex) });
  };

  const updateCategoryName = (catIndex: number, name: string) => {
    updateState({
      categories: categories.map((cat, i) =>
        i === catIndex ? { name, channels: cat.channels } : cat,
      ),
    });
  };

  const addChannelToCategory = (catIndex: number) => {
    updateState({
      categories: categories.map((cat, i) =>
        i === catIndex
          ? { name: cat.name, channels: [...cat.channels, { name: '', type: 'text' as const }] }
          : cat,
      ),
    });
  };

  const updateCategoryChannel = (catIndex: number, chIndex: number, name: string, type: ChannelType) => {
    updateState({
      categories: categories.map((cat, i) =>
        i === catIndex
          ? { name: cat.name, channels: cat.channels.map((ch, j) => j === chIndex ? { name, type } : ch) }
          : cat,
      ),
    });
  };

  const removeCategoryChannel = (catIndex: number, chIndex: number) => {
    updateState({
      categories: categories.map((cat, i) =>
        i === catIndex
          ? { name: cat.name, channels: cat.channels.filter((_, j) => j !== chIndex) }
          : cat,
      ),
    });
  };

  if (categories.length === 0) {
    return (
      <Button variant="ghost" size="sm" className="self-start" onClick={addCategory}>
        <FolderPlus size={14} />
        Add Category
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((cat, catIndex) => (
        <div key={catIndex} className="rounded-lg border-2 border-primary p-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderPlus size={14} className="text-secondary shrink-0" />
            <Input
              value={cat.name}
              placeholder="Category name"
              className="text-xs uppercase tracking-wider font-semibold"
              onChange={(e) => updateCategoryName(catIndex, e.target.value)}
            />
            <IconButton
              variant="ghost"
              size="sm"
              tooltip="Remove category"
              onClick={() => removeCategory(catIndex)}
            >
              <X size={14} />
            </IconButton>
          </div>
          <div className="flex flex-col gap-3 pl-2">
            {cat.channels.map((ch, chIndex) => (
              <div key={chIndex} className="space-y-2 rounded-lg bg-tertiary p-3">
                <ChannelTypeSelector
                  value={ch.type}
                  onChange={(type) => updateCategoryChannel(catIndex, chIndex, ch.name, type)}
                />
                <div className="flex items-center gap-2">
                  <Input
                    label="Channel Name"
                    value={ch.name}
                    placeholder="channel-name"
                    onChange={(e) => updateCategoryChannel(catIndex, chIndex, e.target.value, ch.type)}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    tooltip="Remove channel"
                    className="mt-5"
                    onClick={() => removeCategoryChannel(catIndex, chIndex)}
                  >
                    <X size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => addChannelToCategory(catIndex)}
            >
              <Plus size={14} />
              Add Channel
            </Button>
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={addCategory}>
        <FolderPlus size={14} />
        Add Category
      </Button>
    </div>
  );
}

function FlatChannelEditor({ state, updateState }: Pick<StepProps, 'state' | 'updateState'>) {
  const hasCategories = state.categories.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasCategories && state.channels.length > 0 && (
        <div className="text-xs uppercase tracking-wider font-semibold text-muted">
          Uncategorized Channels
        </div>
      )}
      {state.channels.map((ch, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-tertiary p-3">
          <ChannelTypeSelector
            value={ch.type}
            onChange={(type) => {
              const channels = [...state.channels];
              channels[i] = { ...ch, type };
              updateState({ channels });
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              label="Channel Name"
              value={ch.name}
              placeholder="channel-name"
              onChange={(e) => {
                const channels = [...state.channels];
                channels[i] = { ...ch, name: e.target.value };
                updateState({ channels });
              }}
            />
            <IconButton
              variant="ghost"
              size="sm"
              tooltip="Remove channel"
              className="mt-5"
              onClick={() => {
                const channels = state.channels.filter((_, idx) => idx !== i);
                updateState({ channels });
              }}
            >
              <X size={14} />
            </IconButton>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start mt-1"
        onClick={() => updateState({ channels: [...state.channels, { name: '', type: 'text' }] })}
      >
        <Plus size={14} />
        {hasCategories ? 'Add Uncategorized Channel' : 'Add Channel'}
      </Button>
    </div>
  );
}

function RoleEditor({ state, updateState }: Pick<StepProps, 'state' | 'updateState'>) {
  const { roles } = state;

  const addRole = () => {
    const color = DEFAULT_ROLE_COLORS[roles.length % DEFAULT_ROLE_COLORS.length] ?? '#3498db';
    updateState({ roles: [...roles, { name: '', color }] });
  };

  const updateRole = (index: number, name: string, color: string) => {
    updateState({
      roles: roles.map((r, i) => i === index ? { name, color } : r),
    });
  };

  const removeRole = (index: number) => {
    updateState({ roles: roles.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider font-semibold text-muted">Roles</div>
      {roles.map((role, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={role.color}
            onChange={(e) => updateRole(i, role.name, e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border-2 border-primary bg-transparent"
          />
          <Input
            value={role.name}
            placeholder="Role name"
            onChange={(e) => updateRole(i, e.target.value, role.color)}
          />
          <IconButton
            variant="ghost"
            size="sm"
            tooltip="Remove role"
            onClick={() => removeRole(i)}
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={addRole}>
        <Plus size={14} />
        Add Role
      </Button>
    </div>
  );
}
