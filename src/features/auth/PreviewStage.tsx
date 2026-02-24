import { motion } from 'motion/react';
import { Users } from 'lucide-react';

import { Avatar, Button } from '@/ui';

import type { ServerPreviewInfo, AuthAction } from './DirectConnectForm';

type PreviewStageProps = {
  serverInfo: ServerPreviewInfo;
  authAction: AuthAction;
  setAuthAction: (v: AuthAction) => void;
  onContinue: () => void;
};

export function PreviewStage({ serverInfo, authAction, setAuthAction, onContinue }: PreviewStageProps) {
  return (
    <motion.div
      key="preview"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <h1 className="text-xl font-medium text-primary">Server Found</h1>

      <div className="flex items-center gap-3 rounded-lg bg-tertiary p-4 border-2 border-primary">
        <Avatar src={serverInfo.icon} username={serverInfo.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-primary truncate">{serverInfo.name}</p>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Users size={14} />
            {serverInfo.member_count} members &middot; {serverInfo.online_count} online
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-hover transition-colors duration-150">
          <input
            type="radio"
            name="authAction"
            value="register"
            checked={authAction === 'register'}
            onChange={() => setAuthAction('register')}
            className="accent-accent"
          />
          <span className="text-sm text-primary">Create a local account</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-hover transition-colors duration-150">
          <input
            type="radio"
            name="authAction"
            value="login"
            checked={authAction === 'login'}
            onChange={() => setAuthAction('login')}
            className="accent-accent"
          />
          <span className="text-sm text-primary">Sign in with existing local account</span>
        </label>
      </fieldset>

      <Button className="w-full" onClick={onContinue}>
        Continue
      </Button>
    </motion.div>
  );
}
