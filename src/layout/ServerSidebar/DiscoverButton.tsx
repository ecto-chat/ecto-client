import { useNavigate, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useUiStore } from 'ecto-core';
import { IconButton } from '@/ui/IconButton';
import { Tooltip } from '@/ui/Tooltip';
import { cn } from '@/lib/cn';

export function DiscoverButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.startsWith('/discover');

  const handleClick = () => {
    useUiStore.getState().setActiveServer(null);
    useUiStore.getState().setActiveChannel(null);
    navigate('/discover');
  };

  return (
    <Tooltip content="Discover" side="right">
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
        <Compass size={20} />
      </IconButton>
    </Tooltip>
  );
}
