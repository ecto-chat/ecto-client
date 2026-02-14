import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { useUiStore } from '../../stores/ui.js';
import { connectionManager } from '../../services/connection-manager.js';

type Stage = 'address' | 'preview' | 'credentials';
type AuthAction = 'register' | 'login';

interface ServerPreviewInfo {
  id: string;
  name: string;
  icon?: string | null;
  member_count: number;
  online_count: number;
}

export function DirectConnectForm() {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('address');
  const [address, setAddress] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverInfo, setServerInfo] = useState<ServerPreviewInfo | null>(null);
  const [authAction, setAuthAction] = useState<AuthAction>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showSetupToken, setShowSetupToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError('');

    const url = address.trim().startsWith('http') ? address.trim() : `http://${address.trim()}`;
    setServerUrl(url);

    try {
      const res = await fetch(`${url}/trpc/server.info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Could not reach server');
      const data = (await res.json()) as {
        result: {
          data: {
            server: { id: string; name: string; icon?: string | null };
            member_count: number;
            online_count: number;
          };
        };
      };
      const info = {
        id: data.result.data.server.id,
        name: data.result.data.server.name,
        icon: data.result.data.server.icon,
        member_count: data.result.data.member_count,
        online_count: data.result.data.online_count,
      };
      console.log('[DirectConnect] server.info response:', info);
      setServerInfo(info);
      setStage('preview');
    } catch {
      setError('Could not reach server. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToCredentials = () => {
    setError('');
    setStage('credentials');
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = {
        username: username.trim(),
        password,
        action: authAction,
      };
      if (showSetupToken && setupToken.trim()) {
        body.setup_token = setupToken.trim();
      }

      console.log('[DirectConnect] calling server.join with body:', body);
      const res = await fetch(`${serverUrl}/trpc/server.join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('[DirectConnect] server.join response status:', res.status);
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: { message?: string; data?: { code?: string } };
        };
        console.log('[DirectConnect] server.join error:', errData);
        const errCode = errData.error?.data?.code;
        if (errCode === 'SETUP_TOKEN_REQUIRED' || errData.error?.message?.includes('setup_token')) {
          setShowSetupToken(true);
          setError('This server requires a setup token to join.');
          return;
        }
        throw new Error(errData.error?.message ?? 'Failed to join server');
      }

      const data = (await res.json()) as {
        result: {
          data: {
            server_token: string;
            server: { id: string; name: string };
            member: { id: string; user_id: string };
          };
        };
      };

      console.log('[DirectConnect] join success, server:', data.result.data.server, 'member:', data.result.data.member);
      const { server_token, server } = data.result.data;

      // Store session and enter local-only mode
      connectionManager.storeServerSession(server.id, serverUrl, server_token);
      // Store credentials for future auto-joins on other servers
      connectionManager.storeLocalCredentials(username.trim(), password);
      console.log('[DirectConnect] stored session, calling enterLocalOnly');
      useAuthStore.getState().enterLocalOnly();

      // Connect to the server
      console.log('[DirectConnect] calling connectToServerLocal');
      const realId = await connectionManager.connectToServerLocal(serverUrl, server_token);
      console.log('[DirectConnect] connected, realId:', realId);

      // Add to server store
      useServerStore.getState().addServer({
        id: realId,
        server_address: address.trim(),
        server_name: server.name,
        server_icon: serverInfo?.icon ?? null,
        position: 0,
        joined_at: new Date().toISOString(),
      });

      useUiStore.getState().setActiveServer(realId);

      console.log('[DirectConnect] navigating to /');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button
          className="direct-connect-back"
          onClick={() => {
            if (stage === 'credentials') {
              setStage('preview');
              setError('');
            } else if (stage === 'preview') {
              setStage('address');
              setError('');
            } else {
              navigate('/landing');
            }
          }}
        >
          &larr; Back
        </button>

        {/* Stage 1: Server Address */}
        {stage === 'address' && (
          <>
            <h1>Connect to a Server</h1>
            <p className="auth-subtitle">Enter the address of the server you want to join.</p>

            <form onSubmit={handleConnect} className="auth-form">
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

              <button type="submit" disabled={loading || !address.trim()} className="auth-button">
                {loading ? <LoadingSpinner size={18} /> : 'Connect'}
              </button>
            </form>
          </>
        )}

        {/* Stage 2: Server Preview */}
        {stage === 'preview' && serverInfo && (
          <>
            <h1>Server Found</h1>

            <div className="server-preview-card">
              <div className="server-preview-icon">
                {serverInfo.icon ? (
                  <img src={serverInfo.icon} alt={serverInfo.name} width={48} height={48} />
                ) : (
                  <div className="server-preview-icon-fallback">
                    {serverInfo.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="server-preview-info">
                <h2>{serverInfo.name}</h2>
                <p>{serverInfo.member_count} members &middot; {serverInfo.online_count} online</p>
              </div>
            </div>

            <div className="auth-form">
              <div className="auth-radio-group">
                <label className="auth-radio">
                  <input
                    type="radio"
                    name="authAction"
                    value="register"
                    checked={authAction === 'register'}
                    onChange={() => setAuthAction('register')}
                  />
                  <span>Create a local account</span>
                </label>
                <label className="auth-radio">
                  <input
                    type="radio"
                    name="authAction"
                    value="login"
                    checked={authAction === 'login'}
                    onChange={() => setAuthAction('login')}
                  />
                  <span>Sign in with existing local account</span>
                </label>
              </div>

              <button className="auth-button" onClick={handleContinueToCredentials}>
                Continue
              </button>
            </div>
          </>
        )}

        {/* Stage 3: Local Credentials */}
        {stage === 'credentials' && (
          <>
            <h1>{authAction === 'register' ? 'Create Local Account' : 'Sign In'}</h1>
            <p className="auth-subtitle">
              {authAction === 'register'
                ? 'Create a local account on this server.'
                : 'Sign in with your existing local account.'}
            </p>

            <form onSubmit={handleJoin} className="auth-form">
              {error && <div className="auth-error">{error}</div>}

              <label className="auth-label">
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  autoFocus
                  className="auth-input"
                />
              </label>

              <label className="auth-label">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="auth-input"
                />
              </label>

              {showSetupToken && (
                <label className="auth-label">
                  Setup Token
                  <input
                    type="text"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    placeholder="Enter server setup token"
                    className="auth-input"
                  />
                </label>
              )}

              <button type="submit" disabled={loading || !username.trim() || !password.trim()} className="auth-button">
                {loading ? <LoadingSpinner size={18} /> : (authAction === 'register' ? 'Create & Join' : 'Sign In')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
