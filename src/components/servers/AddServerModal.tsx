import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { useMemberStore } from '../../stores/member.js';
import { connectionManager } from '../../services/connection-manager.js';
import { EctoErrorCode } from 'ecto-shared';

type LocalJoinStage =
  | 'idle'
  | 'preview'
  | 'joining'
  | 'no-local-accounts';

interface ServerPreview {
  name: string;
  icon_url: string | null;
  member_count: number;
  online_count: number;
  require_invite: boolean;
  allow_local_accounts: boolean;
}

/**
 * Get the current local user's credentials.
 * First checks stored credentials, then falls back to detecting username
 * from the member store and prompting for password.
 */
async function getLocalCredentials(): Promise<{ username: string; password: string } | null> {
  // Check stored credentials first
  const stored = await connectionManager.getStoredLocalCredentials();
  if (stored) return stored;

  // Fall back: detect username from current session's member data
  const activeServerId = useUiStore.getState().activeServerId;
  if (!activeServerId) return null;

  const meta = useServerStore.getState().serverMeta.get(activeServerId);
  if (!meta?.user_id) return null;

  const serverMembers = useMemberStore.getState().members.get(activeServerId);
  if (!serverMembers) return null;

  const me = serverMembers.get(meta.user_id);
  if (!me?.username) return null;

  // We have the username but not the password — can't auto-join
  return null;
}

export function AddServerModal() {
  const open = useUiStore((s) => s.activeModal === 'add-server');

  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Local-join inline flow state
  const [localJoinStage, setLocalJoinStage] = useState<LocalJoinStage>('idle');
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  // One-time password prompt when no stored credentials exist
  const [needsPassword, setNeedsPassword] = useState(false);
  const [detectedUsername, setDetectedUsername] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const resetAndClose = () => {
    setAddress('');
    setError('');
    setLoading(false);
    setLocalJoinStage('idle');
    setServerPreview(null);
    setInviteCode('');
    setNeedsPassword(false);
    setDetectedUsername('');
    setPasswordInput('');
    useUiStore.getState().closeModal();
  };

  const attemptAutoJoin = async (
    serverAddress: string,
    username: string,
    password: string,
    invite?: string,
  ) => {
    setLocalJoinStage('joining');
    setError('');

    const result = await connectionManager.attemptLocalJoin(serverAddress, {
      username,
      password,
      inviteCode: invite || undefined,
    });

    if ('serverId' in result) {
      // Success — store credentials for future auto-joins
      await connectionManager.storeLocalCredentials(username, password);

      const conn = connectionManager.getServerTrpc(result.serverId);
      let serverName = serverPreview?.name ?? serverAddress;
      try {
        if (conn) {
          const info = await conn.server.info.query();
          serverName = info.server.name ?? serverName;
        }
      } catch { /* use preview name as fallback */ }

      useServerStore.getState().addServer({
        id: result.serverId,
        server_address: serverAddress,
        server_name: serverName,
        server_icon: serverPreview?.icon_url ?? null,
        position: useServerStore.getState().serverOrder.length,
        joined_at: new Date().toISOString(),
      });

      useUiStore.getState().setActiveServer(result.serverId);
      resetAndClose();
      return;
    }

    // Error handling
    const { ectoCode, message } = result.error;

    if (ectoCode === EctoErrorCode.LOCAL_AUTH_DISABLED) {
      setLocalJoinStage('no-local-accounts');
    } else if (ectoCode === EctoErrorCode.INVITE_INVALID || ectoCode === EctoErrorCode.INVITE_EXPIRED || ectoCode === EctoErrorCode.INVITE_MAX_USES) {
      setLocalJoinStage('preview');
      setError(message);
    } else {
      setLocalJoinStage('idle');
      setError(message);
    }
  };

  /** Detect the current user's username from the active server's member store */
  const detectUsername = (): string | null => {
    const activeServerId = useUiStore.getState().activeServerId;
    if (!activeServerId) return null;
    const meta = useServerStore.getState().serverMeta.get(activeServerId);
    if (!meta?.user_id) return null;
    const serverMembers = useMemberStore.getState().members.get(activeServerId);
    if (!serverMembers) return null;
    const me = serverMembers.get(meta.user_id);
    return me?.username ?? null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isCentral = useAuthStore.getState().centralAuthState === 'authenticated';
      const token = useAuthStore.getState().getToken();

      if (isCentral && token) {
        // Path A: Central-authenticated flow — use server.join with Central JWT
        const realServerId = await connectionManager.connectToServer(address, address, token);

        const centralTrpc = connectionManager.getCentralTrpc();
        if (centralTrpc) {
          await centralTrpc.servers.add.mutate({
            server_address: address,
          }).catch(() => {});
        }

        const conn = connectionManager.getServerTrpc(realServerId);
        let serverName = address;
        try {
          if (conn) {
            const info = await conn.server.info.query();
            serverName = info.server.name ?? address;
          }
        } catch { /* use address as fallback name */ }

        useServerStore.getState().addServer({
          id: realServerId,
          server_address: address,
          server_name: serverName,
          server_icon: null,
          position: useServerStore.getState().serverOrder.length,
          joined_at: new Date().toISOString(),
        });

        useUiStore.getState().setActiveServer(realServerId);
        resetAndClose();
      } else {
        // Path B: Local-only mode — inline auto-join flow
        const serverUrl = address.startsWith('http') ? address : `http://${address}`;

        const infoRes = await fetch(`${serverUrl}/trpc/server.info`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!infoRes.ok) throw new Error('Could not reach server');

        const infoData = (await infoRes.json()) as {
          result: {
            data: {
              server: { id: string; name: string; icon_url?: string | null };
              member_count: number;
              online_count: number;
              require_invite: boolean;
              allow_local_accounts: boolean;
            };
          };
        };

        const info = infoData.result.data;
        const preview: ServerPreview = {
          name: info.server.name,
          icon_url: info.server.icon_url ?? null,
          member_count: info.member_count,
          online_count: info.online_count,
          require_invite: info.require_invite,
          allow_local_accounts: info.allow_local_accounts,
        };
        setServerPreview(preview);

        if (!preview.allow_local_accounts) {
          setLocalJoinStage('no-local-accounts');
          return;
        }

        const creds = await getLocalCredentials();

        if (!creds) {
          // No stored credentials — detect username and ask for password once
          const username = detectUsername();
          if (username) {
            setDetectedUsername(username);
            setNeedsPassword(true);
            // Still show preview if invite is required
            if (preview.require_invite) {
              setLocalJoinStage('preview');
            }
          } else {
            setError('No stored credentials. Please join a server through Direct Connect first.');
          }
          return;
        }

        if (preview.require_invite) {
          setLocalJoinStage('preview');
          return;
        }

        // Auto-join immediately
        await attemptAutoJoin(address, creds.username, creds.password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsPassword) {
      if (!passwordInput) return;
      attemptAutoJoin(address, detectedUsername, passwordInput, inviteCode);
      return;
    }
    const creds = await connectionManager.getStoredLocalCredentials();
    if (!creds) return;
    attemptAutoJoin(address, creds.username, creds.password, inviteCode);
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    attemptAutoJoin(address, detectedUsername, passwordInput);
  };

  const renderServerPreviewCard = () => {
    if (!serverPreview) return null;
    return (
      <div className="server-preview-card">
        <div className="server-preview-icon">
          {serverPreview.icon_url ? (
            <img src={serverPreview.icon_url} alt={serverPreview.name} width={48} height={48} />
          ) : (
            <div className="server-preview-icon-fallback">
              {serverPreview.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="server-preview-info">
          <h2>{serverPreview.name}</h2>
          <p>{serverPreview.member_count} members &middot; {serverPreview.online_count} online</p>
        </div>
      </div>
    );
  };

  // Joining stage — show spinner
  if (localJoinStage === 'joining') {
    return (
      <Modal open={open} onClose={resetAndClose} title="Joining Server">
        {renderServerPreviewCard()}
        <div className="add-server-joining">
          <LoadingSpinner size={24} />
          <p>Joining...</p>
        </div>
      </Modal>
    );
  }

  // Preview stage — invite code required (+ optional one-time password if no stored creds)
  if (localJoinStage === 'preview') {
    return (
      <Modal open={open} onClose={resetAndClose} title="Join Server">
        {renderServerPreviewCard()}
        <form onSubmit={handleInviteSubmit} className="add-server-form">
          {error && <div className="auth-error">{error}</div>}
          <p className="add-server-hint">This server requires an invite code to join.</p>
          <label className="auth-label">
            Invite Code
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              required
              autoFocus
              className="auth-input"
            />
          </label>
          {needsPassword && (
            <label className="auth-label">
              Password
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                required
                className="auth-input"
              />
            </label>
          )}
          <div className="modal-actions">
            <button type="button" onClick={resetAndClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={!inviteCode.trim() || (needsPassword && !passwordInput)} className="auth-button">
              Join Server
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // No local accounts — show error with sign-in option
  if (localJoinStage === 'no-local-accounts') {
    return (
      <Modal open={open} onClose={resetAndClose} title="Cannot Join">
        {renderServerPreviewCard()}
        <div className="add-server-form">
          <p className="auth-error">This server doesn&apos;t accept local accounts.</p>
          <div className="modal-actions">
            <button type="button" onClick={resetAndClose} className="btn-secondary">
              Close
            </button>
            <button
              type="button"
              className="auth-button"
              onClick={() => {
                resetAndClose();
                useUiStore.getState().openModal('central-sign-in');
              }}
            >
              Sign In to Ecto
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // One-time password prompt (no stored creds, no invite required, username auto-detected)
  if (needsPassword && localJoinStage === 'idle') {
    return (
      <Modal open={open} onClose={resetAndClose} title="Join Server">
        {renderServerPreviewCard()}
        <form onSubmit={handlePasswordSubmit} className="add-server-form">
          {error && <div className="auth-error">{error}</div>}
          <p className="add-server-hint">
            Joining as <strong>{detectedUsername}</strong>. Enter your password to continue.
          </p>
          <label className="auth-label">
            Password
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
              className="auth-input"
            />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={resetAndClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={!passwordInput} className="auth-button">
              Join Server
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // Default: idle — address input form
  return (
    <Modal open={open} onClose={resetAndClose} title="Add a Server">
      <form onSubmit={handleSubmit} className="add-server-form">
        {error && <div className="auth-error">{error}</div>}

        <label className="auth-label">
          Server Address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="example.com:3000"
            required
            autoFocus
            className="auth-input"
          />
        </label>

        <p className="add-server-hint">
          Enter the address of the server you want to join, or paste an invite link.
        </p>

        <div className="modal-actions">
          <button type="button" onClick={resetAndClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? <LoadingSpinner size={18} /> : 'Join Server'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
