import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useActivityStore } from '@/stores/activity';
import { useUiStore } from '@/stores/ui';
import { IconButton, Badge, Tooltip } from '@/ui';
import { cn } from '@/lib/cn';

export function ActivityBell() {
  const unreadNotifications = useActivityStore((s) => s.unreadNotifications);
  const unreadServerDms = useActivityStore((s) => s.unreadServerDms);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = location.pathname.startsWith('/activity');

  const handleClick = () => {
    useUiStore.getState().setActiveServer(null);
    useUiStore.getState().setActiveChannel(null);
    navigate('/activity');
  };

  return (
    <Tooltip content="Activity" side="right">
      <div className="group relative flex w-full items-center justify-center py-1">
        <div className="relative">
          {unreadNotifications > 0 && (
            <div className="absolute -top-1 -left-1 z-10">
              <Badge variant="danger" size="md" className="ring-3 ring-[var(--color-bg-secondary)]">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Badge>
            </div>
          )}
          {unreadServerDms > 0 && (
            <div className="absolute bottom-0 -left-1 z-10">
              <Badge variant="default" size="md" className="ring-3 ring-[var(--color-bg-secondary)] bg-[#7c5cfc]">
                {unreadServerDms > 99 ? '99+' : unreadServerDms}
              </Badge>
            </div>
          )}
          <IconButton
            variant="default"
            size="lg"
            onClick={handleClick}
            className={cn(
              'h-12 w-12 transition-[border-radius,background-color,color] duration-150',
              isActive
                ? 'rounded-2xl bg-accent text-white'
                : 'rounded-full bg-tertiary text-secondary hover:rounded-2xl hover:bg-accent hover:text-white',
            )}
          >
            <Bell size={20} />
          </IconButton>
        </div>
      </div>
    </Tooltip>
  );
}
