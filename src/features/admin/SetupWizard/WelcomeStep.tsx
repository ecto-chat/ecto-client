import { Sparkles, Settings } from 'lucide-react';

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Sparkles size={24} className="text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl text-primary">Welcome to Your New Server</h2>
        <p className="text-sm text-secondary leading-relaxed max-w-sm">
          This wizard will walk you through the initial setup of your Ecto
          server. You will configure the basics to get up and running quickly.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-tertiary px-4 py-3 text-xs text-muted">
        <Settings size={14} className="shrink-0" />
        <span>You can always change these settings later from the admin panel.</span>
      </div>
    </div>
  );
}
