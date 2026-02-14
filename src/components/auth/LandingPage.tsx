import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-card landing-card">
        <div className="landing-logo">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="var(--accent)" />
            <text
              x="32"
              y="44"
              textAnchor="middle"
              fill="white"
              fontSize="32"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              E
            </text>
          </svg>
        </div>

        <h1>Welcome to Ecto</h1>
        <p className="auth-subtitle">Your servers, your rules.</p>

        <div className="landing-actions">
          <button
            className="auth-button"
            onClick={() => navigate('/login')}
          >
            Sign in to Ecto Central
          </button>

          <button
            className="auth-button auth-button-secondary"
            onClick={() => navigate('/direct-connect')}
          >
            Connect to a Server
          </button>
        </div>

        <p className="auth-footer">
          New to Ecto?{' '}
          <a
            href="/register"
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
          >
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
