import type { Invite } from 'ecto-shared';
import { type ServerTemplate } from 'ecto-core';

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STEP_LABELS = [
  'Welcome',
  'Admin Account',
  'Server Identity',
  'Server Settings',
  'Template',
  'Channels',
  'Finish',
] as const;

export const UPLOAD_SIZE_OPTIONS = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '25 MB', value: 25 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 },
] as const;

export const SHARED_STORAGE_OPTIONS = [
  { label: '100 MB', value: 100 * 1024 * 1024 },
  { label: '250 MB', value: 250 * 1024 * 1024 },
  { label: '500 MB', value: 500 * 1024 * 1024 },
  { label: '1 GB', value: 1024 * 1024 * 1024 },
  { label: '5 GB', value: 5 * 1024 * 1024 * 1024 },
  { label: '10 GB', value: 10 * 1024 * 1024 * 1024 },
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
  categories: { name: string; channels: { name: string; type: 'text' | 'voice' | 'page' | 'news' }[] }[];
  roles: { name: string; color: string }[];
  channels: { name: string; type: 'text' | 'voice' | 'page' | 'news' }[];
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
