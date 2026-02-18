import { ShieldCheck, Info } from 'lucide-react';

export function AdminStep() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <ShieldCheck size={24} className="text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl text-primary">Admin Account</h2>
        <p className="text-sm text-secondary leading-relaxed max-w-sm">
          You are setting up this server with your current Ecto account.
          As the server creator, you have been granted full administrator
          permissions.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-tertiary px-4 py-3 text-xs text-muted">
        <Info size={14} className="shrink-0" />
        <span>
          Your admin account has all permissions enabled by default.
          You can configure additional roles and permissions in the
          admin panel after setup is complete.
        </span>
      </div>
    </div>
  );
}
