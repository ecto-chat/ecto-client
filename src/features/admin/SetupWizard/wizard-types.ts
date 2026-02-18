import type { Invite } from 'ecto-shared';
import type { ServerTemplate } from '@/lib/server-templates';

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STEP_LABELS = [
  'Welcome',
  'Admin Account',
  'Server Identity',
  'Server Settings',
  'Template',
  'Channels',
  'First Invite',
] as const;

export const UPLOAD_SIZE_OPTIONS = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '25 MB', value: 25 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 },
] as const;

export type WizardState = {
  serverName: string;
  serverDescription: string;
  serverIconUrl: string | null;
  requireInvite: boolean;
  allowLocalAccounts: boolean;
  allowMemberDms: boolean;
  maxUploadSizeBytes: number;
  selectedTemplate: ServerTemplate | null;
  channels: { name: string; type: 'text' | 'voice' }[];
  channelsCreated: boolean;
  invite: Invite | null;
  inviteUrl: string | null;
};

export type StepProps = {
  state: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  loading: boolean;
  error: string;
};
