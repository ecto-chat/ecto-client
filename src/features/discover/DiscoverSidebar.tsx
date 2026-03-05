import { Compass } from 'lucide-react';
import { UserBar } from '@/layout/UserBar';

export function DiscoverSidebar() {
  return (
    <div className="flex flex-col h-full bg-secondary">
      <div className="flex h-[60px] shrink-0 items-center px-4 border-b-2 border-primary">
        <Compass size={18} className="text-accent mr-2" />
        <h2 className="text-sm font-semibold text-primary">Discover</h2>
      </div>
      <div className="flex-1" />
      <UserBar />
    </div>
  );
}
