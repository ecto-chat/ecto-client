import { useState, type FormEvent } from 'react';

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/ui';

import { AddressStage } from './AddressStage';
import { PreviewStage } from './PreviewStage';
import { CredentialsStage } from './CredentialsStage';
import { fetchServerInfo, joinServer, SetupTokenRequiredError } from './direct-connect-actions';

export type Stage = 'address' | 'preview' | 'credentials';
export type AuthAction = 'register' | 'login';

export type ServerPreviewInfo = {
  id: string;
  name: string;
  icon?: string | null;
  member_count: number;
  online_count: number;
};

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

  const handleBack = () => {
    if (stage === 'credentials') { setStage('preview'); setError(''); }
    else if (stage === 'preview') { setStage('address'); setError(''); }
    else navigate('/landing');
  };

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    const url = (address.trim().startsWith('http') ? address.trim() : `http://${address.trim()}`).replace(/\/+$/, '');
    setServerUrl(url);
    try {
      setServerInfo(await fetchServerInfo(url));
      setStage('preview');
    } catch {
      setError('Could not reach server. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = showSetupToken && setupToken.trim() ? setupToken.trim() : null;
      await joinServer(serverUrl, address.trim(), authAction, username.trim(), password, token, serverInfo?.icon);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (err instanceof SetupTokenRequiredError) {
        setShowSetupToken(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to join server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] rounded-xl bg-secondary border border-border p-5 space-y-5"
      >
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-muted">
          <ArrowLeft size={16} /> Back
        </Button>

        <AnimatePresence mode="wait">
          {stage === 'address' && (
            <AddressStage address={address} setAddress={setAddress} error={error} loading={loading} onSubmit={handleConnect} />
          )}
          {stage === 'preview' && serverInfo && (
            <PreviewStage
              serverInfo={serverInfo}
              authAction={authAction}
              setAuthAction={setAuthAction}
              onContinue={() => { setError(''); setStage('credentials'); }}
            />
          )}
          {stage === 'credentials' && (
            <CredentialsStage
              authAction={authAction}
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              setupToken={setupToken}
              setSetupToken={setSetupToken}
              showSetupToken={showSetupToken}
              error={error}
              loading={loading}
              onSubmit={handleJoin}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
