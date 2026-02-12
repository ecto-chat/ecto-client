import { LoadingSpinner } from './LoadingSpinner.js';

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <h1 className="splash-logo">Ecto</h1>
      <LoadingSpinner />
    </div>
  );
}
