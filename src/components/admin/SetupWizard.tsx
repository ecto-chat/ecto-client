import { useState, useRef } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
import { useServerStore } from '../../stores/server.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Invite } from 'ecto-shared';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = [
  'Welcome',
  'Admin Account',
  'Server Identity',
  'Server Settings',
  'Channels',
  'First Invite',
] as const;

const UPLOAD_SIZE_OPTIONS = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '25 MB', value: 25 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 },
] as const;

interface WizardState {
  // Step 3: Server identity
  serverName: string;
  serverDescription: string;
  serverIconUrl: string | null;
  // Step 4: Server settings
  requireInvite: boolean;
  allowLocalAccounts: boolean;
  allowMemberDms: boolean;
  maxUploadSizeBytes: number;
  // Step 5: Channels
  textChannelName: string;
  voiceChannelName: string;
  channelsCreated: boolean;
  // Step 6: Invite
  invite: Invite | null;
  inviteUrl: string | null;
}

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  return (
    <div className="wizard-step-indicator">
      {STEP_LABELS.map((label, index) => {
        const stepNum = (index + 1) as WizardStep;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div
            key={stepNum}
            className={`wizard-step-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          >
            <div className="wizard-dot">
              {isCompleted ? '\u2713' : stepNum}
            </div>
            <span className="wizard-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const serverId = useUiStore((s) => s.activeServerId);

  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<WizardState>({
    serverName: '',
    serverDescription: '',
    serverIconUrl: null,
    requireInvite: false,
    allowLocalAccounts: true,
    allowMemberDms: false,
    maxUploadSizeBytes: 5 * 1024 * 1024,
    textChannelName: 'general',
    voiceChannelName: 'General',
    channelsCreated: false,
    invite: null,
    inviteUrl: null,
  });

  const updateState = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const goNext = () => {
    if (step < 6) {
      setError('');
      setStep((step + 1) as WizardStep);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setError('');
      setStep((step - 1) as WizardStep);
    }
  };

  const handleIconUpload = async (file: File) => {
    if (!serverId) return;
    const conn = connectionManager.getServerConnection(serverId);
    if (!conn) return;

    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${conn.address}/upload/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
        throw new Error(data.error ?? 'Upload failed');
      }

      const data = await res.json() as { icon_url: string };
      updateState({ serverIconUrl: data.icon_url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload icon');
    }
  };

  const handleSaveServerIdentity = async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    if (!state.serverName.trim()) {
      setError('Server name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await trpc.server.update.mutate({
        name: state.serverName.trim(),
        description: state.serverDescription.trim() || undefined,
      });

      // Update the client-side server store so sidebar reflects new name
      useServerStore.getState().updateServer(serverId, {
        server_name: state.serverName.trim(),
      });

      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerSettings = async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setLoading(true);
    setError('');

    try {
      await trpc.serverConfig.update.mutate({
        require_invite: state.requireInvite,
        allow_local_accounts: state.allowLocalAccounts,
        allow_member_dms: state.allowMemberDms,
        max_upload_size_bytes: state.maxUploadSizeBytes,
      });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannels = async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    if (!state.textChannelName.trim()) {
      setError('Text channel name is required');
      return;
    }
    if (!state.voiceChannelName.trim()) {
      setError('Voice channel name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await trpc.channels.create.mutate({
        name: state.textChannelName.trim(),
        type: 'text',
      });
      await trpc.channels.create.mutate({
        name: state.voiceChannelName.trim(),
        type: 'voice',
      });
      updateState({ channelsCreated: true });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channels');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setLoading(true);
    setError('');

    try {
      const result = await trpc.invites.create.mutate({});
      updateState({ invite: result.invite, inviteUrl: result.url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!state.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
    } catch {
      const input = document.createElement('input');
      input.value = state.inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  };

  if (!serverId) {
    return <div className="setup-wizard">No server selected.</div>;
  }

  return (
    <div className="setup-wizard">
      <StepIndicator currentStep={step} />

      <div className="wizard-content">
        {error && <div className="auth-error">{error}</div>}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="wizard-step">
            <h2>Welcome to Your New Server</h2>
            <p>
              This wizard will walk you through the initial setup of your Ecto
              server. You will configure the basics to get up and running quickly.
            </p>
            <p>
              You can always change these settings later from the admin panel.
            </p>
          </div>
        )}

        {/* Step 2: Admin Account */}
        {step === 2 && (
          <div className="wizard-step">
            <h2>Admin Account</h2>
            <p>
              You are setting up this server with your current Ecto account.
              As the server creator, you have been granted full administrator
              permissions.
            </p>
            <div className="wizard-info-box">
              <p>
                Your admin account has all permissions enabled by default.
                You can configure additional roles and permissions in the
                admin panel after setup is complete.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Server Identity */}
        {step === 3 && (
          <div className="wizard-step">
            <h2>Server Identity</h2>
            <p>Give your server a name and description so people know what it is about.</p>

            <div className="wizard-icon-upload">
              <div
                className="wizard-icon-preview"
                onClick={() => fileInputRef.current?.click()}
              >
                {state.serverIconUrl ? (
                  <img src={state.serverIconUrl} alt="Server icon" />
                ) : (
                  <span className="wizard-icon-placeholder">
                    {state.serverName ? state.serverName.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
                <div className="wizard-icon-overlay">Upload</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleIconUpload(file);
                }}
              />
              <span className="wizard-icon-hint">Click to upload an icon</span>
            </div>

            <label className="auth-label">
              Server Name
              <input
                type="text"
                value={state.serverName}
                onChange={(e) => updateState({ serverName: e.target.value })}
                placeholder="My Awesome Server"
                className="auth-input"
                required
                autoFocus
              />
            </label>

            <label className="auth-label">
              Description (optional)
              <textarea
                value={state.serverDescription}
                onChange={(e) => updateState({ serverDescription: e.target.value })}
                placeholder="A place for friends to hang out"
                className="auth-input wizard-textarea"
                rows={3}
              />
            </label>
          </div>
        )}

        {/* Step 4: Server Settings */}
        {step === 4 && (
          <div className="wizard-step">
            <h2>Server Settings</h2>
            <p>Configure how your server works. You can change these later in the admin panel.</p>

            <div className="wizard-setting-row">
              <div className="wizard-setting-info">
                <div className="wizard-setting-label">Require Invite to Join</div>
                <div className="wizard-setting-desc">
                  When enabled, new members must have a valid invite code to join this server.
                </div>
              </div>
              <label className="wizard-toggle">
                <input
                  type="checkbox"
                  checked={state.requireInvite}
                  onChange={(e) => updateState({ requireInvite: e.target.checked })}
                />
                <span className="wizard-toggle-slider" />
              </label>
            </div>

            <div className="wizard-setting-row">
              <div className="wizard-setting-info">
                <div className="wizard-setting-label">Allow Local Accounts</div>
                <div className="wizard-setting-desc">
                  Allow users to create accounts directly on this server without a central Ecto account.
                </div>
              </div>
              <label className="wizard-toggle">
                <input
                  type="checkbox"
                  checked={state.allowLocalAccounts}
                  onChange={(e) => updateState({ allowLocalAccounts: e.target.checked })}
                />
                <span className="wizard-toggle-slider" />
              </label>
            </div>

            <div className="wizard-setting-row">
              <div className="wizard-setting-info">
                <div className="wizard-setting-label">Allow Member DMs</div>
                <div className="wizard-setting-desc">
                  Allow members to send direct messages to each other within this server.
                </div>
              </div>
              <label className="wizard-toggle">
                <input
                  type="checkbox"
                  checked={state.allowMemberDms}
                  onChange={(e) => updateState({ allowMemberDms: e.target.checked })}
                />
                <span className="wizard-toggle-slider" />
              </label>
            </div>

            <div className="wizard-setting-row">
              <div className="wizard-setting-info">
                <div className="wizard-setting-label">Max Upload Size</div>
                <div className="wizard-setting-desc">
                  Maximum file size members can upload in messages.
                </div>
              </div>
              <select
                className="auth-input wizard-select"
                value={state.maxUploadSizeBytes}
                onChange={(e) => updateState({ maxUploadSizeBytes: Number(e.target.value) })}
              >
                {UPLOAD_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 5: Create First Channels */}
        {step === 5 && (
          <div className="wizard-step">
            <h2>Create First Channels</h2>
            <p>
              Every server needs at least one channel. We will create a text channel
              and a voice channel for you.
            </p>

            <label className="auth-label">
              Text Channel Name
              <input
                type="text"
                value={state.textChannelName}
                onChange={(e) => updateState({ textChannelName: e.target.value })}
                placeholder="general"
                className="auth-input"
              />
            </label>

            <label className="auth-label">
              Voice Channel Name
              <input
                type="text"
                value={state.voiceChannelName}
                onChange={(e) => updateState({ voiceChannelName: e.target.value })}
                placeholder="General"
                className="auth-input"
              />
            </label>

            {state.channelsCreated && (
              <div className="wizard-success">Channels created successfully.</div>
            )}
          </div>
        )}

        {/* Step 6: Create First Invite */}
        {step === 6 && (
          <div className="wizard-step">
            {state.invite ? (
              <>
                <h2>Setup Complete!</h2>
                <p>
                  Your server is ready. Share this invite link to let others join:
                </p>

                <div className="wizard-invite-result">
                  <div className="wizard-invite-code">
                    <span className="invite-code">{state.invite.code}</span>
                  </div>
                  {state.inviteUrl && (
                    <div className="wizard-invite-link">
                      <input
                        type="text"
                        value={state.inviteUrl}
                        readOnly
                        className="auth-input"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="btn-secondary"
                        onClick={handleCopyInvite}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                <div className="wizard-complete-actions">
                  <button className="auth-button" onClick={() => {
                    if (serverId) {
                      const trpc = connectionManager.getServerTrpc(serverId);
                      if (trpc) {
                        trpc.serverConfig.completeSetup.mutate().catch(() => {});
                      }
                      const meta = useServerStore.getState().serverMeta.get(serverId);
                      if (meta) {
                        useServerStore.getState().setServerMeta(serverId, { ...meta, setup_completed: true });
                      }
                    }
                    onClose();
                  }}>
                    Close Setup Wizard
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Create Your First Invite</h2>
                <p>
                  Create an invite link so others can join your server. You can
                  always create more invites later from the admin panel.
                </p>

                <button
                  className="auth-button"
                  onClick={handleCreateInvite}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size={18} /> : 'Generate Invite'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="wizard-navigation">
        {step > 1 && !(step === 6 && state.invite) && (
          <button className="btn-secondary" onClick={goBack} disabled={loading}>
            Back
          </button>
        )}
        <div className="wizard-nav-spacer" />
        {step === 1 && (
          <button className="auth-button" onClick={goNext}>
            Get Started
          </button>
        )}
        {step === 2 && (
          <button className="auth-button" onClick={goNext}>
            Next
          </button>
        )}
        {step === 3 && (
          <button
            className="auth-button"
            onClick={handleSaveServerIdentity}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={18} /> : 'Save & Continue'}
          </button>
        )}
        {step === 4 && (
          <button
            className="auth-button"
            onClick={handleSaveServerSettings}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={18} /> : 'Save & Continue'}
          </button>
        )}
        {step === 5 && !state.channelsCreated && (
          <button
            className="auth-button"
            onClick={handleCreateChannels}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={18} /> : 'Create Channels'}
          </button>
        )}
        {step === 5 && state.channelsCreated && (
          <button className="auth-button" onClick={goNext}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
