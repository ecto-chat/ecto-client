import { useUiStore } from '../../stores/ui.js';

interface CentralSignInPromptProps {
  message?: string;
}

export function CentralSignInPrompt({ message }: CentralSignInPromptProps) {
  const handleSignIn = () => {
    useUiStore.getState().openModal('central-sign-in');
  };

  return (
    <div className="central-sign-in-prompt">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="central-sign-in-icon">
        <path
          d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"
          fill="currentColor"
          opacity="0.5"
        />
      </svg>

      <h2>Sign in to Ecto Central</h2>
      <p className="central-sign-in-subtext">
        {message ?? 'Connect your Ecto account to access friends, DMs, and calls.'}
      </p>

      <button className="auth-button" onClick={handleSignIn}>
        Sign in to Ecto Central
      </button>
    </div>
  );
}
